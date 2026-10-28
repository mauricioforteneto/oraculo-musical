import type { AlbumRecord, PlayoffPhase, PublishedPlayoffResult } from "@/lib/catalog/types";

export const CUTOFF_UTC = "2026-10-01T03:00:00.000Z";
export const RULES_VERSION = "2026-freeze-1";
export type CompetitionIssue = { code: string; severity: "error" | "warning"; message: string; sourceRow?: number };
export type Participant = { identityKey: string; artist: string; title: string; originalScore: number; route: "elite" | "direct" | "pre"; seed: number; sourceRow: number; evidence: Record<string, unknown> };
export type Match = { high: Participant; low: Participant };
export type Bracket = { byes: Participant[]; matches: Match[]; roundOf16: { slot: string; highRank: number; lowRank: number; high: string; low: string }[] };
export function participantChanges(before: Participant[], after: Participant[]) {
  const oldByKey = new Map(before.map(p => [p.identityKey, p]));
  const newByKey = new Map(after.map(p => [p.identityKey, p]));
  return { added: after.filter(p => !oldByKey.has(p.identityKey)), removed: before.filter(p => !newByKey.has(p.identityKey)),
    changed: after.filter(p => { const old = oldByKey.get(p.identityKey); return old && (old.seed !== p.seed || old.originalScore !== p.originalScore || old.route !== p.route); }) };
}

export function albumIdentity(album: Pick<AlbumRecord, "artist" | "title">, season = 2026) {
  return JSON.stringify([season, album.artist.normalize("NFC").trim(), album.title.normalize("NFC").trim(), ""]);
}
function folded(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
export function participantRoute(album: AlbumRecord): Participant["route"] | null {
  if (album.originalScore !== null && album.originalScore >= 90) return "elite";
  if (album.originalScore !== null && album.originalScore >= 85) return "direct";
  if (folded(album.prePlayoffResult).startsWith("classificado") && album.prePlayoffScore !== null) return "pre";
  return null;
}
export function buildParticipants(albums: AlbumRecord[], previouslyClassified: string[] = []) {
  const issues: CompetitionIssue[] = [];
  const participants: Participant[] = [];
  const expected = new Set(previouslyClassified);
  for (const album of albums) {
    const key = albumIdentity(album);
    const route = participantRoute(album);
    if (folded(album.prePlayoffResult).startsWith("classificado") && album.prePlayoffScore === null) issues.push({ code: "PRE_QUALIFICATION_UNVERIFIED", severity: "error", message: "Classificação no Pré-playoff sem score comprovado.", sourceRow: album.sourceRow });
    if (!route) {
      if (album.playoffSeed !== null) issues.push({ code: "UNEXPECTED_SEED", severity: "error", message: "Seed sem elegibilidade comprovada.", sourceRow: album.sourceRow });
      if (expected.has(key)) issues.push({ code: "CLASSIFIED_PARTICIPANT_MISSING", severity: "error", message: "Classificado anterior perdeu a elegibilidade na fonte de corte.", sourceRow: album.sourceRow });
      continue;
    }
    expected.delete(key);
    if (album.playoffSeed === null) issues.push({ code: "SEED_MISSING", severity: "error", message: "Participante sem seed.", sourceRow: album.sourceRow });
    participants.push({ identityKey: key, artist: album.artist, title: album.title, originalScore: album.originalScore!, route, seed: album.playoffSeed ?? 0, sourceRow: album.sourceRow,
      evidence: { prePlayoffScore: album.prePlayoffScore, prePlayoffResult: album.prePlayoffResult, tier: album.tier } });
  }
  for (const key of expected) issues.push({ code: "CLASSIFIED_PARTICIPANT_OMITTED", severity: "error", message: `Classificado anterior não consta da versão de corte: ${key}.` });
  const n = participants.length;
  if (n < 24 || n > 32) issues.push({ code: "FIELD_SIZE_OUT_OF_RANGE", severity: "error", message: `O campo tem ${n} participantes; a regra aprovada cobre 24 a 32.` });
  const seen = new Set<number>();
  for (const p of participants) {
    if (!Number.isInteger(p.seed) || p.seed < 1 || p.seed > n) issues.push({ code: "SEED_OUT_OF_RANGE", severity: "error", message: `Seed fora de 1–${n}.`, sourceRow: p.sourceRow });
    if (seen.has(p.seed)) issues.push({ code: "SEED_DUPLICATE", severity: "error", message: `Seed ${p.seed} repetido.`, sourceRow: p.sourceRow });
    seen.add(p.seed);
  }
  const expectedOrder = [...participants].sort((a, b) => ({ elite: 0, direct: 1, pre: 2 })[a.route] - ({ elite: 0, direct: 1, pre: 2 })[b.route]
    || b.originalScore - a.originalScore || a.sourceRow - b.sourceRow);
  expectedOrder.forEach((p, index) => {
    if (p.seed !== index + 1) issues.push({ code: "SEED_ORDER_DIVERGENCE", severity: "warning", message: `A ordem por rota e nota sugeriria seed ${index + 1}; a fonte registra ${p.seed}.`, sourceRow: p.sourceRow });
  });
  return { participants: participants.sort((a, b) => a.seed - b.seed), issues, canFreeze: !issues.some(i => i.severity === "error") };
}

export function firstRound(participants: Participant[]): Bracket | null {
  const n = participants.length;
  if (n < 24 || n > 32 || new Set(participants.map(p => p.seed)).size !== n || participants.some(p => p.seed < 1 || p.seed > n)) return null;
  const ordered = [...participants].sort((a, b) => a.seed - b.seed);
  const byeCount = 32 - n;
  const playing = ordered.slice(byeCount);
  const matches = playing.slice(0, playing.length / 2).map((high, i) => ({ high, low: playing[playing.length - 1 - i] }));
  const positions: [string, number, number][] = [["A", 1, 16], ["B", 8, 9], ["C", 4, 13], ["D", 5, 12], ["E", 2, 15], ["F", 7, 10], ["G", 3, 14], ["H", 6, 11]];
  return { byes: ordered.slice(0, byeCount), matches, roundOf16: positions.map(([slot, highRank, lowRank]) => ({ slot, highRank, lowRank, high: `#${highRank} entre os 16 sobreviventes`, low: `#${lowRank} entre os 16 sobreviventes` })) };
}

export function reseedRoundOf16(survivors: Participant[]) {
  if (survivors.length !== 16 || new Set(survivors.map(p => p.seed)).size !== 16) return null;
  const ordered = [...survivors].sort((a, b) => a.seed - b.seed);
  return [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]].map(([a, b], i) => ({ slot: "ABCDEFGH"[i], high: ordered[a], low: ordered[b] }));
}

function matchesParticipants(high: Participant, low: Participant, result: PublishedPlayoffResult) {
  return (result.seedA === high.seed && result.seedB === low.seed && folded(result.artistA) === folded(high.artist) && folded(result.artistB) === folded(low.artist))
    || (result.seedA === low.seed && result.seedB === high.seed && folded(result.artistA) === folded(low.artist) && folded(result.artistB) === folded(high.artist));
}
function resultsForMatch(high: Participant, low: Participant, results: PublishedPlayoffResult[]) {
  return results.filter(result => (result.phase ?? "first") === "first" && matchesParticipants(high, low, result));
}

export function resultForMatch(high: Participant, low: Participant, results: PublishedPlayoffResult[]) {
  const matches = resultsForMatch(high, low, results);
  return matches.length === 1 ? matches[0] : null;
}

export type MatchResolution = {
  result: PublishedPlayoffResult | null;
  winner: Participant | null;
  pending: "missing-result" | "duplicate-results" | "missing-winner" | "invalid-winner" | "incompatible-result" | null;
};

export const MATCH_PENDING_LABELS = {
  "missing-result": "Nenhum resultado publicado pôde ser associado a este confronto.",
  "duplicate-results": "Há resultados duplicados para este confronto; confira a fonte.",
  "missing-winner": "O resultado não informa o vencedor.",
  "invalid-winner": "O vencedor informado não identifica um único participante deste confronto.",
  "incompatible-result": "Os participantes do resultado não correspondem aos classificados para este jogo.",
};

export function publishedResultsForMatch(high: Participant, low: Participant, results: PublishedPlayoffResult[], phase: PlayoffPhase = "first", gameId?: string) {
  return gameId ? results.filter(r => (r.phase ?? "first") === phase
    && (r.gameId === gameId || (phase === "first" && !r.gameId && matchesParticipants(high, low, r)))) : resultsForMatch(high, low, results);
}
export function resolvePublishedMatch(high: Participant, low: Participant, results: PublishedPlayoffResult[], phase: PlayoffPhase = "first", gameId?: string): MatchResolution {
  const matches = publishedResultsForMatch(high, low, results, phase, gameId);
  if (matches.length !== 1) return { result: null, winner: null, pending: matches.length ? "duplicate-results" : "missing-result" };
  const result = matches[0];
  if (!matchesParticipants(high, low, result)) return { result, winner: null, pending: "incompatible-result" };
  if (!result.winner.trim()) return { result, winner: null, pending: "missing-winner" };
  const winner = folded(result.winner);
  const candidates = [high, low].filter(p => winner === folded(p.artist) || winner === folded(`${p.artist} (#${p.seed})`));
  return candidates.length === 1
    ? { result, winner: candidates[0], pending: null }
    : { result, winner: null, pending: "invalid-winner" };
}

export function resolveRoundOf16(bracket: Bracket, results: PublishedPlayoffResult[]) {
  const winners: Participant[] = [];
  for (const [i, match] of bracket.matches.entries()) {
    const { winner } = resolvePublishedMatch(match.high, match.low, results, "first", `Jogo ${String(i + 1).padStart(2, "0")}`);
    if (!winner) return null;
    winners.push(winner);
  }
  return reseedRoundOf16([...bracket.byes, ...winners]);
}
