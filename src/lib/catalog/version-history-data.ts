import { PLAYOFF_EXTRACTION_VERSION, PLAYOFF_PARSER_REVISION } from "@/lib/ingestion/workbook-parser";
import { PUBLISHED_PLAYOFF_RESULTS_SQL } from "@/lib/competition/results-query";
import { comparePublishedVersions, HISTORY_DOMAINS, historyBlockAvailable, makeHistoryRecord,
  type HistoryDomain, type HistoryRecord, type HistorySnapshot, type HistoryVersion, type VersionHistoryData } from "./version-history";

export type HistoryQuery = <Row extends Record<string, unknown>>(sql: string, params: unknown[]) => Promise<{ rows: Row[] }>;
type VersionRow = Record<string, unknown> & { id: string; source_id: string; version: string; file_name: string; modified_at: string;
  imported_at: string | null; is_current: boolean; parser_version: string; counts: Record<string, unknown> | null; extraction_ready: boolean };
type RecordRow = Record<string, unknown> & { record: Record<string, unknown>; key?: string; source_locator?: string; version?: string };

// Every public version lookup is scoped to the configured source, bounded by its
// current publication, and requires a successful run (or the current pointer).
const VERSION_SCOPE = `WITH scoped AS (
  SELECT s.id, p.source_version_id, current.version AS current_version
    FROM oraculo.sources s JOIN oraculo.source_publications p ON p.source_id=s.id
    JOIN oraculo.source_versions current ON current.id=p.source_version_id AND current.source_id=s.id
   WHERE s.season=$1 AND s.folder_id=$2
), available AS (
  SELECT v.id, v.source_id, v.version::text, v.file_name, v.modified_at::text, v.parser_version,
         (v.id=s.source_version_id) AS is_current, first_run.imported_at, first_run.counts,
         EXISTS (SELECT 1 FROM oraculo.sync_runs r WHERE r.source_id=v.source_id AND r.version_id=v.id
           AND r.status IN ('succeeded','unchanged') AND r.counts->>'playoffParserRevision'='${PLAYOFF_PARSER_REVISION}') AS extraction_ready
    FROM scoped s JOIN oraculo.source_versions v ON v.source_id=s.id AND v.version<=s.current_version
    LEFT JOIN LATERAL (SELECT r.finished_at::text AS imported_at, r.counts FROM oraculo.sync_runs r
       WHERE r.source_id=v.source_id AND r.version_id=v.id AND r.status IN ('succeeded','unchanged')
       ORDER BY r.finished_at, r.id LIMIT 1) first_run ON true
   WHERE first_run.imported_at IS NOT NULL OR v.id=s.source_version_id
)`;
export const HISTORY_SELECTED_SQL = `${VERSION_SCOPE} SELECT * FROM available WHERE
  ($3::bigint IS NULL AND is_current) OR version::bigint=$3::bigint`;
export const HISTORY_VERSIONS_SQL = `${VERSION_SCOPE} SELECT * FROM available ORDER BY version::bigint DESC LIMIT 21 OFFSET $3`;
export const HISTORY_PREVIOUS_SQL = `${VERSION_SCOPE} SELECT * FROM available WHERE version::bigint<$3::bigint ORDER BY version::bigint DESC LIMIT 1`;

function meta(row: VersionRow): HistoryVersion {
  return { version: row.version, fileName: row.file_name, modifiedAt: row.modified_at, importedAt: row.imported_at, isCurrent: row.is_current };
}

async function snapshot(query: HistoryQuery, row: VersionRow): Promise<HistorySnapshot> {
  const [albums, backlog, playoffs] = await Promise.all([
    query<RecordRow>(`SELECT a.identity_key AS key,r.record,r.source_locator FROM oraculo.source_album_records r
      JOIN oraculo.albums a ON a.id=r.album_id AND a.source_id=r.source_id WHERE r.source_id=$1 AND r.source_version_id=$2`, [row.source_id, row.id]),
    query<RecordRow>("SELECT record FROM oraculo.source_backlog_records WHERE source_id=$1 AND source_version_id=$2 ORDER BY item_order", [row.source_id, row.id]),
    query<RecordRow>(PUBLISHED_PLAYOFF_RESULTS_SQL, [row.source_id, row.id, PLAYOFF_EXTRACTION_VERSION, String(PLAYOFF_PARSER_REVISION)]),
  ]);
  return { version: meta(row), blocks: {
    albums: { available: historyBlockAvailable(albums.rows.length, row.counts?.albums), records: albums.rows.map(r => makeHistoryRecord("albums", r.record, row.version, r.key, r.source_locator)) },
    backlog: { available: historyBlockAvailable(backlog.rows.length, row.counts?.backlog), records: backlog.rows.map(r => makeHistoryRecord("backlog", r.record, row.version)) },
    playoffs: { available: historyBlockAvailable(playoffs.rows.length, undefined, row.extraction_ready || row.parser_version === "2026.2"),
      records: playoffs.rows.map(r => makeHistoryRecord("playoffs", r.record, row.version)) },
  } };
}

// JSONB keys mirror the pure comparator. Dense rank keeps duplicate identities
// in the latest occurrence, allowing the comparator to report the ambiguity.
function earlierSQL(domain: HistoryDomain) {
  const table = domain === "albums" ? "source_album_records" : domain === "backlog" ? "source_backlog_records" : "source_competition_results";
  const key = domain === "albums" ? "to_jsonb(a.identity_key)" : domain === "backlog"
    ? "jsonb_build_array(normalize(btrim(r.record->>'artist'),NFC),normalize(btrim(r.record->>'title'),NFC))"
    : `CASE WHEN COALESCE(r.record->>'phase','first')='first' THEN jsonb_build_array('first',LEAST((r.record->>'seedA')::int,(r.record->>'seedB')::int),GREATEST((r.record->>'seedA')::int,(r.record->>'seedB')::int))
      ELSE jsonb_build_array(r.record->>'phase',r.record->>'gameId') END`;
  return `WITH candidates AS (
    SELECT ${key} AS key,r.record,v.version,${domain === "albums" ? "r.source_locator" : "NULL::text"} AS source_locator
      FROM oraculo.${table} r JOIN oraculo.source_versions v ON v.id=r.source_version_id AND v.source_id=r.source_id
      ${domain === "albums" ? "JOIN oraculo.albums a ON a.id=r.album_id AND a.source_id=r.source_id" : ""}
     WHERE r.source_id=$1 AND v.version<$2::bigint
       AND EXISTS (SELECT 1 FROM oraculo.sync_runs run WHERE run.source_id=v.source_id AND run.version_id=v.id AND run.status IN ('succeeded','unchanged'))
       ${domain === "playoffs" ? `AND r.parser_version=CASE WHEN EXISTS (SELECT 1 FROM oraculo.sync_runs run WHERE run.source_id=v.source_id AND run.version_id=v.id AND run.status IN ('succeeded','unchanged') AND run.counts->>'playoffParserRevision'=$5::text) THEN $4 ELSE '2026.2' END` : ""}
  ), matching AS (SELECT * FROM candidates WHERE key IN (SELECT value FROM jsonb_array_elements($3::jsonb))),
  ranked AS (SELECT *,dense_rank() OVER (PARTITION BY key ORDER BY version DESC) AS occurrence FROM matching)
  SELECT key::text,record,version::text,source_locator FROM ranked WHERE occurrence=1`;
}

function versionParameter(value: unknown): string | null {
  return typeof value === "string" && /^\d{1,19}$/.test(value) && BigInt(value) <= 9223372036854775807n ? BigInt(value).toString() : null;
}

export async function loadVersionHistory(query: HistoryQuery, season: number, folder: string, requestedVersion?: unknown, requestedPage?: unknown): Promise<VersionHistoryData | null> {
  const notices: string[] = [];
  const requested = versionParameter(requestedVersion);
  if (requestedVersion !== undefined && requested === null) notices.push("Versão inválida; exibindo a publicação atual.");
  let selected = (await query<VersionRow>(HISTORY_SELECTED_SQL, [season, folder, requested])).rows[0];
  if (!selected && requested !== null) {
    notices.push("Versão indisponível nesta fonte; exibindo a publicação atual.");
    selected = (await query<VersionRow>(HISTORY_SELECTED_SQL, [season, folder, null])).rows[0];
  }
  if (!selected) return null;
  let page = typeof requestedPage === "string" && /^[1-9]\d{0,8}$/.test(requestedPage) ? Number(requestedPage) : 1;
  if (requestedPage !== undefined && String(page) !== requestedPage) notices.push("Página inválida; exibindo as publicações mais recentes.");
  let listing = (await query<VersionRow>(HISTORY_VERSIONS_SQL, [season, folder, (page - 1) * 20])).rows;
  if (!listing.length && page !== 1) {
    notices.push("Página indisponível; exibindo as publicações mais recentes."); page = 1;
    listing = (await query<VersionRow>(HISTORY_VERSIONS_SQL, [season, folder, 0])).rows;
  }
  const previous = (await query<VersionRow>(HISTORY_PREVIOUS_SQL, [season, folder, selected.version])).rows[0];
  const after = await snapshot(query, selected);
  const before = previous ? await snapshot(query, previous) : null;
  const earlier: Partial<Record<HistoryDomain, HistoryRecord[]>> = {};
  if (before) for (const { id } of HISTORY_DOMAINS) {
    if (!before.blocks[id].available || !after.blocks[id].available) continue;
    const oldKeys = new Set(before.blocks[id].records.map(r => r.key));
    const keys = [...new Set(after.blocks[id].records.filter(r => !oldKeys.has(r.key)).map(r => r.key))];
    if (!keys.length) continue;
    const params: unknown[] = [selected.source_id, previous.version, JSON.stringify(id === "albums" ? keys : keys.map(k => JSON.parse(k)))];
    if (id === "playoffs") params.push(PLAYOFF_EXTRACTION_VERSION, String(PLAYOFF_PARSER_REVISION));
    const rows = await query<RecordRow>(earlierSQL(id), params);
    earlier[id] = rows.rows.map(r => makeHistoryRecord(id, r.record, r.version!, id === "albums" ? JSON.parse(r.key!) : undefined, r.source_locator));
  }
  return { versions: listing.slice(0, 20).map(meta), selected: meta(selected), previous: previous ? meta(previous) : null,
    comparison: comparePublishedVersions(before, after, earlier), page, hasMore: listing.length > 20, notices };
}
