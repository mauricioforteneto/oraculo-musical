import "server-only";
import type { BacklogRecord, LocalSourcePreview, PublishedPlayoffResult } from "./types";
import { databasePool } from "@/lib/db/pool";
import { WORKBOOK_PARSER_VERSION, PLAYOFF_PARSER_REVISION } from "@/lib/ingestion/workbook-parser";
import { PUBLISHED_PLAYOFF_RESULTS_SQL } from "@/lib/competition/results-query";

type PublishedSourceRow = {
  source_id: string;
  version: string | null;
  reference_date: string | null;
  summary: Record<string, string> | null;
  source_version_id: string | null;
  published_at: string | null;
};

type SyncRunRow = {
  id: string;
  status: NonNullable<LocalSourcePreview["lastAttempt"]>["status"];
  started_at: string;
  finished_at: string | null;
  version: string | null;
  is_current_publication: boolean;
  error_code: string | null;
  counts: Record<string, number>;
  issue_count: number;
};

type ImportIssueRow = {
  code: string;
  severity: "warning" | "error";
  sourceLocator: string;
  message: string;
};

export async function getPublishedSource(season: number, folderId: string): Promise<LocalSourcePreview | null> {
  if (!Number.isInteger(season) || !folderId) return null;
  const pool = databasePool("read");
  const client = await pool.connect();
  try {
    const published = await client.query<PublishedSourceRow>(
      `SELECT s.id AS source_id, sv.version::text, sv.reference_date, sv.summary,
              sv.id AS source_version_id, p.published_at::text
         FROM oraculo.sources s
         LEFT JOIN oraculo.source_publications p ON p.source_id = s.id
         LEFT JOIN oraculo.source_versions sv ON sv.source_id = p.source_id AND sv.id = p.source_version_id
        WHERE s.season = $1 AND s.folder_id = $2`,
      [season, folderId],
    );
    const source = published.rows[0];
    if (!source) return null;

    const historyResult = await client.query<SyncRunRow>(
      `SELECT r.id, r.status, r.started_at::text, r.finished_at::text,
              COALESCE(v.version::text, r.candidate_version::text) AS version,
              COALESCE(p.source_version_id = r.version_id, false) AS is_current_publication,
              r.error_code, r.counts,
              (SELECT count(*)::integer FROM oraculo.import_issues i WHERE i.sync_run_id = r.id) AS issue_count
         FROM oraculo.sync_runs r
         LEFT JOIN oraculo.source_versions v ON v.id = r.version_id
         LEFT JOIN oraculo.source_publications p ON p.source_id = r.source_id
        WHERE r.source_id = $1
        ORDER BY r.started_at DESC
        LIMIT 8`,
      [source.source_id],
    );
    const history = historyResult.rows;
    const latestRun = history[0];
    const issues = latestRun
      ? await client.query<ImportIssueRow>(
        `SELECT code, severity, COALESCE(source_locator, '') AS "sourceLocator", message
           FROM oraculo.import_issues
          WHERE sync_run_id = $1
          ORDER BY id`,
        [latestRun.id],
      )
      : null;

    const [albumRows, backlogRows, playoffResultRows] = source.source_version_id ? await Promise.all([
      client.query<{ record: LocalSourcePreview["albums"][number]; is_present: boolean; album_id: string }>(
        `SELECT st.record, st.is_present, st.album_id
           FROM oraculo.source_album_state st
          WHERE st.source_id = $1
          ORDER BY (st.record->>'originalScore')::numeric DESC NULLS LAST,
                   st.record->>'artist', st.record->>'title'`,
        [source.source_id],
      ),
      client.query<{ record: BacklogRecord }>(
        `SELECT record FROM oraculo.source_backlog_records
          WHERE source_id = $1 AND source_version_id = $2
          ORDER BY item_order`,
        [source.source_id, source.source_version_id],
      ),
      client.query<{ record: PublishedPlayoffResult }>(
        PUBLISHED_PLAYOFF_RESULTS_SQL,
        [source.source_id, source.source_version_id, WORKBOOK_PARSER_VERSION, String(PLAYOFF_PARSER_REVISION)],
      ),
    ]) : [{ rows: [] }, { rows: [] }, { rows: [] }];

    return {
      version: source.version,
      referenceDate: source.reference_date ?? "",
      publishedAt: source.published_at,
      lastAttempt: latestRun ? {
        status: latestRun.status,
        startedAt: latestRun.started_at,
        finishedAt: latestRun.finished_at,
        errorCode: latestRun.error_code,
        counts: latestRun.counts ?? {},
        issues: issues?.rows ?? [],
      } : null,
      attemptHistory: history.map((run) => ({
        status: run.status,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        version: run.version,
        isCurrentPublication: run.is_current_publication,
        errorCode: run.error_code,
        issueCount: run.issue_count,
      })),
      summary: source.summary ?? {},
      albums: albumRows.rows.map(({ record, is_present, album_id }) => ({ ...record, isPresent: is_present, albumId: album_id })),
      backlog: backlogRows.rows.map(({ record }) => record),
      playoffResults: playoffResultRows.rows.map(({ record }) => record),
    };
  } finally {
    client.release();
  }
}
