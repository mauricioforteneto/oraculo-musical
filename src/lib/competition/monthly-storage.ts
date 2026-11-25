import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { AlbumRecord } from "@/lib/catalog/types";
import type { WorkbookIssue } from "@/lib/ingestion/workbook-parser";
import { buildMonthlyState, monthlyContext, confirmedStatus, validCalendarDate, localDay, MONTHLY_PARSER_REVISION,
  type MonthlyClosure, type MonthlyDecision, type MonthlySnapshot, type MonthlyState } from "./monthly";
import { MONTHLY_RULES } from "@/lib/seasons/definitions";
type Query = Pick<PoolClient, "query">;
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const semanticClosure = (row: MonthlyClosure) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "sourceRow"));
export function attachMonthlyHashes(state: MonthlyState, sourceId: string) {
  for (const month of state.months) month.contextHash = hash({sourceId, ...monthlyContext(month)});
  return state;
}
export async function readMonthlyState(client: Query, sourceId: string, versionId: string, version: string, albums: AlbumRecord[], now = new Date()) {
  const available = await client.query<{ ready: string | null }>("SELECT to_regclass('oraculo.source_monthly_records')::text AS ready");
  if (!available.rows[0]?.ready) return { ...attachMonthlyHashes(buildMonthlyState(albums, [], now), sourceId), sourceVersion: version, storageReady: false };
  const raw = await client.query<{ record: { decisions: MonthlyDecision[] } }>(`SELECT record FROM oraculo.source_monthly_records WHERE source_id=$1 AND source_version_id=$2 AND parser_revision=$3`, [sourceId, versionId, MONTHLY_PARSER_REVISION]);
  const state = attachMonthlyHashes(buildMonthlyState(albums, raw.rows[0]?.record.decisions ?? [], now), sourceId);
  state.sourceVersion = version;
  state.storageReady = raw.rows.length === 1;
  const closed = await client.query<{ record: MonthlySnapshot }>(`SELECT c.record FROM oraculo.monthly_publications p JOIN oraculo.monthly_closures c
    ON c.source_id=p.source_id AND c.month=p.month AND c.closure_id=p.closure_id WHERE p.source_id=$1`, [sourceId]);
  for (const row of closed.rows) {
    const month = state.months[row.record.month - 1];
    month.confirmed = row.record;
    month.changedSinceClosure = row.record.contextHash !== month.contextHash;
  }
  return state;
}

export async function publishMonthly(client: Query, sourceId: string, versionId: string, version: string,
  records: { decisions: MonthlyDecision[]; closures: MonthlyClosure[] }, issues: WorkbookIssue[], now = new Date()) {
  const data = await client.query<{ record: AlbumRecord; id: string }>(`SELECT st.record,st.album_id AS id FROM oraculo.source_album_state st WHERE st.source_id=$1`, [sourceId]);
  const albums = data.rows.map(row => ({ ...row.record, albumId: row.id }));
  const state = attachMonthlyHashes(buildMonthlyState(albums, records.decisions, now), sourceId);
  await client.query(`INSERT INTO oraculo.source_monthly_records(source_id,source_version_id,parser_revision,record) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
    [sourceId, versionId, MONTHLY_PARSER_REVISION, JSON.stringify(records)]);
  for (const month of state.months) await client.query(`INSERT INTO oraculo.monthly_contexts(source_id,source_version_id,month,rules_version,context_hash)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [sourceId, versionId, month.month, state.rulesVersion, month.contextHash]);
  const existing = await client.query<{ closure_id: string; month: number; input: Record<string, unknown>; record: MonthlySnapshot }>(
    `SELECT closure_id,month,input,record FROM oraculo.monthly_closures WHERE source_id=$1`, [sourceId]);
  const active = await client.query<{ month: number; closure_id: string }>(`SELECT month,closure_id FROM oraculo.monthly_publications WHERE source_id=$1 FOR UPDATE`, [sourceId]);
  const current = new Map(active.rows.map(row => [row.month, existing.rows.find(item => item.closure_id === row.closure_id)!.record]));
  const proposed = new Map<number, { row: MonthlyClosure; snapshot: MonthlySnapshot }>();
  const today = localDay(now);
  const addIssue = (row: MonthlyClosure, message: string) => issues.push({ code: "MONTHLY_CLOSURE_PENDING", severity: "warning", sourceLocator: `Fechamentos mensais!${row.sourceRow}`, message });
  for (const row of records.closures) {
    if (!confirmedStatus(row.status)) continue;
    const stored = existing.rows.find(item => item.closure_id === row.closureId);
    if (stored) {
      if (hash(stored.input) !== hash(semanticClosure(row))) addIssue(row, `Fechamento ${row.closureId} foi alterado. Use uma nova identificação e referência à correção.`);
      continue;
    }
    const month = state.months[(row.month ?? 0) - 1];
    if (!month || row.season !== 2027 || row.rulesVersion !== state.rulesVersion || !row.closureId || row.closureId.length > 100
      || !/^\d+$/.test(row.baseVersion) || BigInt(row.baseVersion) >= BigInt(version) || !/^[a-f0-9]{64}$/.test(row.contextHash)
      || !row.confirmedBy || !row.reference || !validCalendarDate(row.confirmedOn) || row.confirmedOn > today) {
      addIssue(row, "Fechamento com identificação, contexto ou confirmação inválida."); continue;
    }
    if (!month.closesOn || !month.periodEnded || row.confirmedOn <= month.closesOn) { addIssue(row, `${month.label}: período não encerrado ou calendário ainda indefinido.`); continue; }
    if (month.pending.length || row.contextHash !== month.contextHash) { addIssue(row, `${month.label}: contexto mudou ou existem pendências; copie uma nova orientação de fechamento.`); continue; }
    const base = await client.query<{ context_hash: string }>(`SELECT c.context_hash FROM oraculo.monthly_contexts c JOIN oraculo.source_versions v
      ON v.source_id=c.source_id AND v.id=c.source_version_id WHERE c.source_id=$1 AND v.version=$2::bigint AND c.month=$3 AND c.rules_version=$4`,
    [sourceId, row.baseVersion, row.month, row.rulesVersion]);
    if (base.rows[0]?.context_hash !== row.contextHash) { addIssue(row, "A versão-base não contém este contexto de fechamento nesta fonte."); continue; }
    const old = current.get(month.month);
    if ((old?.closureId ?? "") !== row.supersedes || (old && row.reason.trim().length < 10)) { addIssue(row, "Correção exige referência ao fechamento vigente e justificativa de pelo menos dez caracteres."); continue; }
    if (proposed.has(month.month) || records.closures.filter(item => confirmedStatus(item.status) && item.closureId === row.closureId).length !== 1) {
      proposed.delete(month.month); month.pending.push("Fechamentos concorrentes."); addIssue(row, "Mais de um fechamento novo para o mesmo mês ou identificação repetida."); continue;
    }
    proposed.set(month.month, { row, snapshot: { closureId: row.closureId, month: month.month, sourceVersion: version, rulesVersion: row.rulesVersion,
      contextHash: row.contextHash, qualified: month.provisional, vacancies: MONTHLY_RULES.slotsPerMonth - month.provisional.length,
      confirmedBy: row.confirmedBy, confirmedOn: row.confirmedOn, reference: row.reference, supersedes: row.supersedes, reason: row.reason } });
  }
  const next = new Map(current);
  for (const [month, item] of proposed) next.set(month, item.snapshot);
  const keys = [...next.values()].flatMap(item => item.qualified.map(album => album.key));
  if (new Set(keys).size !== keys.length) {
    for (const item of proposed.values()) addIssue(item.row, "Correção duplicaria um classificado entre meses. Confirme as correções dos meses envolvidos na mesma versão.");
    proposed.clear();
  }
  for (const [month, item] of proposed) {
    await client.query(`INSERT INTO oraculo.monthly_closures(source_id,closure_id,source_version_id,month,input,record) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [sourceId, item.row.closureId, versionId, month, JSON.stringify(semanticClosure(item.row)), JSON.stringify(item.snapshot)]);
    await client.query(`INSERT INTO oraculo.monthly_publications(source_id,month,closure_id) VALUES($1,$2,$3) ON CONFLICT(source_id,month) DO UPDATE SET closure_id=EXCLUDED.closure_id`,
      [sourceId, month, item.row.closureId]);
  }
  for (const month of state.months) {
    for (const message of month.pending) issues.push({ code: "MONTHLY_QUALIFICATION_PENDING", severity: "warning", sourceLocator: `Albuns 2027 (${month.label})`, message });
    const closed = proposed.get(month.month)?.snapshot ?? current.get(month.month);
    if (closed && closed.contextHash !== month.contextHash) issues.push({ code: "MONTHLY_CLOSED_CONTEXT_CHANGED", severity: "warning", sourceLocator: `Fechamentos mensais (${month.label})`,
      message: `${month.label}: os fatos mudaram após o fechamento; classificados confirmados preservados até correção explícita.` });
  }
}
