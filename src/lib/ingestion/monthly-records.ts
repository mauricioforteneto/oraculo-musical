import type { WorkbookSheetData, WorkbookIssue } from "./workbook-parser";
import type { MonthlyClosure, MonthlyDecision } from "@/lib/competition/monthly";

const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
const text = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").trim();
const number = (value: string) => value !== "" && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
const date = (value: string) => value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1");
export const MONTHLY_DECISION_HEADERS = ["Decisão", "Temporada", "Mês", "Regra", "Artista", "Álbum", "Nota original", "Ordem no grupo", "Status", "Confirmado por", "Confirmado em", "Referência da confirmação"];
export const MONTHLY_CLOSURE_HEADERS = ["Fechamento", "Temporada", "Mês", "Regra", "Versão base", "Hash do contexto", "Status", "Confirmado por", "Confirmado em", "Referência da confirmação", "Corrige fechamento", "Justificativa"];
export function parseMonthlyRecords(sheets: readonly WorkbookSheetData[], issues: WorkbookIssue[]) {
  function rows(name: string, headers: string[]) {
    const sheet = sheets.find(sheet => sheet.sheet === name);
    if (!sheet) return [];
    const index = sheet.data.findIndex(row => headers.every(header => row.some(value => fold(value) === fold(header))));
    if (index < 0) { issues.push({ code: "MONTHLY_HEADERS_INVALID", severity: "warning", sourceLocator: name, message: `Cabeçalhos incompletos em ${name}; nenhuma confirmação desta aba será aplicada.` }); return []; }
    const positions = headers.map(header => sheet.data[index].findIndex(value => fold(value) === fold(header)));
    return sheet.data.slice(index + 1).map((row, i) => ({ row: positions.map(position => text(row[position])), sourceRow: index + i + 2 }))
      .filter(({ row }) => row.some(Boolean));
  }
  const decisions: MonthlyDecision[] = rows("Desempates mensais", MONTHLY_DECISION_HEADERS).map(({ row: r, sourceRow }) => ({
    decisionId: r[0], season: number(r[1]), month: number(r[2]), rulesVersion: r[3], artist: r[4], title: r[5], originalScore: number(r[6]),
    order: number(r[7]), status: r[8], confirmedBy: r[9], confirmedOn: date(r[10]), reference: r[11], sourceRow,
  }));
  const closures: MonthlyClosure[] = rows("Fechamentos mensais", MONTHLY_CLOSURE_HEADERS).map(({ row: r, sourceRow }) => ({
    closureId: r[0], season: number(r[1]), month: number(r[2]), rulesVersion: r[3], baseVersion: r[4], contextHash: r[5], status: r[6],
    confirmedBy: r[7], confirmedOn: date(r[8]), reference: r[9], supersedes: r[10], reason: r[11], sourceRow,
  }));
  return { decisions, closures };
}
