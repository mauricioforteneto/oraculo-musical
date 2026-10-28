import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { projectTop50 } from "../../src/lib/competition/top50";
import { albumIdentity } from "../../src/lib/competition/rules";
import { Top50Panel } from "../../src/components/top50-panel";
import { syntheticAdvance, syntheticAlbum, syntheticField, syntheticFirstResults } from "../fixtures/synthetic/top50";

const { albums, participants, cutoff } = syntheticField();
const outsider = (i: number, score: number) => syntheticAlbum(i, { originalScore: score, playoffSeed: null });

describe("Top 50 2026-top50-2", () => {
  it("reserva 24 vagas antes dos resultados, 17 com sete resultados e 16 após oito", () => {
    const results = syntheticFirstResults();
    for (const [count, expected] of [[0, 24], [7, 17], [8, 16]]) {
      const projection = projectTop50(albums, participants, results.slice(0, count), cutoff)!;
      expect(projection.reserved).toBe(expected);
      expect(projection.slots).toBe(50 - expected);
      expect(projection.entries).toHaveLength(count);
      expect(projection.survivors).toHaveLength(expected);
      expect(projection.survivors.every(e => e.bonus === null && e.index === null && e.position === null)).toBe(true);
    }
  });

  it("mistura eliminados e demais pelo índice; +8 substitui o bônus anterior sem acumular", () => {
    const other = outsider(40, 90);
    const projection = projectTop50([...albums, other], participants, syntheticFirstResults(), cutoff)!;
    const eliminated = projection.entries.find(e => e.seed === 24)!;
    const regular = projection.entries.find(e => e.identityKey === albumIdentity(other))!;
    expect(eliminated).toMatchObject({ originalScore: 78, bonus: 8, index: 86, status: "eliminated" });
    expect(regular.position!).toBeLessThan(eliminated.position!);
    expect(projection.entries.every(e => e.position === null || e.position >= 17)).toBe(true);
    expect(new Set([...projection.entries, ...projection.survivors].map(e => e.identityKey)).size).toBe(25);
    expect(regular.late).toBe(true);
  });

  it("desempata índice pela fase e eliminados da mesma fase pelo seed original", () => {
    const first = syntheticFirstResults("low");
    const projection = projectTop50(albums, participants, first, cutoff)!;
    expect(projection.entries.map(e => e.seed)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    const pre = syntheticAlbum(50, { originalScore: 92, playoffSeed: null, prePlayoffScore: 25, prePlayoffResult: "Eliminado" });
    const tied = projectTop50([...albums, pre], participants, first, [...cutoff, albumIdentity(pre)])!;
    expect(tied.entries[0]).toMatchObject({ seed: 9, index: 98 });
    expect(tied.entries.find(e => e.identityKey === albumIdentity(pre))!.position).toBe(25);
  });

  it("premia bye nas oitavas e aplica +10, +12 e +14 sem novo reseeding", () => {
    let results = syntheticFirstResults("low");
    for (const [phase, bonus, reserved] of [["roundOf16", 10, 8], ["quarters", 12, 4], ["semis", 14, 2]] as const) {
      results = syntheticAdvance(results, phase, phase === "roundOf16" ? "low" : "high");
      const projection = projectTop50(albums, participants, results, cutoff)!;
      expect(projection.reserved).toBe(reserved);
      expect(projection.entries.filter(e => e.bonus === bonus)).toHaveLength(reserved);
      expect(projection.completed).toBe(false);
      if (phase === "roundOf16") expect(projection.entries.find(e => e.seed === 1)).toMatchObject({ phase: "Oitavas", bonus: 10 });
    }
  });

  it("protege campeão e vice sem índice artificial e aceita novidades após a final", () => {
    let results = syntheticFirstResults("low");
    for (const phase of ["roundOf16", "quarters", "semis", "final"] as const) results = syntheticAdvance(results, phase, phase === "roundOf16" ? "low" : "high");
    const projection = projectTop50([...albums, outsider(50, 100)], participants, results, cutoff)!;
    expect(projection.completed).toBe(true);
    expect(projection.reserved).toBe(2);
    expect(projection.survivors).toHaveLength(0);
    expect(projection.entries[0]).toMatchObject({ seed: 24, position: 1, status: "champion", bonus: null, index: null, originalScore: 78 });
    expect(projection.entries[1]).toMatchObject({ position: 2, status: "runner-up", bonus: null, index: null });
    expect(projection.entries.find(e => e.artist === "Artista fictício 50")!.position).toBeGreaterThan(2);
    const html = renderToStaticMarkup(<Top50Panel projection={projection} />);
    expect(html).toContain("campeão e vice definidos");
    expect(html).toContain("Posição garantida pela final");
    expect(html).toContain("A final não congela o restante do ranking anual.");
  });

  it("não elimina por resultado duplicado ou inválido e recalcula após correção", () => {
    const results = syntheticFirstResults();
    const duplicate = projectTop50(albums, participants, [...results, results[0]], cutoff)!;
    expect(duplicate.reserved).toBe(17);
    expect(duplicate.resultIssues[0]).toContain("duplicados");
    expect(duplicate.entries.some(e => e.seed === 24)).toBe(false);
    const invalid = projectTop50(albums, participants, [{ ...results[0], winner: "Outro" }, ...results.slice(1)], cutoff)!;
    expect(invalid.reserved).toBe(17);
    const corrected = projectTop50(albums, participants, [syntheticFirstResults("low")[0], ...results.slice(1)], cutoff)!;
    expect(corrected.reserved).toBe(16);
    expect(corrected.entries.some(e => e.seed === 9)).toBe(true);
    expect(corrected.survivors.some(e => e.seed === 24)).toBe(true);
  });

  it("avisa sobre valores derivados antigos sem bloquear posições calculadas", () => {
    const source = albums.map(a => a.playoffSeed === 24 ? { ...a, top50BestPhase: "Playoffs", top50Bonus: 6, top50Index: 84, top50SourceRank: 1 } : a);
    const projection = projectTop50(source, participants, syntheticFirstResults(), cutoff)!;
    const entry = projection.entries.find(e => e.seed === 24)!;
    expect(entry.conflicts).toEqual([]);
    expect(entry.warnings).toHaveLength(3);
    expect(entry.position).not.toBeNull();
    const html = renderToStaticMarkup(<Top50Panel projection={projection} />);
    expect(html).toContain("16 vagas reservadas aos sobreviventes");
    expect(html).toContain("17–50");
    expect(html).toContain("Diferenças em relação à planilha (1)");
    expect(html).toContain("78 + 8");
    expect(html).toContain("Índice = nota original + bônus da melhor fase");
  });

  it("preserva a nota congelada e não altera catálogo, participantes ou resultados", () => {
    const source = albums.map(a => a.playoffSeed === 24 ? { ...a, originalScore: 100 } : a);
    const results = syntheticFirstResults();
    const before = structuredClone({ source, participants, results });
    const entry = projectTop50(source, participants, results, cutoff)!.entries.find(e => e.seed === 24)!;
    expect(entry).toMatchObject({ originalScore: 78, bonus: 8, index: 86 });
    expect(entry.warnings).toContain("Nota informada difere da original congelada; cálculo preserva a nota congelada.");
    expect({ source, participants, results }).toEqual(before);
  });

  it("mantém fatos contraditórios e duplicidades sem posição, sem excluir eliminados de etapas válidas", () => {
    const rep = syntheticAlbum(50, { originalScore: 78, playoffSeed: null, repescagem: "Eliminado — Etapa 1", repescagemDisqualified: "Sim" });
    const conflict = { ...rep, artist: "Outro fictício", repescagemNote: "Nota após o fechamento; fora da pós-temporada." };
    const records = [...albums, rep, conflict];
    const projection = projectTop50(records, participants, [], records.map(a => albumIdentity(a)))!;
    expect(projection.entries.find(e => e.artist === rep.artist)!.position).not.toBeNull();
    expect(projection.entries.find(e => e.artist === conflict.artist)!.position).toBeNull();
    expect(projection.unresolved).toBe(1);
    const duplicated = projectTop50([...albums, rep, rep], participants, [], null)!;
    expect(duplicated.entries).toHaveLength(1);
    expect(duplicated.entries[0].position).toBeNull();
    expect(projectTop50(albums, [], [], cutoff)).toBeNull();
  });

  it("bloqueia todo o grupo no corte e mantém empate interno com posição compartilhada", () => {
    const records = Array.from({ length: 27 }, (_, i) => outsider(i + 100, 80));
    const projection = projectTop50([...albums, ...records], participants, [], cutoff)!;
    expect(projection.tieAtCut).toBe(true);
    expect(projection.entries.every(e => e.position === null)).toBe(true);
    const internal = projectTop50([...albums, outsider(100, 81), outsider(101, 81), outsider(102, 80)], participants, [], cutoff)!;
    expect(internal.entries.map(e => e.position)).toEqual([25, 25, 27]);
  });
});
