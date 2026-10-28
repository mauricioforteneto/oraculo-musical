import { makeHistoryRecord, type HistoryDomain, type HistorySnapshot, type HistoryVersion } from "../../../src/lib/catalog/version-history";

export const historyVersion = (version: string): HistoryVersion => ({ version, fileName: `synthetic-v${version}.xlsx`,
  importedAt: "2026-01-02T12:00:00Z", modifiedAt: "2026-01-01T12:00:00Z", isCurrent: version === "100" });
export function historySnapshot(version: string, rows: Partial<Record<HistoryDomain, Record<string, unknown>[]>> = {}, unavailable: HistoryDomain[] = []): HistorySnapshot {
  return { version: historyVersion(version), blocks: {
    albums: { available: !unavailable.includes("albums"), records: (rows.albums ?? []).map(r => makeHistoryRecord("albums", r, version)) },
    backlog: { available: !unavailable.includes("backlog"), records: (rows.backlog ?? []).map(r => makeHistoryRecord("backlog", r, version)) },
    playoffs: { available: !unavailable.includes("playoffs"), records: (rows.playoffs ?? []).map(r => makeHistoryRecord("playoffs", r, version)) },
  } };
}
export function syntheticHistorySnapshots() {
  const before = historySnapshot("99", {
    albums: [{ artist: "Banda fictícia A", title: "Disco A", genre: "Rock", originalScore: 80, top50SourceRank: 25 },
      { artist: "Banda fictícia B", title: "Disco B", originalScore: 70 }],
    backlog: [{ artist: "Banda fictícia C", title: "Disco C", order: 1, priority: "Normal", source: "Fonte fictícia" }],
    playoffs: [{ seedA: 9, artistA: "Banda fictícia A", seedB: 24, artistB: "Banda fictícia B", winner: "Banda fictícia A (#9)", result: "13 × 12", sourceRow: 12 }],
  });
  const after = historySnapshot("100", {
    albums: [{ artist: "Banda fictícia A", title: "Disco A", genre: "Jazz", originalScore: 80, top50SourceRank: 17 },
      { artist: "Banda fictícia D", title: "Disco D", originalScore: 90 },
      { artist: "Banda fictícia E", title: "Disco E", originalScore: 81 }],
    backlog: [{ artist: "Banda fictícia C", title: "Disco C", order: 2, priority: "Alta", source: "Fonte fictícia" }],
    playoffs: [{ phase: "first", gameId: "Jogo 01", seedA: 9, artistA: "Banda fictícia A", seedB: 24, artistB: "Banda fictícia B", winner: "Banda fictícia B (#24)", result: "12 × 13", sourceSheet: "Resultados Playoffs", sourceRow: 2 }],
  });
  const earlier = historySnapshot("81", { albums: [{ artist: "Banda fictícia D", title: "Disco D", originalScore: 90 }] });
  return { before, after, earlier: { albums: earlier.blocks.albums.records } };
}
