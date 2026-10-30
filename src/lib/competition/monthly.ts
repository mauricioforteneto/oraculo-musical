import type { AlbumRecord } from "@/lib/catalog/types";
import { MONTHLY_RULES } from "@/lib/seasons/definitions";

export const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MONTHLY_PARSER_REVISION = 1;
export type MonthlyDecision = {
  decisionId: string; season: number | null; month: number | null; rulesVersion: string;
  artist: string; title: string; originalScore: number | null; order: number | null;
  status: string; confirmedBy: string; confirmedOn: string; reference: string; sourceRow: number;
};
export type MonthlyClosure = {
  closureId: string; season: number | null; month: number | null; rulesVersion: string; baseVersion: string; contextHash: string;
  status: string; confirmedBy: string; confirmedOn: string; reference: string; supersedes: string; reason: string; sourceRow: number;
};
export type MonthlyCandidate = { key: string; albumId?: string; artist: string; title: string; originalScore: number; evaluatedOn: string; releaseYear: number };
export type MonthlySnapshot = { closureId: string; month: number; sourceVersion: string; rulesVersion: string; contextHash: string;
  qualified: MonthlyCandidate[]; vacancies: number; confirmedBy: string; confirmedOn: string; reference: string; supersedes: string; reason: string };
export type MonthlyMonth = { month: number; label: string; closesOn: string | null; periodEnded: boolean; candidates: MonthlyCandidate[];
  provisional: MonthlyCandidate[]; pending: string[]; decisions: MonthlyDecision[]; contextHash?: string; confirmed?: MonthlySnapshot; changedSinceClosure?: boolean };
export type MonthlyState = { season: number; rulesVersion: string; slots: number; months: MonthlyMonth[]; storageReady: boolean; sourceVersion: string | null };
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function localDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MONTHLY_RULES.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export const monthlyKey = (album: Pick<AlbumRecord, "artist" | "title">) => JSON.stringify([album.artist.normalize("NFC").trim(), album.title.normalize("NFC").trim()]);
export const confirmedStatus = (status: string) => status.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase() === "confirmada";

export function buildMonthlyState(albums: AlbumRecord[], decisions: MonthlyDecision[] = [], now = new Date()): MonthlyState {
  const season = 2027;
  const today = localDay(now);
  const months: MonthlyMonth[] = MONTH_NAMES.map((label, index) => ({ month: index + 1, label,
    closesOn: index === 11 ? null : new Date(Date.UTC(season, index + 1, 0)).toISOString().slice(0, 10),
    periodEnded: index !== 11 && today > new Date(Date.UTC(season, index + 1, 0)).toISOString().slice(0, 10),
    candidates: [], provisional: [], pending: [], decisions: [] }));
  for (const album of albums) {
    if (album.releaseYear != null && album.releaseYear !== season) continue;
    const name = `${album.artist} — ${album.title}`;
    if (!album.evaluatedOn || !validCalendarDate(album.evaluatedOn) || !album.evaluatedOn.startsWith(`${season}-`)) {
      for (const month of months) month.pending.push(`Data da avaliação pendente: ${name}.`);
      continue;
    }
    const month = months[Number(album.evaluatedOn.slice(5, 7)) - 1];
    if (album.releaseYear == null) { month.pending.push(`Ano de lançamento pendente: ${name}.`); continue; }
    if (album.originalScore == null) { month.pending.push(`Nota original pendente: ${name}.`); continue; }
    month.candidates.push({ key: monthlyKey(album), albumId: album.albumId, artist: album.artist, title: album.title,
      originalScore: album.originalScore, evaluatedOn: album.evaluatedOn, releaseYear: album.releaseYear });
  }
  for (const month of months) {
    month.candidates.sort((a, b) => b.originalScore - a.originalScore || a.key.localeCompare(b.key));
    if (new Set(month.candidates.map(item => item.key)).size !== month.candidates.length) month.pending.push("Identidade de álbum repetida no mês.");
    const boundary = month.candidates[MONTHLY_RULES.slotsPerMonth - 1]?.originalScore;
    const group = boundary == null ? [] : month.candidates.filter(item => item.originalScore === boundary);
    const above = month.candidates.filter(item => boundary != null && item.originalScore > boundary).length;
    const needsDecision = group.length > MONTHLY_RULES.slotsPerMonth - above;
    const rows = decisions.filter(row => row.month === month.month);
    const groups = new Map<string, MonthlyDecision[]>();
    for (const row of rows) groups.set(row.decisionId, [...(groups.get(row.decisionId) ?? []), row]);
    const applicable: MonthlyDecision[][] = [];
    for (const entries of groups.values()) {
      if (!entries.some(row => confirmedStatus(row.status))) continue;
      const first = entries[0];
      const orders = new Set(entries.map(row => row.order));
      const consistent = entries.every(row => row.decisionId && row.season === season && row.rulesVersion === MONTHLY_RULES.version
        && confirmedStatus(row.status) && row.confirmedBy && validCalendarDate(row.confirmedOn) && row.confirmedOn <= today && row.reference
        && row.confirmedBy === first.confirmedBy && row.confirmedOn === first.confirmedOn && row.reference === first.reference
        && Number.isInteger(row.order) && row.order! >= 1 && row.order! <= entries.length
        && group.some(album => album.key === monthlyKey(row) && album.originalScore === row.originalScore));
      if (!needsDecision || !consistent || entries.length !== group.length || orders.size !== entries.length
        || new Set(entries.map(monthlyKey)).size !== group.length) {
        month.pending.push(`Decisão ${first.decisionId || "sem identificação"} inválida ou desatualizada; confira o grupo completo.`);
      } else applicable.push(entries);
    }
    if (needsDecision && applicable.length !== 1) month.pending.push(applicable.length > 1 ? "Mais de uma decisão confirmada para o mesmo empate." : "Empate na segunda vaga: registre a reescuta e a ordem do grupo completo em Desempates mensais.");
    if (needsDecision && applicable.length === 1) {
      const entries = applicable[0];
      month.decisions = entries;
      const order = new Map(entries.map(row => [monthlyKey(row), row.order!]));
      month.candidates.sort((a, b) => b.originalScore - a.originalScore || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0) || a.key.localeCompare(b.key));
    }
    // An alphabetical display order never awards a disputed place.
    month.provisional = needsDecision && applicable.length !== 1 ? month.candidates.filter(item => item.originalScore > boundary!)
      : month.candidates.slice(0, MONTHLY_RULES.slotsPerMonth);
  }
  return { season, rulesVersion: MONTHLY_RULES.version, slots: MONTHLY_RULES.slotsPerMonth * 12, months, storageReady: true, sourceVersion: null };
}

export function monthlyContext(month: MonthlyMonth) {
  return { season: 2027, month: month.month, rulesVersion: MONTHLY_RULES.version, closesOn: month.closesOn,
    candidates: month.candidates.map(({ key, originalScore, evaluatedOn, releaseYear }) => ({ key, originalScore, evaluatedOn, releaseYear })),
    decision: month.decisions.map(decision => Object.fromEntries(Object.entries(decision).filter(([key]) => key !== "sourceRow"))),
    pending: [...month.pending].sort() };
}
