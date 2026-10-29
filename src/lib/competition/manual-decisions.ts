import type { Top50ManualDecision } from "@/lib/catalog/types";
import { albumIdentity } from "./rules";

export const TOP50_DECISION_SHEET = "Desempates Top 50";
export const TOP50_DECISION_PARSER_REVISION = 1;
export const TOP50_DECISION_HEADERS = ["Decisão", "Temporada", "Regra", "Artista", "Álbum", "Nota original", "Melhor fase",
  "Desempenho da fase", "Índice", "Ordem no grupo", "Status", "Confirmado por", "Confirmado em", "Referência da confirmação"] as const;
export const TOP50_DECISION_INSTRUCTIONS = `Use a aba ${TOP50_DECISION_SHEET}, com os cabeçalhos: ${TOP50_DECISION_HEADERS.join(" | ")}. Inclua uma linha por álbum do grupo completo, inclusive quem ficará fora do corte, usando o mesmo identificador em Decisão. Use a identidade exata de artista e álbum; não use número de linha como identidade. Registre temporada, versão da regra e o contexto calculado do empate: nota original, melhor fase, desempenho da fase (etapa 1 ou 2 na Repescagem, score no Play-in/Pré-playoff, zero sem fase) e índice. A ordem no grupo deve ser relativa, de 1 a N, sem repetições; não é a posição absoluta no Top 50. Status Confirmada exige decisão explícita do proprietário, Confirmado por, Confirmado em (AAAA-MM-DD) e Referência da confirmação reais e iguais nas linhas da decisão. Sem confirmação, use Pendente e deixe ordem e confirmação vazias. Não invente a ordem do grupo nem uma autorização.`;

export type DecisionCandidate = { identityKey: string; artist: string; title: string; originalScore: number; phase: string; phaseScore: number; index: number | null };
export type ManualDecisionIssue = { code: "TOP50_DECISION_INVALID" | "TOP50_DECISION_PENDING" | "TOP50_DECISION_STALE" | "TOP50_DECISION_CONFLICT";
  decisionId: string; rows: Top50ManualDecision[]; messages: string[] };
export type AppliedManualDecision = { decisionId: string; confirmedBy: string; confirmedAt: string; confirmationReference: string;
  rows: Top50ManualDecision[]; orderedKeys: string[] };
export const foldDecision = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function resolveTop50Decisions(groups: DecisionCandidate[][], decisions: Top50ManualDecision[], rulesVersion: string) {
  const issues: ManualDecisionIssue[] = [];
  const order = new Map<string, number>();
  const applied: AppliedManualDecision[] = [];
  const byId = new Map<string, Top50ManualDecision[]>();
  const byKey = new Map(groups.flatMap(group => group.map(entry => [entry.identityKey, group] as const)));
  for (const row of decisions) byId.set(row.decisionId, [...(byId.get(row.decisionId) ?? []), row]);
  const plans = new Map<DecisionCandidate[], AppliedManualDecision[]>();
  const issue = (code: ManualDecisionIssue["code"], rows: Top50ManualDecision[], message: string) =>
    issues.push({ code, decisionId: rows[0].decisionId, rows, messages: [message] });
  for (const rows of byId.values()) {
    const first = rows[0];
    const keys = rows.map(row => albumIdentity(row, row.season ?? 2026));
    const invalid = rows.flatMap(row => row.parseErrors ?? []);
    if (!first.decisionId || rows.some(row => !row.artist || !row.title)) invalid.push("Identificação da decisão ou do álbum ausente.");
    if (new Set(keys).size !== keys.length) invalid.push("O mesmo álbum aparece mais de uma vez na decisão.");
    if (new Set(rows.map(row => JSON.stringify([row.status, row.confirmedBy, row.confirmedAt, row.confirmationReference]))).size !== 1)
      invalid.push("Status e metadados de confirmação devem coincidir em todo o grupo.");
    if (rows.some(row => !Number.isInteger(row.season) || row.originalScore === null || !Number.isFinite(row.originalScore)
      || !row.phase || row.phaseScore === null || !Number.isFinite(row.phaseScore) || row.index === null || !Number.isFinite(row.index)))
      invalid.push("O contexto numérico e a fase do empate devem estar preenchidos.");
    if (!["pendente", "confirmada"].includes(foldDecision(first.status))) invalid.push("Status deve ser Pendente ou Confirmada.");
    if (foldDecision(first.status) === "confirmada" && (!first.confirmedBy || !first.confirmationReference || !validDate(first.confirmedAt)))
      invalid.push("Decisão confirmada exige autor, data válida (AAAA-MM-DD) e referência da confirmação.");
    if (invalid.length) { issue("TOP50_DECISION_INVALID", rows, [...new Set(invalid)].join(" ")); continue; }
    const group = byKey.get(keys[0]);
    if (rows.some(row => row.season !== 2026 || row.rulesVersion !== rulesVersion) || !group || group.length < 2
      || group.length !== rows.length || keys.some(key => byKey.get(key) !== group)) {
      issue("TOP50_DECISION_STALE", rows, "A decisão não corresponde ao grupo completo atualmente empatado, à temporada ou à versão da regra. Revise a decisão; ela não foi aplicada.");
      continue;
    }
    if (rows.some((row, index) => {
      const entry = group.find(candidate => candidate.identityKey === keys[index])!;
      return entry.originalScore !== row.originalScore || foldDecision(entry.phase) !== foldDecision(row.phase)
        || entry.phaseScore !== row.phaseScore || entry.index !== row.index;
    })) {
      issue("TOP50_DECISION_STALE", rows, "Nota, fase, desempenho ou índice do empate mudou. A decisão precisa de revisão e não foi reaproveitada."); continue;
    }
    if (foldDecision(first.status) === "pendente") {
      issue("TOP50_DECISION_PENDING", rows, "A decisão está Pendente e não altera o desempate. Registre a confirmação explícita do proprietário antes de aplicá-la."); continue;
    }
    if (rows.some(row => !Number.isInteger(row.order) || row.order! < 1 || row.order! > rows.length)
      || new Set(rows.map(row => row.order)).size !== rows.length) {
      issue("TOP50_DECISION_INVALID", rows, "Ordem no grupo deve conter todos os inteiros de 1 a N, sem posições repetidas ou ausentes."); continue;
    }
    const plan = { decisionId: first.decisionId, confirmedBy: first.confirmedBy, confirmedAt: first.confirmedAt,
      confirmationReference: first.confirmationReference, rows: [...rows].sort((a, b) => a.order! - b.order!),
      orderedKeys: rows.map((row, i) => ({ key: keys[i], order: row.order! })).sort((a, b) => a.order - b.order).map(row => row.key) };
    plans.set(group, [...(plans.get(group) ?? []), plan]);
  }
  for (const plansForGroup of plans.values()) {
    if (plansForGroup.length > 1) {
      for (const plan of plansForGroup) issue("TOP50_DECISION_CONFLICT", plan.rows,
        "Mais de uma decisão confirmada se aplica ao mesmo grupo. Mantenha uma única decisão vigente; nenhuma delas foi aplicada.");
      continue;
    }
    const plan = plansForGroup[0];
    plan.orderedKeys.forEach((key, index) => order.set(key, index + 1));
    applied.push(plan);
  }
  return { order, applied, issues };
}
