import type { AlbumRecord } from "@/lib/catalog/types";

export type HistoricalPhase = "repescagem" | "playin" | "preplayoff";

export type PhaseObservation = {
  version: string;
  sourceRow: number;
  score: number | null;
  result: string;
  detail: string;
};

export type PhaseHistoryEntry = {
  identityKey: string;
  artist: string;
  title: string;
  phase: HistoricalPhase;
  firstSeenVersion: string;
  lastSeenVersion: string;
  current: boolean;
  latest: PhaseObservation;
  revisions: PhaseObservation[];
};

export type CompetitionPhaseHistory = {
  sourceVersion: string;
  entries: PhaseHistoryEntry[];
};

export type VersionedAlbumEvidence = {
  identityKey: string;
  version: string;
  current: boolean;
  record: AlbumRecord;
};

function hasRepescagem(value: string | undefined) {
  if (!value) return false;
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("pt-BR");
  return Boolean(normalized) && !/^(nao|sem|fora)\b/.test(normalized);
}

function observations(record: AlbumRecord, version: string): Array<{ phase: HistoricalPhase; fact: PhaseObservation }> {
  const sourceRow = record.sourceRow;
  const items: Array<{ phase: HistoricalPhase; fact: PhaseObservation }> = [];
  if (hasRepescagem(record.repescagem)) items.push({ phase: "repescagem", fact: {
    version, sourceRow, score: null, result: record.repescagem,
    detail: [
      record.repescagemDisqualified ? `Desqualificado na fonte: ${record.repescagemDisqualified}` : "",
      record.repescagemNote ? `Observação: ${record.repescagemNote}` : "",
    ].filter(Boolean).join(" · "),
  } });
  if (typeof record.playInScore === "number" || record.playInResult) items.push({ phase: "playin", fact: {
    version, sourceRow, score: record.playInScore ?? null, result: record.playInResult ?? "", detail: "",
  } });
  if (typeof record.prePlayoffScore === "number" || record.prePlayoffResult || record.prePlayoffTiebreak) items.push({ phase: "preplayoff", fact: {
    version, sourceRow, score: record.prePlayoffScore ?? null, result: record.prePlayoffResult ?? "",
    detail: record.prePlayoffTiebreak ?? "",
  } });
  return items;
}

function sameFact(a: PhaseObservation, b: PhaseObservation) {
  return a.score === b.score && a.result === b.result && a.detail === b.detail;
}

export function buildCompetitionPhaseHistory(rows: VersionedAlbumEvidence[], sourceVersion: string): CompetitionPhaseHistory {
  const byKey = new Map<string, PhaseHistoryEntry>();
  const ordered = [...rows].sort((a, b) => BigInt(a.version) < BigInt(b.version) ? -1 : BigInt(a.version) > BigInt(b.version) ? 1 : 0);
  for (const row of ordered) {
    for (const { phase, fact } of observations(row.record, row.version)) {
      const key = `${row.identityKey}:${phase}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          identityKey: row.identityKey, artist: row.record.artist, title: row.record.title, phase,
          firstSeenVersion: row.version, lastSeenVersion: row.version, current: row.current,
          latest: fact, revisions: [fact],
        });
        continue;
      }
      existing.artist = row.record.artist;
      existing.title = row.record.title;
      existing.lastSeenVersion = row.version;
      existing.current = row.current;
      if (!sameFact(existing.latest, fact)) existing.revisions.push(fact);
      existing.latest = fact;
    }
  }
  return { sourceVersion, entries: [...byKey.values()] };
}
