import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { firstRound, type Participant } from "../../src/lib/competition/rules";
import { buildBracketView, ROUND_OF_16_GAME_IDS, type BracketPhaseId } from "../../src/lib/competition/bracket";
import { CompetitionBracket } from "../../src/components/competition-bracket";
import type { PublishedPlayoffResult } from "../../src/lib/catalog/types";

const participants: Participant[] = Array.from({ length: 24 }, (_, i) => ({ identityKey: `synthetic-${i}`,
  artist: `Artista fictício ${i + 1}`, title: `Álbum fictício ${i + 1}`, originalScore: 90, route: "elite", seed: i + 1, sourceRow: i + 2, evidence: {} }));
const bracket = firstRound(participants)!;
function firstResults(): PublishedPlayoffResult[] {
  return bracket.matches.map(({ high, low }, i) => ({ seedA: high.seed, seedB: low.seed, artistA: high.artist, artistB: low.artist,
    winner: `${low.artist} (#${low.seed})`, result: "13 × 13", criterion: "Replay", sourceRow: i + 2 }));
}
function roundResults(results: PublishedPlayoffResult[], phase: BracketPhaseId): PublishedPlayoffResult[] {
  return buildBracketView(bracket, results).phases.find(p => p.id === phase)!.games.map((game, i) => {
    const high = game.high.participant!; const low = game.low.participant!;
    const winner = phase === "roundOf16" ? low : high;
    return { phase, gameId: phase === "roundOf16" ? ROUND_OF_16_GAME_IDS[i] : phase === "quarters" ? `QF${i + 1}` : phase === "semis" ? `SF${i + 1}` : "FINAL",
      seedA: high.seed, artistA: high.artist, seedB: low.seed, artistB: low.artist, winner: `${winner.artist} (#${winner.seed})`,
      result: "Resultado fictício", criterion: "Replay", sourceRow: i + 10, sourceSheet: "Resultados Playoffs" };
  });
}

describe("avanço dos playoffs pela chave fixa", () => {
  it("leva uma zebra ao título sem alterar seed nem reorganizar os cruzamentos", () => {
    let results = firstResults();
    for (const phase of ["roundOf16", "quarters", "semis", "final"] as const) {
      const before = buildBracketView(bracket, results);
      expect(before.initialPhase).toBe(phase);
      expect(before.champion).toBeNull();
      results = [...results, ...roundResults(results, phase)];
      if (phase === "roundOf16") {
        const quarter = buildBracketView(bracket, results).phases[2].games[0];
        expect([quarter.high.participant!.seed, quarter.low.participant!.seed]).toEqual([24, 17]);
      }
    }
    const view = buildBracketView(bracket, results);
    expect(view.champion).toEqual(participants[23]);
    const html = renderToStaticMarkup(<CompetitionBracket bracket={bracket} results={results} resultsVersion="100" />);
    expect(html).toContain("Campeão · #24 Artista fictício 24");
    expect(html).toContain("FONTE: Resultados Playoffs");
    expect(html).toContain("FINAL");
    expect(html).not.toContain("Sem resultados publicados nesta fase.");
  });

  it("preenche apenas a vaga resolvida e mantém a outra aguardando seu vencedor", () => {
    const results = firstResults();
    const firstOitava = roundResults(results, "roundOf16")[0];
    const view = buildBracketView(bracket, [...results, firstOitava]);
    expect(view.initialPhase).toBe("roundOf16");
    expect(view.phases[2].games[0].high.participant!.seed).toBe(24);
    expect(view.phases[2].games[0].low.origin).toBe("Vencedor da oitava B");
    expect(view.phases[2].games[0].resolution).toBeUndefined();
  });

  it("recusa duplicidades, vencedor ou participantes incompatíveis no jogo de origem", () => {
    const first = firstResults();
    const oitavas = roundResults(first, "roundOf16");
    for (const [result, extra, pending] of [
      [oitavas[0], [oitavas[0]], "duplicate-results"],
      [{ ...oitavas[0], winner: "Outro (#99)" }, [], "invalid-winner"],
      [{ ...oitavas[0], seedB: 23 }, [], "incompatible-result"],
    ] as const) {
      const results = [...first, result, ...oitavas.slice(1), ...extra];
      const view = buildBracketView(bracket, results);
      expect(view.phases[1].games[0].resolution!.pending).toBe(pending);
      expect(view.phases[2].games[0].high.participant).toBeUndefined();
      expect(view.champion).toBeNull();
    }
  });

  it("não confunde resultado de outra fase nem aceita partida antes dos classificados", () => {
    const first = firstResults();
    const result = roundResults(first, "roundOf16")[0];
    const view = buildBracketView(bracket, [...first, { ...result, phase: "quarters", gameId: "QF1" }]);
    expect(view.phases[1].games[0].resolution!.pending).toBe("missing-result");
    expect(view.phases[2].games[0].resolution).toBeUndefined();
    expect(view.champion).toBeNull();
  });

  it("confere os IDs da primeira rodada e aceita lados invertidos nas oitavas", () => {
    const first = firstResults();
    const wrongIds = first.map((r, i) => ({ ...r, phase: "first" as const, gameId: `Jogo ${String((i + 1) % 8 + 1).padStart(2, "0")}` }));
    const blocked = buildBracketView(bracket, wrongIds);
    expect(blocked.initialPhase).toBe("first");
    expect(blocked.phases[0].games.every(g => g.resolution!.pending === "incompatible-result")).toBe(true);
    const oitavas = roundResults(first, "roundOf16").map(r => ({ ...r, seedA: r.seedB, artistA: r.artistB, seedB: r.seedA, artistB: r.artistA }));
    expect(buildBracketView(bracket, [...first, ...oitavas]).phases[2].games[0].high.participant!.seed).toBe(24);
  });
});
