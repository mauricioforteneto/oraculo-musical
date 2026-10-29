import type { PoolClient } from "pg";
import type { Top50ManualDecision } from "@/lib/catalog/types";
import { TOP50_DECISION_PARSER_REVISION } from "./manual-decisions";

export const PUBLISHED_TOP50_DECISIONS_SQL = `SELECT record FROM oraculo.source_top50_decisions
  WHERE source_id=$1 AND source_version_id=$2 AND parser_revision=$3
    AND EXISTS (SELECT 1 FROM oraculo.sync_runs WHERE source_id=$1 AND version_id=$2
      AND status IN ('succeeded','unchanged') AND counts->>'top50DecisionParserRevision'=$3::text)
  ORDER BY item_order`;

export async function insertTop50Decisions(client: Pick<PoolClient, "query">, sourceId: string, versionId: string, decisions: Top50ManualDecision[]) {
  for (const [index, record] of decisions.entries()) await client.query(`INSERT INTO oraculo.source_top50_decisions
    (source_id,source_version_id,parser_revision,item_order,record) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
  [sourceId, versionId, TOP50_DECISION_PARSER_REVISION, index + 1, JSON.stringify(record)]);
}

export async function readTop50Decisions(client: Pick<PoolClient, "query">, sourceId: string, versionId: string) {
  const available = await client.query<{ relation: string | null }>("SELECT to_regclass('oraculo.source_top50_decisions')::text AS relation");
  if (!available.rows[0]?.relation) return { records: [] as Top50ManualDecision[], ready: false, extracted: false };
  const extraction = await client.query<{ extracted: boolean }>(`SELECT EXISTS (SELECT 1 FROM oraculo.sync_runs
    WHERE source_id=$1 AND version_id=$2 AND status IN ('succeeded','unchanged')
      AND counts->>'top50DecisionParserRevision'=$3::text) AS extracted`, [sourceId, versionId, TOP50_DECISION_PARSER_REVISION]);
  if (!extraction.rows[0]?.extracted) return { records: [] as Top50ManualDecision[], ready: true, extracted: false };
  const result = await client.query<{ record: Top50ManualDecision }>(PUBLISHED_TOP50_DECISIONS_SQL,
    [sourceId, versionId, TOP50_DECISION_PARSER_REVISION]);
  return { records: result.rows.map(row => row.record), ready: true, extracted: true };
}
