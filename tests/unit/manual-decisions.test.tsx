import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { syntheticDecisionSheet, syntheticManualTie, syntheticManualWorkbook } from "../fixtures/synthetic/manual-decisions";
import { parseWorkbookSheets } from "../../src/lib/ingestion/workbook-parser";
import { projectTop50 } from "../../src/lib/competition/top50";
import { albumIdentity, buildParticipants } from "../../src/lib/competition/rules";
import { buildIssueReport, issuePrompt } from "../../src/lib/issues/report";
import { Top50Panel } from "../../src/components/top50-panel";
import type { Top50ManualDecision } from "../../src/lib/catalog/types";

const options = { season: 2026, sourceVersion: "105" };
function project(decisions: Top50ManualDecision[]) {
  const tie = syntheticManualTie();
  return projectTop50(tie.albums, tie.participants, tie.results, tie.cutoff, decisions)!;
}
describe("desempates manuais explícitos do Top 50", () => {
  it("extrai o XLSX, resolve duas vagas de um trio e mostra a confirmação sem alterar os fatos", () => {
    const sheets = syntheticManualWorkbook();
    const before = structuredClone(sheets);
    const parsed = parseWorkbookSheets(sheets, options);
    expect(parsed.canPublish).toBe(true);
    expect(parsed.top50Decisions).toHaveLength(3);
    const field = buildParticipants(parsed.albums);
    const projection = projectTop50(parsed.albums, field.participants, parsed.playoffResults, parsed.albums.map(a => albumIdentity(a)), parsed.top50Decisions)!;
    const ordered = syntheticManualTie().decisions.toSorted((a, b) => a.order! - b.order!);
    expect(ordered.map(row => projection.entries.find(e => e.identityKey === albumIdentity(row))!.position)).toEqual([49, 50, null]);
    expect(projection.tieAtCut).toBe(false); expect(projection.decisionIssues).toEqual([]);
    expect(projection.appliedDecisions).toHaveLength(1); expect(projection.reserved).toBe(16);
    expect(projection.entries.filter(e => e.manualDecisionId).every(e => e.originalScore === 78 && e.index === 79 && e.bonus === 1)).toBe(true);
    const report = buildIssueReport({ ...parsed, version: "105", publicationIssues: parsed.issues }, { active: null, projection });
    expect(report.items).toEqual([]);
    const html = renderToStaticMarkup(<Top50Panel projection={projection}/>);
    expect(html).toContain("Desempates manuais aplicados (1)"); expect(html).toContain("Proprietário fictício");
    expect(html).toContain("Desempates Top 50!2");
    expect(sheets).toEqual(before);
  });
  it("preserva o empate sem tabela e ignora observações com alegação de decisão", () => {
    const sheets = syntheticManualWorkbook().filter(s => s.sheet !== "Desempates Top 50");
    const parsed = parseWorkbookSheets(sheets, options);
    expect(parsed.top50Decisions).toEqual([]);
    expect(project([]).tieAtCut).toBe(true);
    const tie = syntheticManualTie();
    tie.albums.forEach(a => { a.repescagemNote = "Decisão do proprietário: ordem manual confirmada."; });
    expect(projectTop50(tie.albums, tie.participants, tie.results, tie.cutoff)!.tieAtCut).toBe(true);
  });
  it("recalcula posições absolutas quando outros álbuns ultrapassam o grupo", () => {
    const tie = syntheticManualTie();
    const records = tie.albums.filter(a => a !== tie.albums[24]);
    const p = projectTop50(records, tie.participants, tie.results, tie.cutoff, tie.decisions)!;
    expect(tie.decisions.toSorted((a, b) => a.order! - b.order!).map(row => p.entries.find(e => e.identityKey === albumIdentity(row))!.position)).toEqual([48, 49, 50]);
    expect(p.appliedDecisions).toHaveLength(1);
  });
  for (const [label, change, code] of [
    ["ordem duplicada", (rows: Top50ManualDecision[]) => { rows[0].order = rows[1].order; }, "INVALID"],
    ["ordem ausente", (rows: Top50ManualDecision[]) => { rows[0].order = null; }, "INVALID"],
    ["ordem fracionária", (rows: Top50ManualDecision[]) => { rows[0].order = 1.5; }, "INVALID"],
    ["grupo incompleto", (rows: Top50ManualDecision[]) => { rows.pop(); }, "STALE"],
    ["álbum desconhecido", (rows: Top50ManualDecision[]) => { rows[0].title = "Outro disco fictício"; }, "STALE"],
    ["identidade duplicada", (rows: Top50ManualDecision[]) => { rows[0] = { ...rows[1], order: 2 }; }, "INVALID"],
    ["outra temporada", (rows: Top50ManualDecision[]) => { rows.forEach(r => { r.season = 2025; }); }, "STALE"],
    ["outra regra", (rows: Top50ManualDecision[]) => { rows.forEach(r => { r.rulesVersion = "regra antiga"; }); }, "STALE"],
    ["contexto de nota alterado", (rows: Top50ManualDecision[]) => { rows[0].originalScore = 79; }, "STALE"],
    ["contexto de fase alterado", (rows: Top50ManualDecision[]) => { rows[0].phase = "Play-in"; }, "STALE"],
    ["contexto de desempenho alterado", (rows: Top50ManualDecision[]) => { rows[0].phaseScore = 1; }, "STALE"],
    ["contexto de índice alterado", (rows: Top50ManualDecision[]) => { rows[0].index = 80; }, "STALE"],
    ["sem referência", (rows: Top50ManualDecision[]) => { rows.forEach(r => { r.confirmationReference = ""; }); }, "INVALID"],
    ["data impossível", (rows: Top50ManualDecision[]) => { rows.forEach(r => { r.confirmedAt = "2026-02-30"; }); }, "INVALID"],
    ["sem autor", (rows: Top50ManualDecision[]) => { rows.forEach(r => { r.confirmedBy = ""; }); }, "INVALID"],
    ["metadados conflitantes", (rows: Top50ManualDecision[]) => { rows[0].confirmedBy = "Outro autor fictício"; }, "INVALID"],
    ["status pendente", (rows: Top50ManualDecision[]) => { rows.forEach(r => { r.status = "Pendente"; r.order = null; r.confirmedBy = ""; r.confirmedAt = ""; r.confirmationReference = ""; }); }, "PENDING"],
  ] as const) it(`não aplica uma decisão com ${label}`, () => {
    const rows = syntheticManualTie().decisions; change(rows);
    const before = structuredClone(rows); const p = project(rows);
    expect(p.appliedDecisions).toEqual([]); expect(p.tieAtCut).toBe(true);
    expect(p.decisionIssues.map(i => i.code)).toEqual([`TOP50_DECISION_${code}`]);
    expect(rows).toEqual(before);
  });
  it("rejeita duas decisões confirmadas concorrentes sem escolher a mais recente", () => {
    const rows = syntheticManualTie().decisions;
    const p = project([...rows, ...rows.map(r => ({ ...r, decisionId: "synthetic-cut-2", order: 4 - r.order! }))]);
    expect(p.tieAtCut).toBe(true); expect(p.appliedDecisions).toEqual([]);
    expect(p.decisionIssues.map(i => i.code)).toEqual(["TOP50_DECISION_CONFLICT", "TOP50_DECISION_CONFLICT"]);
  });
  it("não aplica decisão quando o grupo atual cresce ou um dos álbuns ganha conflito", () => {
    const tie = syntheticManualTie();
    const extra = { ...tie.tied[0], artist: "Novo empatado fictício" };
    const p = projectTop50([...tie.albums, extra], tie.participants, tie.results, [...tie.cutoff, albumIdentity(extra)], tie.decisions)!;
    expect(p.tieAtCut).toBe(true); expect(p.decisionIssues[0].code).toBe("TOP50_DECISION_STALE");
    tie.tied[0].isPresent = false;
    expect(projectTop50(tie.albums, tie.participants, tie.results, tie.cutoff, tie.decisions)!.appliedDecisions).toEqual([]);
  });
  it("retém erro de número sem aplicar parcialmente o grupo e aceita data nativa do Excel", () => {
    const sheet = syntheticDecisionSheet(syntheticManualTie().decisions);
    const rows = sheet.data.map(row => [...row]); rows[1][9] = "2";
    const parsed = parseWorkbookSheets([...syntheticManualWorkbook().slice(0, -1), { ...sheet, data: rows }], options);
    expect(parsed.canPublish).toBe(true); expect(project(parsed.top50Decisions).tieAtCut).toBe(true);
    expect(project(parsed.top50Decisions).decisionIssues[0].messages.join()).toContain("célula numérica");
    rows[1][9] = 2; rows[1][12] = new Date("2026-10-29T00:00:00Z");
    expect(project(parseWorkbookSheets([...syntheticManualWorkbook().slice(0, -1), { ...sheet, data: rows }], options).top50Decisions).tieAtCut).toBe(false);
  });
  it("mantém catálogo importável com tabela incompatível e gera orientação com o contrato completo", () => {
    const sheets = syntheticManualWorkbook(); sheets.at(-1)!.data = [["Decisão", "Artista"], ["synthetic", "Fictício"]];
    const parsed = parseWorkbookSheets(sheets, options);
    expect(parsed.canPublish).toBe(true); expect(parsed.top50Decisions).toEqual([]);
    expect(parsed.issues.map(i => i.code)).toContain("TOP50_DECISION_HEADER_INVALID");
    const report = buildIssueReport({ ...parsed, version: "105", publicationIssues: parsed.issues }, null);
    expect(issuePrompt(report.items, "105")).toContain("Referência da confirmação");
  });
  it("localiza decisões inválidas na publicação e pede nova confirmação para contexto alterado", () => {
    const tie = syntheticManualTie(); tie.decisions[0].index = 80;
    const p = project(tie.decisions);
    const source = { version: "105", fileName: "synthetic-v105.xlsx", referenceDate: "", summary: {}, albums: tie.albums,
      backlog: [], playoffResults: tie.results, publicationIssues: [], top50Decisions: tie.decisions };
    const report = buildIssueReport(source, { active: null, projection: p });
    const issue = report.items.find(i => i.code === "TOP50_DECISION_STALE")!;
    expect(issue.blocking).toBe(true);
    expect(issue.evidence[0]).toMatchObject({ version: "105", fileName: "synthetic-v105.xlsx", locator: "Desempates Top 50!2" });
    expect(issuePrompt([issue], "105")).toContain("Não atualize apenas o contexto para fazer uma confirmação antiga passar");
    expect(issuePrompt([issue], "105")).toContain("Confirmado em");
  });
});
