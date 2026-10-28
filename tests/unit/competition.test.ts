import { describe, expect, it, vi } from "vitest";
import type { AlbumRecord, PublishedPlayoffResult } from "../../src/lib/catalog/types";
import { albumIdentity, buildParticipants, CUTOFF_UTC, firstRound, participantChanges, reseedRoundOf16, resolveRoundOf16, resolvePublishedMatch } from "../../src/lib/competition/rules";
import { buildBracketView } from "../../src/lib/competition/bracket";
import { projectTop50 } from "../../src/lib/competition/top50";
import { DriveReader, type DriveFile } from "../../src/lib/ingestion/drive";
import { freezeTokenMatches } from "../../src/lib/competition/token";

function album(i: number, patch: Partial<AlbumRecord> = {}): AlbumRecord {
  return { sourceRow: i + 2, sourceRank: i, artist: `Fictional Artist ${i}`, title: `Fictional Album ${i}`,
    reportedScore: 90, originalScore: 90, tier: "Elite", genre: "", country: "", source: "", soundScore: null,
    identityScore: null, consistencyScore: null, replayScore: null, repescagem: "", repescagemDisqualified: "",
    repescagemNote: "", playInScore: null, playInResult: "", prePlayoffScore: null, prePlayoffResult: "",
    prePlayoffTiebreak: "", playoffSeed: i, top50BestPhase: "", top50Bonus: null, top50Index: null, top50SourceRank: null, ...patch };
}
function field(n: number) { return Array.from({ length: n }, (_, i) => album(i + 1, { originalScore: i < 8 ? 99 - i : 89 - (i % 5) })); }

describe("congelamento e chave fictícios", () => {
  for (const [n, byes, games] of [[24, 8, 8], [25, 7, 9], [32, 0, 16]]) {
    it(`monta N=${n} com ${byes} byes e ${games} jogos`, () => {
      const built = buildParticipants(field(n));
      expect(built.canFreeze).toBe(true);
      const bracket = firstRound(built.participants)!;
      expect(bracket.byes).toHaveLength(byes);
      expect(bracket.matches).toHaveLength(games);
      expect(bracket.matches[0].high.seed).toBe(byes + 1);
      expect(bracket.matches[0].low.seed).toBe(n);
      expect(new Set([...bracket.byes, ...bracket.matches.flatMap(m => [m.high, m.low])].map(p => p.seed)).size).toBe(n);
      expect(bracket.roundOf16.map(s => `${s.slot}:${s.highRank}x${s.lowRank}`)).toEqual(["A:1x16", "B:8x9", "C:4x13", "D:5x12", "E:2x15", "F:7x10", "G:3x14", "H:6x11"]);
    });
  }
  it("recusa tamanho e seeds inválidos; mantém divergência de ordem como aviso", () => {
    expect(buildParticipants(field(33)).issues.map(i => i.code)).toContain("FIELD_SIZE_OUT_OF_RANGE");
    expect(buildParticipants(field(24).map((a, i) => i === 0 ? { ...a, playoffSeed: null } : a)).canFreeze).toBe(false);
    expect(buildParticipants(field(24).map((a, i) => i === 0 ? { ...a, playoffSeed: 2 } : a)).issues.map(i => i.code)).toContain("SEED_DUPLICATE");
    expect(buildParticipants(field(24).map((a, i) => i === 0 ? { ...a, playoffSeed: 25 } : a)).issues.map(i => i.code)).toContain("SEED_OUT_OF_RANGE");
    const swapped = field(24); [swapped[0].playoffSeed, swapped[1].playoffSeed] = [2, 1];
    expect(buildParticipants(swapped).canFreeze).toBe(true);
    expect(buildParticipants(swapped).issues.map(i => i.code)).toContain("SEED_ORDER_DIVERGENCE");
  });
  it("preserva classificado prévio e exige resultado verificável", () => {
    const data = field(24);
    expect(buildParticipants(data.slice(1), [albumIdentity(data[0])]).issues.map(i => i.code)).toContain("CLASSIFIED_PARTICIPANT_OMITTED");
    const pre = album(30, { originalScore: 78, prePlayoffResult: "Classificado", prePlayoffScore: null, playoffSeed: null });
    expect(buildParticipants([...data, pre]).issues.map(i => i.code)).toContain("PRE_QUALIFICATION_UNVERIFIED");
  });
  it("faz um reseeding real sem inventar vencedores", () => {
    const participants = buildParticipants(field(24)).participants;
    const survivors = [...participants.slice(0, 8), ...participants.slice(16)];
    const round = reseedRoundOf16(survivors)!;
    expect(round).toHaveLength(8);
    expect(round[0].high.seed).toBe(1);
    expect(round[0].low.seed).toBe(24);
    expect(round[1].high.seed).toBe(8);
    expect(round[1].low.seed).toBe(17);
    expect(reseedRoundOf16(survivors.slice(1))).toBeNull();
  });
  it("audita inclusão, remoção e alteração em correção", () => {
    const before = buildParticipants(field(24)).participants;
    const after = [...before.slice(1).map(p => p.seed === 2 ? { ...p, seed: 1 } : p), { ...before[0], identityKey: "fictional-new", seed: 2 }];
    const diff = participantChanges(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
  });
});

describe("oitavas a partir dos resultados publicados", () => {
  const bracket = firstRound(buildParticipants(field(24)).participants)!;
  // Todos os seeds inferiores vencem: o reseeding não pode assumir favoritos.
  const results: PublishedPlayoffResult[] = bracket.matches.map(({ high, low }, i) => ({
    seedA: high.seed, artistA: high.artist, seedB: low.seed, artistB: low.artist,
    result: "Vitória publicada", winner: low.artist, criterion: "Fonte", sourceRow: i + 2,
  }));

  it("junta oito vencedores e oito byes, preservando identidade e seeds congelados", () => {
    const round = resolveRoundOf16(bracket, results)!;
    expect(round.map(({ slot, high, low }) => [slot, high.seed, low.seed])).toEqual([
      ["A", 1, 24], ["B", 8, 17], ["C", 4, 21], ["D", 5, 20],
      ["E", 2, 23], ["F", 7, 18], ["G", 3, 22], ["H", 6, 19],
    ]);
    const survivors = round.flatMap(({ high, low }) => [high, low]);
    expect(new Set(survivors.map(p => p.identityKey)).size).toBe(16);
    expect(survivors).toEqual(expect.arrayContaining([...bracket.byes, ...bracket.matches.map(m => m.low)]));
    expect(round[0].low).toMatchObject({ seed: 24, artist: "Fictional Artist 24", title: "Fictional Album 24" });
  });

  it("resolve o formato publicado Artista (#seed), inclusive vitória por desempate", () => {
    const published = results.map(r => ({ ...r, winner: `${r.winner} (#${r.seedB})`,
      result: `${r.artistA} 13 × 13 ${r.artistB}`, criterion: "Desempate 1: Replay (3–2)" }));
    expect(resolveRoundOf16(bracket, published)).toEqual(resolveRoundOf16(bracket, results));
    expect(resolveRoundOf16(bracket, published)).not.toBeNull();
  });

  it("recusa vencedor com nome e seed incompatíveis", () => {
    const published = results.map(r => ({ ...r, winner: `${r.winner} (#${r.seedB})` }));
    published[0] = { ...published[0], winner: `${results[0].winner} (#${results[0].seedA})` };
    expect(resolveRoundOf16(bracket, published)).toBeNull();
  });

  it("mantém placeholders enquanto faltar qualquer resultado ou vencedor", () => {
    const placeholders = structuredClone(bracket.roundOf16);
    expect(resolveRoundOf16(bracket, [])).toBeNull();
    for (let i = 0; i < results.length; i++) {
      expect(resolveRoundOf16(bracket, results.filter((_, index) => index !== i))).toBeNull();
      expect(resolveRoundOf16(bracket, results.map((r, index) => index === i ? { ...r, winner: " " } : r))).toBeNull();
    }
    expect(bracket.roundOf16).toEqual(placeholders);
  });

  it("aceita lados invertidos, ordem diferente e nomes normalizados", () => {
    const reversed = results.map(r => ({ ...r, seedA: r.seedB, artistA: r.artistB.toUpperCase(),
      seedB: r.seedA, artistB: r.artistA, winner: `  ${r.winner.toLowerCase()}  ` })).reverse();
    expect(resolveRoundOf16(bracket, reversed)).toEqual(resolveRoundOf16(bracket, results));
  });

  it("resolve vitórias dos dois lados sem inferir o vencedor pelo placar", () => {
    const mixed = results.map((r, i) => i % 2 ? { ...r, winner: r.artistA } : r);
    const survivors = resolveRoundOf16(bracket, mixed)!.flatMap(m => [m.high.seed, m.low.seed]);
    expect(survivors.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
  });

  it("recusa resultados duplicados, incompatíveis ou sem vencedor identificável", () => {
    expect(resolveRoundOf16(bracket, [...results, results[0]])).toBeNull();
    for (const patch of [{ winner: "Outro artista" }, { artistA: "Outro artista" }, { seedA: 1 }]) {
      expect(resolveRoundOf16(bracket, [{ ...results[0], ...patch }, ...results.slice(1)])).toBeNull();
    }
    const ambiguous = structuredClone(bracket);
    ambiguous.matches[0].high.artist = ambiguous.matches[0].low.artist;
    expect(resolveRoundOf16(ambiguous, [{ ...results[0], artistA: results[0].artistB }, ...results.slice(1)])).toBeNull();
  });
});

describe("caminhos e pendências da chave", () => {
  function source(n = 24) {
    const bracket = firstRound(buildParticipants(field(n)).participants)!;
    const results = bracket.matches.map(({ high, low }, i) => ({
      seedA: high.seed, artistA: high.artist, seedB: low.seed, artistB: low.artist,
      winner: `${low.artist} (#${low.seed})`, result: "13 × 13", criterion: "Replay", sourceRow: i + 2,
    }));
    return { bracket, results };
  }

  it("preserva os caminhos A–H até a final sem promover participantes por presunção", () => {
    const { bracket, results } = source();
    const before = structuredClone({ bracket, results });
    const view = buildBracketView(bracket, results);
    expect(view.initialPhase).toBe("roundOf16");
    expect(view.pending).toEqual([]);
    expect(view.phases.map(p => p.games.length)).toEqual([8, 8, 4, 2, 1]);
    expect(view.phases[2].games.map(g => [g.high.origin, g.low.origin])).toEqual([
      ["Vencedor da oitava A", "Vencedor da oitava B"], ["Vencedor da oitava C", "Vencedor da oitava D"],
      ["Vencedor da oitava E", "Vencedor da oitava F"], ["Vencedor da oitava G", "Vencedor da oitava H"],
    ]);
    expect(view.phases[3].games.map(g => [g.high.origin, g.low.origin])).toEqual([
      ["Vencedor da quarta 1", "Vencedor da quarta 2"], ["Vencedor da quarta 3", "Vencedor da quarta 4"],
    ]);
    expect(view.phases[4].games.map(g => [g.high.origin, g.low.origin])).toEqual([
      ["Vencedor da semifinal 1", "Vencedor da semifinal 2"],
    ]);
    for (const phase of view.phases.slice(2)) {
      expect(phase.defined).toBe(false);
      expect(phase.games.flatMap(g => [g.high.participant, g.low.participant]).filter(Boolean)).toEqual([]);
    }
    expect({ bracket, results }).toEqual(before);
  });

  for (let n = 24; n <= 32; n++) {
    it(`monta 16 sobreviventes únicos e preserva seeds no campo de ${n}`, () => {
      const { bracket, results } = source(n);
      const view = buildBracketView(bracket, results);
      const survivors = view.phases[1].games.flatMap(g => [g.high.participant!, g.low.participant!]);
      expect(new Set(survivors.map(p => p.identityKey)).size).toBe(16);
      expect(survivors).toEqual(expect.arrayContaining([...bracket.byes, ...bracket.matches.map(m => m.low)]));
      expect(view.phases[1].games[0].low.participant!.seed).toBe(n);
    });
  }

  it("explica todos os bloqueios por jogo e inicia na primeira rodada incompleta", () => {
    const { bracket, results } = source();
    const partial = results.slice(1).map((r, i) => i === 0 ? { ...r, winner: "" } : i === 1 ? { ...r, winner: "Outro artista (#99)" } : r);
    partial.push(results[3]);
    const view = buildBracketView(bracket, partial);
    expect(view.initialPhase).toBe("first");
    expect(view.pending).toEqual([
      { game: "Jogo 1", reason: "missing-result" }, { game: "Jogo 2", reason: "missing-winner" },
      { game: "Jogo 3", reason: "invalid-winner" }, { game: "Jogo 4", reason: "duplicate-results" },
    ]);
    expect(view.phases[1].defined).toBe(false);
    expect(view.phases[1].games[0].low).toEqual({ origin: "#16 entre os 16 sobreviventes" });
    expect(resolveRoundOf16(bracket, partial)).toBeNull();
  });

  it("não usa empate no placar para adivinhar vencedor e preserva evidência inválida", () => {
    const { bracket, results } = source();
    const { high, low } = bracket.matches[0];
    const result = { ...results[0], winner: "Não identificado" };
    expect(resolvePublishedMatch(high, low, [result])).toEqual({ result, winner: null, pending: "invalid-winner" });
    expect(resolvePublishedMatch(high, low, [{ ...result, winner: "" }]).pending).toBe("missing-winner");
  });
});

describe("Top 50 residual fictício", () => {
  const participants = buildParticipants(field(24)).participants;
  const entrant = (i: number, originalScore: number, patch: Partial<AlbumRecord> = {}) => album(i, { originalScore, playoffSeed: null, tier: "Eliminado", ...patch });
  it("aplica o maior bônus não cumulativo e aceita 79 sem fase", () => {
    const records = [entrant(41, 70, { repescagem: "Eliminado — Etapa 2", playInScore: 12, playInResult: "Eliminado", prePlayoffScore: 10, prePlayoffResult: "Eliminado" }),
      entrant(42, 70, { playInScore: 10, playInResult: "Eliminado" }), entrant(43, 70, { repescagem: "Eliminado — Etapa 1" }),
      entrant(44, 79), entrant(45, 78)];
    const result = projectTop50(records, participants, [], records.map(a => albumIdentity(a)))!;
    expect(result.entries.map(e => e.bonus)).toEqual([0, 6, 3, 1]);
    expect(result.entries.find(e => e.title === "Fictional Album 45")).toBeUndefined();
  });
  it("mantém entrada tardia fora dos Playoffs e avisa sobre fase derivada divergente", () => {
    const records = [entrant(51, 85), entrant(52, 80, { top50BestPhase: "Pré-playoff" })];
    const result = projectTop50(records, participants, [], [])!;
    expect(result.entries[0].late).toBe(true);
    expect(result.entries[0].position).toBe(25);
    expect(result.entries[1].position).toBe(26);
    expect(result.entries[1].warnings).toContain("Melhor fase informada difere da fase calculada.");
    expect(result.unresolved).toBe(0);
  });
  it("bloqueia posição da última vaga quando o desempate continua igual", () => {
    const records = Array.from({ length: 27 }, (_, i) => entrant(100 + i, 80));
    const result = projectTop50(records, participants, [], records.map(a => albumIdentity(a)))!;
    expect(result.tieAtCut).toBe(true);
    expect(result.entries.filter(e => e.position !== null)).toHaveLength(0);
  });
  it("mantém a mesma posição provisória para empate interno", () => {
    const records = [entrant(140, 80), entrant(141, 80), entrant(142, 79)];
    const result = projectTop50(records, participants, [], records.map(a => albumIdentity(a)))!;
    expect(result.entries.map(e => e.position)).toEqual([25, 25, 27]);
  });
});

describe("seleção do corte no Drive", () => {
  const file = (n: number, modifiedTime: string): DriveFile => ({ id: `f${n}`, name: `albuns_2026_mauricio_atualizado_v${n}_synthetic.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", modifiedTime, size: "4", version: "1", parents: ["fictional"] });
  it("seleciona maior versão anterior ao limite exclusivo", async () => {
    const files = [file(10, "2026-09-30T23:00:00Z"), file(11, CUTOFF_UTC), file(9, "2026-09-28T00:00:00Z")];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ files })));
    const reader = new DriveReader(async () => "fake", fetcher);
    expect((await reader.latest("fictional", 2026, CUTOFF_UTC)).sourceVersion).toBe("10");
    expect((await reader.latest("fictional", 2026, undefined, CUTOFF_UTC)).sourceVersion).toBe("11");
  });
  it("rejeita revisão modificada entre lista e download", async () => {
    const before = file(10, "2026-09-30T23:00:00Z");
    const after = { ...before, version: "2" };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]))).mockResolvedValueOnce(new Response(JSON.stringify(after)));
    await expect(new DriveReader(async () => "fake", fetcher).download({ file: before, sourceVersion: "10" })).rejects.toThrow("FILE_CHANGED_DURING_READ");
  });
  it("recusa confirmação quando arquivo, revisão ou hash mudou desde a prévia", () => {
    const candidate = { file: file(10, "2026-09-30T23:00:00Z"), sourceVersion: "10" };
    const token = { fileId: candidate.file.id, fileVersion: "10", driveRevision: "1", modifiedAt: candidate.file.modifiedTime, sha256: "a".repeat(64), activeFreezeId: null };
    expect(freezeTokenMatches(candidate, token, token.sha256)).toBe(true);
    expect(freezeTokenMatches(candidate, token, "b".repeat(64))).toBe(false);
    expect(freezeTokenMatches({ ...candidate, file: { ...candidate.file, version: "2" } }, token, token.sha256)).toBe(false);
    expect(freezeTokenMatches({ ...candidate, sourceVersion: "11" }, token, token.sha256)).toBe(false);
  });
});
