import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { databasePool } from "@/lib/db/pool";
import { configuredDriveReader } from "./google";
import { SourceError, type Candidate, type DriveReader } from "./drive";
import { PLAYOFF_PARSER_REVISION } from "./workbook-parser";
import { parseSourceWorkbook, WorkbookParseError, WORKBOOK_PARSER_VERSION, type ParsedSourceWorkbook, type WorkbookIssue } from "./workbook";

type DownloadedSource = Awaited<ReturnType<DriveReader["download"]>>;

type SourceRow = { id: string; season: number };
type ExistingAlbum = {
  id: string;
  identity_key: string;
  record: Record<string, unknown> | null;
  is_present: boolean | null;
  total: string | null;
  sound: string | null;
  identity: string | null;
  consistency: string | null;
  replay: string | null;
};
type ExistingVersion = { id: string; version: string; sha256: string };
type SyncCounts = {
  playoffParserRevision: number;
  albumRows: number;
  albums: number;
  backlogRows: number;
  backlog: number;
  rejectedRows: number;
  reportedOriginalDifferences: number;
  incompleteEvaluations: number;
  errors: number;
  warnings: number;
  new: number;
  changed: number;
  unchanged: number;
  absent: number;
};

export class SyncServiceError extends Error {
  constructor(public readonly code: string, public readonly issues: WorkbookIssue[] = []) {
    super(code);
    this.name = "SyncServiceError";
  }
}

function logSyncFailure(stage: string, error: unknown) {
  const detail = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; constraint?: unknown } : {};
  console.error("Sync failure", {
    stage,
    name: typeof detail.name === "string" ? detail.name : "UnknownError",
    code: typeof detail.code === "string" ? detail.code : undefined,
    constraint: typeof detail.constraint === "string" ? detail.constraint : undefined,
  });
}

function safeSeason(): number {
  const value = process.env.SOURCE_SEASON ?? "2026";
  if (!/^\d{4}$/.test(value) || Number(value) < 2000) throw new SyncServiceError("SOURCE_NOT_CONFIGURED");
  return Number(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function getConfiguredSource(pool: Pool, season: number): Promise<SourceRow> {
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folder) throw new SyncServiceError("DRIVE_NOT_CONFIGURED");
  const result = await pool.query<SourceRow>(
    "SELECT id, season FROM oraculo.sources WHERE season = $1 AND folder_id = $2",
    [season, folder],
  );
  if (result.rows.length !== 1) throw new SyncServiceError(result.rows.length ? "SOURCE_CONFIGURATION_AMBIGUOUS" : "SOURCE_NOT_REGISTERED");
  return result.rows[0];
}

async function acquireLeaseAndStartRun(pool: Pool, sourceId: string, userId: string) {
  const client = await pool.connect();
  const runId = randomUUID();
  const token = randomUUID();
  try {
    await client.query("BEGIN");
    const lease = await client.query(
      `INSERT INTO oraculo.sync_leases(source_id, token, expires_at)
       VALUES ($1, $2, now() + interval '5 minutes')
       ON CONFLICT (source_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
       WHERE oraculo.sync_leases.expires_at <= now()
       RETURNING token`,
      [sourceId, token],
    );
    if (!lease.rowCount) throw new SyncServiceError("SYNC_IN_PROGRESS");

    await client.query(
      `UPDATE oraculo.sync_runs
          SET status = 'failed', finished_at = now(), error_code = 'LEASE_EXPIRED'
        WHERE source_id = $1 AND status = 'running' AND started_at < now() - interval '5 minutes'`,
      [sourceId],
    );
    await client.query(
      `INSERT INTO oraculo.sync_runs(id, source_id, requested_by, status)
       VALUES ($1, $2, $3, 'running')`,
      [runId, sourceId, userId],
    );
    await client.query("COMMIT");
    return { runId, token };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error instanceof SyncServiceError) throw error;
    logSyncFailure("start_run", error);
    throw new SyncServiceError("SYNC_STORAGE_UNAVAILABLE");
  } finally {
    client.release();
  }
}

async function recordCandidate(pool: Pool, runId: string, candidate: Candidate, sha256: string) {
  await pool.query(
    `UPDATE oraculo.sync_runs
        SET candidate_version = $2, candidate_file_id = $3, candidate_file_name = $4, candidate_sha256 = $5
      WHERE id = $1 AND status = 'running'`,
    [runId, candidate.sourceVersion, candidate.file.id, candidate.file.name, sha256],
  );
}

async function rejectChangedAttemptedVersion(pool: Pool, sourceId: string, runId: string, version: string, sha256: string) {
  const previous = await pool.query(
    `SELECT 1 FROM oraculo.sync_runs
      WHERE source_id = $1 AND id <> $2 AND candidate_version = $3::bigint
        AND candidate_sha256 IS NOT NULL AND candidate_sha256 <> $4
      LIMIT 1`,
    [sourceId, runId, version, sha256],
  );
  if (previous.rowCount) throw new SyncServiceError("SOURCE_VERSION_CONTENT_CONFLICT");
}

async function insertIssues(client: PoolClient, runId: string, issues: WorkbookIssue[]) {
  for (const issue of issues) {
    await client.query(
      `INSERT INTO oraculo.import_issues(sync_run_id, code, severity, source_locator, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, issue.code, issue.severity, issue.sourceLocator || null, issue.message],
    );
  }
}

async function insertPlayoffResults(client: PoolClient, sourceId: string, sourceVersionId: string, parsed: ParsedSourceWorkbook) {
  for (const [index, result] of parsed.playoffResults.entries()) {
    await client.query(
      `INSERT INTO oraculo.source_competition_results(source_id, source_version_id, parser_version, item_order, record)
       VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING`,
      [sourceId, sourceVersionId, WORKBOOK_PARSER_VERSION, index + 1, JSON.stringify(result)],
    );
  }
}

async function finishFailedRun(pool: Pool, sourceId: string, runId: string, token: string, code: string, issues: WorkbookIssue[] = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertIssues(client, runId, issues);
    if (!issues.some((issue) => issue.severity === "error")) {
      await client.query(
        `INSERT INTO oraculo.import_issues(sync_run_id, code, severity, message)
         VALUES ($1, $2, 'error', 'A tentativa não foi publicada. Consulte o código do erro.')`,
        [runId, code],
      );
    }
    await client.query(
      `UPDATE oraculo.sync_runs SET status = 'failed', finished_at = now(), error_code = $2,
        counts = jsonb_build_object('errors', $3::integer, 'warnings', $4::integer) WHERE id = $1`,
      [runId, code, issues.filter((issue) => issue.severity === "error").length || 1, issues.filter((issue) => issue.severity === "warning").length],
    );
    await client.query("DELETE FROM oraculo.sync_leases WHERE source_id = $1 AND token = $2", [sourceId, token]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    logSyncFailure("finish_failed_run", error);
    throw new SyncServiceError("SYNC_STORAGE_UNAVAILABLE");
  } finally {
    client.release();
  }
}

async function getRecordedCompletion(pool: Pool, runId: string) {
  const result = await pool.query<{ status: string; version: string | null; counts: SyncCounts | null }>(
    `SELECT r.status, v.version::text AS version, r.counts
       FROM oraculo.sync_runs r
       LEFT JOIN oraculo.source_versions v ON v.id = r.version_id
      WHERE r.id = $1`,
    [runId],
  );
  const completed = result.rows[0];
  if (!completed || !["succeeded", "unchanged"].includes(completed.status) || completed.version === null) return null;
  const report = await pool.query<WorkbookIssue>(
    `SELECT code, severity, COALESCE(source_locator, '') AS "sourceLocator", message
       FROM oraculo.import_issues WHERE sync_run_id = $1 ORDER BY id`,
    [runId],
  );
  return {
    status: completed.status as "succeeded" | "unchanged",
    version: completed.version,
    counts: completed.counts ?? {} as SyncCounts,
    issues: report.rows,
  };
}

async function publish(
  pool: Pool,
  source: SourceRow,
  runId: string,
  token: string,
  candidate: Candidate,
  download: DownloadedSource,
  parsed: ParsedSourceWorkbook,
) {
  const client = await pool.connect();
  const counts: SyncCounts = {
    ...parsed.counts,
    playoffParserRevision: PLAYOFF_PARSER_REVISION,
    new: 0,
    changed: 0,
    unchanged: 0,
    absent: 0,
  };
  const issues = [...parsed.issues];
  try {
    await client.query("BEGIN");
    const lease = await client.query(
      "SELECT token FROM oraculo.sync_leases WHERE source_id = $1 AND token = $2 AND expires_at > now() FOR UPDATE",
      [source.id, token],
    );
    if (!lease.rowCount) throw new SyncServiceError("SYNC_LEASE_LOST");

    const existingVersionResult = await client.query<ExistingVersion>(
      "SELECT id, version::text, sha256 FROM oraculo.source_versions WHERE source_id = $1 AND version = $2::bigint",
      [source.id, candidate.sourceVersion],
    );
    const currentResult = await client.query<{ id: string; version: string; sha256: string }>(
      `SELECT sv.id, sv.version::text, sv.sha256
         FROM oraculo.source_publications p
         JOIN oraculo.source_versions sv ON sv.source_id = p.source_id AND sv.id = p.source_version_id
        WHERE p.source_id = $1 FOR UPDATE OF p`,
      [source.id],
    );
    const current = currentResult.rows[0];
    const existingVersion = existingVersionResult.rows[0];

    if (existingVersion && existingVersion.sha256 !== download.sha256) throw new SyncServiceError("SOURCE_VERSION_CONTENT_CONFLICT");
    if (current && BigInt(candidate.sourceVersion) < BigInt(current.version)) throw new SyncServiceError("SOURCE_VERSION_REGRESSION");
    if (current && candidate.sourceVersion === current.version && current.sha256 === download.sha256) {
      await insertPlayoffResults(client, source.id, current.id, parsed);
      await insertIssues(client, runId, issues);
      await client.query(
        `UPDATE oraculo.sync_runs SET status = 'unchanged', version_id = $2, finished_at = now(), counts = $3::jsonb
          WHERE id = $1`,
        [runId, current.id, JSON.stringify(counts)],
      );
      await client.query("DELETE FROM oraculo.sync_leases WHERE source_id = $1 AND token = $2", [source.id, token]);
      await client.query("COMMIT");
      return { status: "unchanged" as const, version: candidate.sourceVersion, counts, issues };
    }

    const identityKeys = parsed.albums.map((album) => album.identityKey);
    const existingAlbumsResult = await client.query<ExistingAlbum>(
      `SELECT a.id, a.identity_key, st.record, st.is_present, oe.total::text,
              oe.sound::text, oe.identity::text, oe.consistency::text, oe.replay::text
         FROM oraculo.albums a
         LEFT JOIN oraculo.source_album_state st ON st.source_id = a.source_id AND st.album_id = a.id
         LEFT JOIN oraculo.original_evaluations oe ON oe.album_id = a.id
        WHERE a.source_id = $1`,
      [source.id],
    );
    const knownAlbums = new Map(existingAlbumsResult.rows.map((row) => [row.identity_key, row]));
    const includedKeys = new Set(identityKeys);
    const removed = existingAlbumsResult.rows.filter((row) => row.is_present && !includedKeys.has(row.identity_key));
    const added = parsed.albums.filter((album) => !knownAlbums.has(album.identityKey));
    if (removed.length && added.length) throw new SyncServiceError("IDENTITY_CHANGE_AMBIGUOUS");

    for (const album of parsed.albums) {
      const existing = knownAlbums.get(album.identityKey);
      if (existing?.total !== null && existing?.total !== undefined && Number(existing.total) !== album.originalScore) {
        throw new SyncServiceError("ORIGINAL_SCORE_CHANGED");
      }
      if (existing?.total !== null && existing?.total !== undefined && [existing.sound, existing.identity, existing.consistency, existing.replay].some((value, index) =>
        (value === null ? null : Number(value)) !== [album.soundScore, album.identityScore, album.consistencyScore, album.replayScore][index])) {
        throw new SyncServiceError("ORIGINAL_PILLARS_CHANGED");
      }
    }

    if (existingVersion) throw new SyncServiceError("SOURCE_VERSION_NOT_CURRENT");
    const versionInsert = await client.query<{ id: string }>(
      `INSERT INTO oraculo.source_versions(source_id, version, drive_file_id, file_name, modified_at,
          sha256, parser_version, reference_date, summary)
       VALUES ($1, $2::bigint, $3, $4, $5::timestamptz, $6, $7, $8, $9::jsonb)
       RETURNING id`,
      [source.id, candidate.sourceVersion, candidate.file.id, candidate.file.name, candidate.file.modifiedTime,
        download.sha256, WORKBOOK_PARSER_VERSION, parsed.referenceDate, JSON.stringify(parsed.summary)],
    );
    const sourceVersionId = versionInsert.rows[0].id;
    await insertPlayoffResults(client, source.id, sourceVersionId, parsed);

    const albumIds: string[] = [];
    for (const album of parsed.albums) {
      let existing = knownAlbums.get(album.identityKey);
      if (!existing) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO oraculo.albums(source_id, identity_key, artist, title)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [source.id, album.identityKey, album.artist, album.title],
        );
        existing = { id: inserted.rows[0].id, identity_key: album.identityKey, record: null, is_present: null, total: null, sound: null, identity: null, consistency: null, replay: null };
        knownAlbums.set(album.identityKey, existing);
      }
      if (existing.total === null) {
        await client.query(
          `INSERT INTO oraculo.original_evaluations(album_id, source_version_id, source_locator, total, sound, identity, consistency, replay)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [existing.id, sourceVersionId, `Albuns ${source.season}!${album.sourceRow}`, album.originalScore,
            album.soundScore, album.identityScore, album.consistencyScore, album.replayScore],
        );
      }

      const record = Object.fromEntries(Object.entries(album).filter(([key]) => key !== "identityKey"));
      const recordJson = JSON.stringify(record);
      await client.query(
        `INSERT INTO oraculo.source_album_records(source_id, source_version_id, album_id, source_locator, record)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [source.id, sourceVersionId, existing.id, `Albuns ${source.season}!${album.sourceRow}`, recordJson],
      );
      await client.query(
        `INSERT INTO oraculo.source_album_state AS current_state(source_id, album_id, record, last_seen_source_version_id, is_present)
         VALUES ($1, $2, $3::jsonb, $4, true)
         ON CONFLICT (source_id, album_id) DO UPDATE SET
           record = EXCLUDED.record,
           last_seen_source_version_id = EXCLUDED.last_seen_source_version_id,
           is_present = true,
           last_changed_at = CASE
             WHEN current_state.record IS DISTINCT FROM EXCLUDED.record OR NOT current_state.is_present THEN now()
             ELSE current_state.last_changed_at END`,
        [source.id, existing.id, recordJson, sourceVersionId],
      );
      if (!existing.record) counts.new += 1;
      else if (stableJson(existing.record) === stableJson(record)) counts.unchanged += 1;
      else counts.changed += 1;
      albumIds.push(existing.id);
    }

    const absentRows = existingAlbumsResult.rows.filter((row) => row.is_present && !includedKeys.has(row.identity_key));
    counts.absent = absentRows.length;
    if (albumIds.length) {
      await client.query(
        `UPDATE oraculo.source_album_state SET is_present = false
          WHERE source_id = $1 AND is_present AND NOT (album_id = ANY($2::uuid[]))`,
        [source.id, albumIds],
      );
    }
    issues.push(...absentRows.map(() => ({
      code: "ALBUM_ABSENT",
      severity: "warning" as const,
      sourceLocator: "",
      message: "Um registro conhecido não reaparece nesta versão; seus dados foram mantidos.",
    })));

    for (const item of parsed.backlog) {
      await client.query(
        `INSERT INTO oraculo.source_backlog_records(source_id, source_version_id, item_order, record)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [source.id, sourceVersionId, item.order, JSON.stringify(item)],
      );
    }
    await insertIssues(client, runId, issues);
    await client.query(
      `INSERT INTO oraculo.source_publications(source_id, source_version_id)
       VALUES ($1, $2)
       ON CONFLICT (source_id) DO UPDATE SET source_version_id = EXCLUDED.source_version_id, published_at = now()`,
      [source.id, sourceVersionId],
    );
    await client.query(
      `UPDATE oraculo.sync_runs SET status = 'succeeded', version_id = $2, finished_at = now(), counts = $3::jsonb
        WHERE id = $1`,
      [runId, sourceVersionId, JSON.stringify({ ...counts, errors: 0, warnings: issues.filter((issue) => issue.severity === "warning").length })],
    );
    await client.query("DELETE FROM oraculo.sync_leases WHERE source_id = $1 AND token = $2", [source.id, token]);
    await client.query("COMMIT");
    counts.warnings = issues.filter((issue) => issue.severity === "warning").length;
    return { status: "succeeded" as const, version: candidate.sourceVersion, counts, issues };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error instanceof SyncServiceError) throw error;
    logSyncFailure("publish", error);
    throw new SyncServiceError("SYNC_PUBLICATION_FAILED");
  } finally {
    client.release();
  }
}

export async function syncDriveSource(userId: string) {
  const season = safeSeason();
  const pool = databasePool("sync");
  const source = await getConfiguredSource(pool, season);
  const { runId, token } = await acquireLeaseAndStartRun(pool, source.id, userId);
  let finished = false;
  let issues: WorkbookIssue[] = [];
  try {
    const folder = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const reader = configuredDriveReader();
    const candidate = await reader.latest(folder, season);
    const download = await reader.download(candidate);
    await recordCandidate(pool, runId, candidate, download.sha256);
    await rejectChangedAttemptedVersion(pool, source.id, runId, candidate.sourceVersion, download.sha256);
    const parsed = await parseSourceWorkbook(download.bytes, { season, sourceVersion: candidate.sourceVersion });
    issues = parsed.issues;
    if (!parsed.canPublish) throw new SyncServiceError("WORKBOOK_INVALID", issues);
    const result = await publish(pool, source, runId, token, candidate, download, parsed);
    finished = true;
    return result;
  } catch (error) {
    const code = error instanceof SyncServiceError
      ? error.code
      : error instanceof SourceError || error instanceof WorkbookParseError
        ? error.code
        : "SYNC_FAILED";
    logSyncFailure("sync", error);
    if (error instanceof SyncServiceError && error.issues.length) issues = error.issues;
    if (code === "SYNC_PUBLICATION_FAILED") {
      try {
        const completed = await getRecordedCompletion(pool, runId);
        if (completed) {
          finished = true;
          return completed;
        }
      } catch {
        // An unavailable status query leaves the ordinary failure handling in place.
      }
    }
    await finishFailedRun(pool, source.id, runId, token, code, issues);
    finished = true;
    if (error instanceof SyncServiceError) throw error;
    throw new SyncServiceError(code, issues);
  } finally {
    if (!finished) await finishFailedRun(pool, source.id, runId, token, "SYNC_FAILED").catch(() => {});
  }
}
