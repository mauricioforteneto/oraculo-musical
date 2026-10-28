import type { AlbumRecord, PublishedPlayoffResult } from "../../../src/lib/catalog/types";
import { albumIdentity, buildParticipants, firstRound } from "../../../src/lib/competition/rules";
import { buildBracketView, ROUND_OF_16_GAME_IDS, type BracketPhaseId } from "../../../src/lib/competition/bracket";

export function syntheticAlbum(i: number, patch: Partial<AlbumRecord> = {}): AlbumRecord {
  return { sourceRow: i + 2, sourceRank: i, artist: `Artista fictício ${i}`, title: `Álbum fictício de título extenso ${i}`,
    originalScore: 90, reportedScore: 90, tier: "Elite", genre: "", country: "", source: "", isPresent: true,
    soundScore: null, identityScore: null, consistencyScore: null, replayScore: null, repescagem: "", repescagemDisqualified: "", repescagemNote: "",
    playInScore: null, playInResult: "", prePlayoffScore: null, prePlayoffResult: "", prePlayoffTiebreak: "", playoffSeed: i,
    top50BestPhase: "", top50Bonus: null, top50Index: null, top50SourceRank: null, ...patch };
}
export function syntheticField() {
  const albums = Array.from({ length: 24 }, (_, i) => syntheticAlbum(i + 1, i === 23
    ? { originalScore: 78, prePlayoffScore: 18, prePlayoffResult: "Classificado" } : {}));
  const participants = buildParticipants(albums).participants;
  const bracket = firstRound(participants)!;
  const cutoff = albums.map(a => albumIdentity(a));
  return { albums, participants, bracket, cutoff };
}
export function syntheticFirstResults(side: "high" | "low" = "high"): PublishedPlayoffResult[] {
  return syntheticField().bracket.matches.map((match, i) => ({ seedA: match.high.seed, seedB: match.low.seed,
    artistA: match.high.artist, artistB: match.low.artist, winner: `${match[side].artist} (#${match[side].seed})`,
    result: "13 × 13", criterion: "Desempate fictício", sourceRow: i + 2 }));
}
export function syntheticAdvance(results: PublishedPlayoffResult[], phase: BracketPhaseId, side: "high" | "low" = "high") {
  const games = buildBracketView(syntheticField().bracket, results).phases.find(p => p.id === phase)!.games;
  const records = games.map((game, i): PublishedPlayoffResult => {
    const high = game.high.participant!; const low = game.low.participant!;
    const winner = side === "high" ? high : low;
    return { phase, gameId: phase === "roundOf16" ? ROUND_OF_16_GAME_IDS[i] : phase === "quarters" ? `QF${i + 1}` : phase === "semis" ? `SF${i + 1}` : "FINAL",
      seedA: high.seed, artistA: high.artist, seedB: low.seed, artistB: low.artist, winner: `${winner.artist} (#${winner.seed})`,
      result: "13 × 12", criterion: "Placar fictício", sourceRow: i + 10, sourceSheet: "Resultados Playoffs" };
  });
  return [...results, ...records];
}
