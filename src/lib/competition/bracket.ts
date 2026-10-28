import type { PlayoffPhase, PublishedPlayoffResult } from "@/lib/catalog/types";
import { resolvePublishedMatch, resolveRoundOf16, type Bracket, type MatchResolution, type Participant } from "./rules";

export type BracketPhaseId = PlayoffPhase;
export const ROUND_OF_16_GAME_IDS = ["O1", "O8", "O4", "O5", "O2", "O7", "O3", "O6"];
export type BracketSide = { participant: Participant; origin?: never } | { participant?: never; origin: string };
export type BracketGame = { id: string; label: string; high: BracketSide; low: BracketSide; resolution?: MatchResolution };
export type BracketPhase = { id: BracketPhaseId; label: string; defined: boolean; games: BracketGame[] };

// A–H are bracket positions, while O1/O8/... are the workbook game IDs.
// Advance winners in place: reseeding is never repeated after the round of 16.
export function buildBracketView(bracket: Bracket, results: PublishedPlayoffResult[]) {
  const first: BracketPhase = { id: "first", label: "Primeira rodada", defined: true, games: bracket.matches.map((match, i) => ({
    id: String(i + 1), label: `Jogo ${i + 1}`, high: { participant: match.high }, low: { participant: match.low },
    resolution: resolvePublishedMatch(match.high, match.low, results, "first", `Jogo ${String(i + 1).padStart(2, "0")}`),
  })) };
  const round = resolveRoundOf16(bracket, results);
  const roundOf16: BracketPhase = { id: "roundOf16", label: "Oitavas", defined: round !== null,
    games: bracket.roundOf16.map((slot, i) => ({
      id: slot.slot, label: `Oitava ${slot.slot}`,
      high: round ? { participant: round[i].high } : { origin: slot.high },
      low: round ? { participant: round[i].low } : { origin: slot.low },
      resolution: round ? resolvePublishedMatch(round[i].high, round[i].low, results, "roundOf16", ROUND_OF_16_GAME_IDS[i]) : undefined,
    })),
  };
  function nextPhase(id: BracketPhaseId, label: string, gameLabel: string, previous: BracketPhase): BracketPhase {
    const side = (game: BracketGame): BracketSide => game.resolution?.winner
      ? { participant: game.resolution.winner }
      : { origin: `Vencedor da ${game.label.replace(/^./, char => char.toLocaleLowerCase("pt-BR"))}` };
    const games = Array.from({ length: previous.games.length / 2 }, (_, i): BracketGame => {
      const high = side(previous.games[i * 2]);
      const low = side(previous.games[i * 2 + 1]);
      const gameId = id === "quarters" ? `QF${i + 1}` : id === "semis" ? `SF${i + 1}` : "FINAL";
      return { id: String(i + 1), label: `${gameLabel} ${i + 1}`, high, low,
        resolution: high.participant && low.participant ? resolvePublishedMatch(high.participant, low.participant, results, id, gameId) : undefined };
    });
    return { id, label, defined: games.every(g => g.high.participant && g.low.participant), games };
  }
  const quarters = nextPhase("quarters", "Quartas", "Quarta", roundOf16);
  const semis = nextPhase("semis", "Semifinais", "Semifinal", quarters);
  const final = nextPhase("final", "Final", "Final", semis);
  const phases = [first, roundOf16, quarters, semis, final];
  const pending = first.games.flatMap(game => game.resolution?.pending ? [{ game: game.label, reason: game.resolution.pending }] : []);
  return { phases, pending, initialPhase: phases.filter(p => p.defined).at(-1)!.id, champion: final.games[0].resolution?.winner ?? null };
}
