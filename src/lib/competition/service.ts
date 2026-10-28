import "server-only";
import { databasePool } from "@/lib/db/pool";
import { configuredDriveReader } from "@/lib/ingestion/google";
import { SourceError } from "@/lib/ingestion/drive";
import { parseSourceWorkbook, WorkbookParseError, WORKBOOK_PARSER_VERSION } from "@/lib/ingestion/workbook";
import type { AlbumRecord, PublishedPlayoffResult } from "@/lib/catalog/types";
import { albumIdentity, buildParticipants, CUTOFF_UTC, firstRound, participantChanges, RULES_VERSION, type Participant } from "./rules";
import { projectTop50 } from "./top50";
import { freezeTokenMatches, type FreezeToken } from "./token";
export type { FreezeToken } from "./token";

export class CompetitionError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "CompetitionError"; }
}
export type FreezeMode = "initial" | "correction";
type FreezeRow = { id: string; file_name: string; file_version: string; sha256: string; frozen_at: string; frozen_by: string; correction_reason: string | null; supersedes_id: string | null; cutoff_album_keys: string[] };
type ParticipantRow = { identity_key: string; artist: string; title: string; original_score: string; route: Participant["route"]; seed: number; source_row: number; evidence: Record<string, unknown> };

function configuration() {
  const season = Number(process.env.SOURCE_SEASON ?? "2026");
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (season !== 2026 || !folder) throw new CompetitionError("COMPETITION_NOT_CONFIGURED");
  return { season, folder };
}
async function sourceId(role: "read" | "sync", season: number, folder: string) {
  const result = await databasePool(role).query<{ id: string }>("SELECT id FROM oraculo.sources WHERE season=$1 AND folder_id=$2", [season, folder]);
  if (result.rows.length !== 1) throw new CompetitionError("SOURCE_NOT_REGISTERED");
  return result.rows[0].id;
}
async function activeFor(role: "read" | "sync", id: string) {
  const pool = databasePool(role);
  const result = await pool.query<FreezeRow>(`SELECT f.id, f.file_name, f.file_version::text, f.sha256, f.frozen_at::text,
       f.frozen_by::text, f.correction_reason, f.supersedes_id, f.cutoff_album_keys
       FROM oraculo.competition_freeze_publications p JOIN oraculo.competition_freezes f ON f.id=p.freeze_id
       WHERE p.source_id=$1`, [id]);
  const freeze = result.rows[0];
  if (!freeze) return null;
  const rows = await pool.query<ParticipantRow>(`SELECT identity_key, artist, title, original_score::text, route, seed, source_row, evidence
    FROM oraculo.competition_freeze_participants WHERE freeze_id=$1 ORDER BY seed`, [freeze.id]);
  return { ...freeze, participants: rows.rows.map(p => ({ identityKey: p.identity_key, artist: p.artist, title: p.title, originalScore: Number(p.original_score), route: p.route, seed: p.seed, sourceRow: p.source_row, evidence: p.evidence })) };
}
async function participantsFor(role: "read" | "sync", freezeId: string): Promise<Participant[]> {
  const rows = await databasePool(role).query<ParticipantRow>(`SELECT identity_key, artist, title, original_score::text, route, seed, source_row, evidence
    FROM oraculo.competition_freeze_participants WHERE freeze_id=$1 ORDER BY seed`, [freezeId]);
  return rows.rows.map(p => ({ identityKey: p.identity_key, artist: p.artist, title: p.title, originalScore: Number(p.original_score), route: p.route, seed: p.seed, sourceRow: p.source_row, evidence: p.evidence }));
}
export async function getCompetitionState(albums: AlbumRecord[], results: PublishedPlayoffResult[]) {
  const { season, folder } = configuration();
  const id = await sourceId("read", season, folder);
  const active = await activeFor("read", id);
  const history = await databasePool("read").query<{ id: string; file_name: string; file_version: string; frozen_at: string; correction_reason: string | null; supersedes_id: string | null }>(
    `SELECT id, file_name, file_version::text, frozen_at::text, correction_reason, supersedes_id FROM oraculo.competition_freezes WHERE source_id=$1 ORDER BY frozen_at DESC LIMIT 10`, [id]);
  const audit = await Promise.all(history.rows.map(async row => ({ ...row, changes: row.supersedes_id
    ? participantChanges(await participantsFor("read", row.supersedes_id), await participantsFor("read", row.id)) : null })));
  return { cutoff: CUTOFF_UTC, active: active ? { id: active.id, fileName: active.file_name, fileVersion: active.file_version,
    sha256: active.sha256, frozenAt: active.frozen_at, frozenBy: active.frozen_by, participants: active.participants,
    correctionReason: active.correction_reason, bracket: firstRound(active.participants) } : null,
    projection: active ? projectTop50(albums, active.participants, results, active.cutoff_album_keys) : null,
    history: audit.map(row => ({ id: row.id, fileName: row.file_name, fileVersion: row.file_version, frozenAt: row.frozen_at, correctionReason: row.correction_reason, changes: row.changes })) };
}

async function chosen(mode: FreezeMode, season: number, folder: string) {
  const reader = configuredDriveReader();
  const candidate = mode === "correction" ? await reader.latest(folder, season, undefined, CUTOFF_UTC)
    : Date.now() < Date.parse(CUTOFF_UTC) ? await reader.latest(folder, season) : await reader.latest(folder, season, CUTOFF_UTC);
  return { reader, candidate };
}
async function expectedClassified(id: string) {
  const rows = await databasePool("read").query<{ identity_key: string }>(`SELECT a.identity_key FROM oraculo.source_album_state st
    JOIN oraculo.albums a ON a.id=st.album_id
    JOIN oraculo.source_publications p ON p.source_id=st.source_id
    JOIN oraculo.source_versions v ON v.id=p.source_version_id
    WHERE st.source_id=$1 AND st.is_present AND v.modified_at < $2
      AND (st.record->>'playoffSeed') IS NOT NULL`, [id, CUTOFF_UTC]);
  return rows.rows.map(row => row.identity_key);
}
async function originalScoreIssues(id: string, participants: Participant[], role: "read" | "sync") {
  const rows = await databasePool(role).query<{ identity_key: string; total: string }>(`SELECT a.identity_key, o.total::text FROM oraculo.albums a
    JOIN oraculo.original_evaluations o ON o.album_id=a.id WHERE a.source_id=$1`, [id]);
  const originals = new Map(rows.rows.map(row => [row.identity_key, Number(row.total)]));
  return participants.filter(p => originals.has(p.identityKey) && originals.get(p.identityKey) !== p.originalScore)
    .map(p => ({ code: "ORIGINAL_SCORE_CHANGED", severity: "error" as const,
      message: "Nota original difere da avaliação imutável já registrada.", sourceRow: p.sourceRow }));
}
export async function previewFreeze(mode: FreezeMode) {
  const { season, folder } = configuration();
  const id = await sourceId("read", season, folder);
  const active = await activeFor("read", id);
  if ((mode === "initial" && active) || (mode === "correction" && !active)) throw new CompetitionError("FREEZE_MODE_CONFLICT");
  const { reader, candidate } = await chosen(mode, season, folder);
  if (active && BigInt(candidate.sourceVersion) <= BigInt(active.file_version)) throw new CompetitionError("CORRECTION_VERSION_NOT_NEWER");
  const downloaded = await reader.download(candidate);
  const parsed = await parseSourceWorkbook(downloaded.bytes, { season, sourceVersion: candidate.sourceVersion });
  const built = buildParticipants(parsed.albums, mode === "initial" ? await expectedClassified(id) : []);
  const originalIssues = await originalScoreIssues(id, built.participants, "read");
  const frozenOriginals = new Map((active?.participants ?? []).map(p => [p.identityKey, p.originalScore]));
  const frozenIssues = built.participants.filter(p => frozenOriginals.has(p.identityKey) && frozenOriginals.get(p.identityKey) !== p.originalScore)
    .map(p => ({ code: "FROZEN_ORIGINAL_CHANGED", severity: "error" as const, message: "Correção não pode alterar a nota original de participante já congelado.", sourceRow: p.sourceRow }));
  const issues = [...parsed.issues, ...built.issues, ...originalIssues, ...frozenIssues];
  const canConfirm = parsed.canPublish && built.canFreeze && originalIssues.length === 0 && frozenIssues.length === 0 && (mode === "correction" || Date.now() >= Date.parse(CUTOFF_UTC));
  const changes = participantChanges(active?.participants ?? [], built.participants);
  return { mode, draft: Date.now() < Date.parse(CUTOFF_UTC), canConfirm, cutoff: CUTOFF_UTC,
    file: { id: candidate.file.id, name: candidate.file.name, version: candidate.sourceVersion, modifiedAt: candidate.file.modifiedTime, sha256: downloaded.sha256 },
    token: { fileId: candidate.file.id, fileVersion: candidate.sourceVersion, driveRevision: candidate.file.version, modifiedAt: candidate.file.modifiedTime,
      sha256: downloaded.sha256, activeFreezeId: active?.id ?? null } satisfies FreezeToken,
    participants: built.participants, issues, bracket: built.canFreeze ? firstRound(built.participants) : null, changes,
    projection: built.canFreeze ? projectTop50(parsed.albums, built.participants, parsed.playoffResults, parsed.albums.map(a => albumIdentity(a))) : null };
}

export async function confirmFreeze(input: { mode: FreezeMode; token: FreezeToken; backupAttested: boolean; eligibilityAttested?: boolean; noMatchAttested?: boolean; reason?: string }, userId: string) {
  if (!input.backupAttested) throw new CompetitionError("BACKUP_ATTESTATION_REQUIRED");
  if (Date.now() < Date.parse(CUTOFF_UTC)) throw new CompetitionError("CUTOFF_NOT_REACHED");
  if (input.mode === "correction" && (!input.eligibilityAttested || !input.noMatchAttested || !input.reason || input.reason.trim().length < 10)) throw new CompetitionError("CORRECTION_ATTESTATION_REQUIRED");
  const { season, folder } = configuration();
  const id = await sourceId("sync", season, folder);
  const { reader, candidate } = await chosen(input.mode, season, folder);
  const current = await activeFor("sync", id);
  if (current && BigInt(candidate.sourceVersion) <= BigInt(current.file_version)) throw new CompetitionError("CORRECTION_VERSION_NOT_NEWER");
  const downloaded = await reader.download(candidate);
  if (!freezeTokenMatches(candidate, input.token, downloaded.sha256)) throw new CompetitionError("FREEZE_PREVIEW_STALE");
  const latestAgain = input.mode === "correction" ? await reader.latest(folder, season, undefined, CUTOFF_UTC)
    : await reader.latest(folder, season, CUTOFF_UTC);
  if (!freezeTokenMatches(latestAgain, input.token, downloaded.sha256)) throw new CompetitionError("FREEZE_PREVIEW_STALE");
  const parsed = await parseSourceWorkbook(downloaded.bytes, { season, sourceVersion: candidate.sourceVersion });
  const built = buildParticipants(parsed.albums, input.mode === "initial" ? await expectedClassified(id) : []);
  if (!parsed.canPublish || !built.canFreeze || (await originalScoreIssues(id, built.participants, "sync")).length) throw new CompetitionError("FREEZE_SOURCE_INVALID");
  const pool = databasePool("sync");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
    const activeResult = await client.query<{ freeze_id: string }>("SELECT freeze_id FROM oraculo.competition_freeze_publications WHERE source_id=$1", [id]);
    const activeId = activeResult.rows[0]?.freeze_id ?? null;
    if (activeId !== input.token.activeFreezeId || (input.mode === "initial" && activeId) || (input.mode === "correction" && !activeId)) throw new CompetitionError("FREEZE_PREVIEW_STALE");
    if (input.mode === "correction") {
      const old = await client.query<{ identity_key: string; original_score: string }>(
        "SELECT identity_key, original_score::text FROM oraculo.competition_freeze_participants WHERE freeze_id=$1", [activeId]);
      const previous = new Map(old.rows.map(p => [p.identity_key, Number(p.original_score)]));
      if (built.participants.some(p => previous.has(p.identityKey) && previous.get(p.identityKey) !== p.originalScore)) throw new CompetitionError("FROZEN_ORIGINAL_CHANGED");
    }
    const freeze = await client.query<{ id: string }>(`INSERT INTO oraculo.competition_freezes
      (source_id, season, drive_file_id, file_name, file_version, drive_revision, modified_at, sha256, cutoff_album_keys,
       rules_version, parser_version, frozen_by, supersedes_id, correction_reason, eligibility_attested, backup_attested, no_match_attested)
      VALUES ($1, $2, $3, $4, $5::bigint, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
      [id, season, candidate.file.id, candidate.file.name, candidate.sourceVersion, candidate.file.version, candidate.file.modifiedTime,
        downloaded.sha256, JSON.stringify(parsed.albums.map(a => albumIdentity(a))), RULES_VERSION, WORKBOOK_PARSER_VERSION, userId, activeId,
        input.mode === "correction" ? input.reason!.trim() : null, input.mode === "correction", true, input.mode === "correction"]);
    const freezeId = freeze.rows[0].id;
    for (const p of built.participants) await client.query(`INSERT INTO oraculo.competition_freeze_participants
      (freeze_id, identity_key, artist, title, original_score, route, seed, source_row, evidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [freezeId, p.identityKey, p.artist, p.title, p.originalScore, p.route, p.seed, p.sourceRow, JSON.stringify(p.evidence)]);
    await client.query(`INSERT INTO oraculo.competition_freeze_publications(source_id,freeze_id) VALUES($1,$2)
      ON CONFLICT (source_id) DO UPDATE SET freeze_id=EXCLUDED.freeze_id, published_at=now()`, [id, freezeId]);
    await client.query("COMMIT");
    return { freezeId, participants: built.participants.length, fileVersion: candidate.sourceVersion };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error instanceof CompetitionError) throw error;
    console.error("Competition storage failure", { code: (error as { code?: string })?.code });
    throw new CompetitionError("FREEZE_STORAGE_UNAVAILABLE");
  } finally { client.release(); }
}

export function competitionFailure(error: unknown) {
  const code = error instanceof CompetitionError || error instanceof SourceError || error instanceof WorkbookParseError ? error.code : "COMPETITION_FAILED";
  const status = ["FREEZE_PREVIEW_STALE", "FREEZE_MODE_CONFLICT", "FROZEN_ORIGINAL_CHANGED", "CORRECTION_VERSION_NOT_NEWER", "AMBIGUOUS_VERSION", "FILE_CHANGED_DURING_READ"].includes(code) ? 409
    : ["FREEZE_SOURCE_INVALID", "CUTOFF_NOT_REACHED", "BACKUP_ATTESTATION_REQUIRED", "CORRECTION_ATTESTATION_REQUIRED", "INVALID_XLSX", "INVALID_XLSX_CONTAINER", "FILE_TOO_LARGE"].includes(code) ? 422
    : ["SOURCE_NOT_FOUND", "DRIVE_ACCESS_DENIED", "DRIVE_UNAVAILABLE", "DRIVE_RETRY_LATER", "INCOMPLETE_DRIVE_LIST"].includes(code) ? 502 : 503;
  return { code, status };
}
