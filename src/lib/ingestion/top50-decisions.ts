import type { Top50ManualDecision } from "@/lib/catalog/types";
import { foldDecision, TOP50_DECISION_HEADERS, TOP50_DECISION_SHEET } from "@/lib/competition/manual-decisions";
import type { WorkbookIssue, WorkbookSheetData } from "./workbook-parser";

export function parseTop50Decisions(sheets: readonly WorkbookSheetData[], issues: WorkbookIssue[]): Top50ManualDecision[] {
  const sheet = sheets.find(candidate => candidate.sheet === TOP50_DECISION_SHEET);
  if (!sheet) return [];
  const headerIndex = sheet.data.slice(0, 20).findIndex(row => row.some(cell => typeof cell === "string" && foldDecision(cell) === "decisao"));
  const tokens = headerIndex < 0 ? [] : sheet.data[headerIndex].map(cell => typeof cell === "string" ? foldDecision(cell) : "");
  if (TOP50_DECISION_HEADERS.some(header => tokens.filter(token => token === foldDecision(header)).length !== 1)) {
    issues.push({ code: "TOP50_DECISION_HEADER_INVALID", severity: "warning", sourceLocator: `${sheet.sheet}!${Math.max(1, headerIndex + 1)}`,
      message: "A tabela de desempates manuais tem cabeçalho ausente ou duplicado; nenhuma decisão dessa aba foi aplicada." });
    return [];
  }
  const columns = TOP50_DECISION_HEADERS.map(header => tokens.indexOf(foldDecision(header)));
  const records: Top50ManualDecision[] = [];
  for (let index = headerIndex + 1; index < sheet.data.length; index++) {
    const row = sheet.data[index];
    if (row.every(value => value === null || value === undefined || (typeof value === "string" && value.trim() === ""))) continue;
    const errors: string[] = [];
    const at = (column: number) => row[columns[column]];
    const text = (column: number) => typeof at(column) === "string" ? (at(column) as string).trim() : "";
    const number = (column: number) => {
      const value = at(column);
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      errors.push(`${TOP50_DECISION_HEADERS[column]} deve ser uma célula numérica.`); return null;
    };
    const rawDate = at(12);
    records.push({ decisionId: text(0), season: number(1), rulesVersion: text(2), artist: text(3), title: text(4),
      originalScore: number(5), phase: text(6), phaseScore: number(7), index: number(8), order: number(9), status: text(10),
      confirmedBy: text(11), confirmedAt: rawDate instanceof Date && Number.isFinite(rawDate.getTime()) ? rawDate.toISOString().slice(0, 10) : text(12),
      confirmationReference: text(13), sourceSheet: sheet.sheet, sourceRow: index + 1, parseErrors: errors });
  }
  return records;
}
