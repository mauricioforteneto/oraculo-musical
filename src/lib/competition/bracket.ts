import type { PublishedPlayoffResult } from "@/lib/catalog/types";
import { resolvePublishedMatch, resolveRoundOf16, type Bracket, type MatchResolution, type Participant } from "./rules";

export type BracketPhaseId = "first" | "roundOf16" | "quarters" | "semis" | "final";
export type BracketSide = { participant: Participant; origin?: never } | { participant?: never; origin: string };
export type BracketGame = { id: string; label: string; high: BracketSide; low: BracketSide; resolution?: MatchResolution };
export type BracketPhase = { id: BracketPhaseId; label: string; defined: boolean; games: BracketGame[] };

// Later rounds describe fixed paths only. Their results are not imported yet.
export function buildBracketView(bracket: Bracket, results: PublishedPlayoffResult[]) {
  const first: BracketPhase = { id: "first", label: "Primeira rodada", defined: true, games: bracket.matches.map((match, i) => ({
    id: String(i + 1), label: `Jogo ${i + 1}`, high: { participant: match.high }, low: { participant: match.low },
    resolution: resolvePublishedMatch(match.high, match.low, results),
  })) };
  const round = resolveRoundOf16(bracket, results);
  const roundOf16: BracketPhase = { id: "roundOf16", label: "Oitavas", defined: round !== null,
    games: bracket.roundOf16.map((slot, i) => ({
      id: slot.slot, label: `Oitava ${slot.slot}`,
      high: round ? { participant: round[i].high } : { origin: slot.high },
      low: round ? { participant: round[i].low } : { origin: slot.low },
    })),
  };
  function nextPhase(id: BracketPhaseId, label: string, gameLabel: string, previous: BracketPhase): BracketPhase {
    return { id, label, defined: false, games: Array.from({ length: previous.games.length / 2 }, (_, i) => ({
      id: String(i + 1), label: `${gameLabel} ${i + 1}`,
      high: { origin: `Vencedor da ${previous.games[i * 2].label.replace(/^./, char => char.toLocaleLowerCase("pt-BR"))}` },
      low: { origin: `Vencedor da ${previous.games[i * 2 + 1].label.replace(/^./, char => char.toLocaleLowerCase("pt-BR"))}` },
    })) };
  }
  const quarters = nextPhase("quarters", "Quartas", "Quarta", roundOf16);
  const semis = nextPhase("semis", "Semifinais", "Semifinal", quarters);
  const final = nextPhase("final", "Final", "Final", semis);
  const phases = [first, roundOf16, quarters, semis, final];
  const pending = first.games.flatMap(game => game.resolution?.pending ? [{ game: game.label, reason: game.resolution.pending }] : []);
  return { phases, pending, initialPhase: round ? "roundOf16" as const : "first" as const };
}
