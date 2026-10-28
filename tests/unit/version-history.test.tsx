import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { comparePublishedVersions, filterHistoryChanges, historyBlockAvailable, type VersionHistoryData } from "../../src/lib/catalog/version-history";
import { VersionHistoryPage } from "../../src/components/version-history-page";
import { historySnapshot, historyVersion, syntheticHistorySnapshots } from "../fixtures/synthetic/version-history";

describe("comparação de publicações", () => {
  it("distingue adição, alteração, ausência e reaparecimento com a evidência anterior", () => {
    const input = syntheticHistorySnapshots(); const original = structuredClone(input);
    const comparison = comparePublishedVersions(input.before, input.after, input.earlier);
    expect(comparison.blocks.albums.changes.map(c => c.kind).sort()).toEqual(["absent", "added", "changed", "reappeared"]);
    const returning = comparison.blocks.albums.changes.find(c => c.kind === "reappeared")!;
    expect(returning.before!.version).toBe("81"); expect(returning.after!.version).toBe("100"); expect(returning.fields).toEqual([]);
    expect(comparison.blocks.backlog.changes[0]).toMatchObject({ kind: "changed" });
    expect(comparison.blocks.backlog.changes[0].fields.map(f => f.field)).toEqual(["order", "priority"]);
    expect(comparison.blocks.playoffs.changes[0].fields.map(f => f.field)).toEqual(["result", "winner"]);
    expect(input).toEqual(original);
  });

  it("não confunde linha, parser, metadados de origem, vazio ou formato legado com mudanças", () => {
    const before = historySnapshot("99", { albums: [{ artist: "A", title: "Disco", sourceRow: 2, genre: "", top50Index: null }],
      playoffs: [{ seedA: 9, artistA: "A", seedB: 24, artistB: "B", winner: "A (#9)", sourceRow: 12 }] });
    const after = historySnapshot("100", { albums: [{ artist: "A", title: "Disco", sourceRow: 18, genre: null }],
      playoffs: [{ seedA: 9, artistA: "A", seedB: 24, artistB: "B", winner: "A (#9)", phase: "first", gameId: "Jogo 01", sourceRow: 2, sourceSheet: "Resultados Playoffs" }] });
    expect(Object.values(comparePublishedVersions(before, after).blocks).every(b => b.changes.length === 0)).toBe(true);
  });

  it("preserva zero como valor e não usa ordem do backlog como identidade", () => {
    const before = historySnapshot("99", { backlog: [{ artist: "A", title: "D", order: 1 }], albums: [{ artist: "A", title: "D", reportedScore: null }] });
    const after = historySnapshot("100", { backlog: [{ artist: "A", title: "D", order: 2 }], albums: [{ artist: "A", title: "D", reportedScore: 0 }] });
    const compared = comparePublishedVersions(before, after);
    expect(compared.blocks.backlog.changes).toHaveLength(1); expect(compared.blocks.backlog.changes[0].kind).toBe("changed");
    expect(compared.blocks.albums.changes[0].fields[0]).toMatchObject({ before: null, after: 0 });
  });

  it("não inventa adições no ponto inicial nem ausências quando uma extração é indisponível", () => {
    const { before, after } = syntheticHistorySnapshots();
    expect(comparePublishedVersions(null, after).blocks.albums).toMatchObject({ status: "baseline", records: 3, changes: [] });
    before.blocks.albums.available = false;
    expect(comparePublishedVersions(before, after).blocks.albums).toMatchObject({ status: "unavailable", changes: [] });
    expect(historyBlockAvailable(0, undefined)).toBe(false);
    expect(historyBlockAvailable(0, 0)).toBe(true);
    expect(historyBlockAvailable(0, undefined, true)).toBe(true);
    expect(historyBlockAvailable(1, 2)).toBe(false);
  });

  it("sinaliza identidades duplicadas e não presume renomeações", () => {
    const before = historySnapshot("99", { backlog: [{ artist: "A", title: "D", order: 1 }, { artist: "A", title: "D", order: 2 }], albums: [{ artist: "A", title: "D" }] });
    const after = historySnapshot("100", { backlog: [{ artist: "A", title: "D", order: 1 }], albums: [{ artist: "a", title: "D" }] });
    const compared = comparePublishedVersions(before, after);
    expect(compared.blocks.backlog.warnings).toHaveLength(1); expect(compared.blocks.backlog.changes).toEqual([]);
    expect(compared.blocks.albums.changes.map(c => c.kind).sort()).toEqual(["absent", "added"]);
    expect(comparePublishedVersions(null, before).blocks.backlog.warnings).toHaveLength(1);
  });

  it("não usa uma versão futura como evidência de reaparecimento", () => {
    const before = historySnapshot("99");
    const after = historySnapshot("100", { albums: [{ artist: "A", title: "D" }] });
    const future = historySnapshot("101", { albums: [{ artist: "A", title: "D" }] });
    const compared = comparePublishedVersions(before, after, { albums: future.blocks.albums.records });
    expect(compared.blocks.albums.changes[0].kind).toBe("added");
  });

  it("filtra campos derivados sem apagar alterações de conteúdo nem mudar os totais", () => {
    const { before, after, earlier } = syntheticHistorySnapshots();
    after.blocks.albums.records.push(...historySnapshot("100", { albums: [{ artist: "Apenas ranking", title: "D", top50SourceRank: 17 }] }).blocks.albums.records);
    before.blocks.albums.records.push(...historySnapshot("99", { albums: [{ artist: "Apenas ranking", title: "D", top50SourceRank: 25 }] }).blocks.albums.records);
    const compared = comparePublishedVersions(before, after, earlier);
    const original = structuredClone(compared);
    const list = filterHistoryChanges(compared, { domain: "albums", kind: "changed", query: "", includeDerived: false });
    expect(list).toHaveLength(1); expect(list[0].fields.map(f => f.field)).toEqual(["genre"]);
    expect(filterHistoryChanges(compared, { domain: "playoffs", kind: "all", query: "vencedor", includeDerived: true })).toHaveLength(1);
    expect(compared).toEqual(original);
  });
});

export function syntheticHistoryData(): VersionHistoryData {
  const { before, after, earlier } = syntheticHistorySnapshots();
  return { versions: [historyVersion("100"), historyVersion("99")], selected: after.version, previous: before.version,
    comparison: comparePublishedVersions(before, after, earlier), page: 1, hasMore: false, notices: [] };
}
describe("apresentação do histórico", () => {
  it("mostra antes/depois e contexto de reaparecimento sem atribuir datas de eventos", () => {
    const html = renderToStaticMarkup(<VersionHistoryPage history={syntheticHistoryData()} />);
    expect(html).toContain("v99 → v100"); expect(html).toContain("Ausente em v99; último registro disponível em v81");
    expect(html).toContain("Antes"); expect(html).toContain("não recalcula rankings antigos");
    expect(html).toContain("Incluir posições e índices"); expect(html).toContain("não de escuta ou realização de partidas");
  });
  it("distingue ponto inicial, vazio e falha sem transformar indisponibilidade em zero mudanças", () => {
    const data = syntheticHistoryData(); data.previous = null; data.comparison = comparePublishedVersions(null, syntheticHistorySnapshots().after);
    expect(renderToStaticMarkup(<VersionHistoryPage history={data} />)).toContain("Ponto inicial");
    expect(renderToStaticMarkup(<VersionHistoryPage history={data} />)).not.toContain("Explore as mudanças");
    expect(renderToStaticMarkup(<VersionHistoryPage history={null} />)).toContain("Nenhuma publicação disponível");
    const error = renderToStaticMarkup(<VersionHistoryPage history={null} loadFailed />);
    expect(error).toContain("Histórico indisponível neste momento"); expect(error).not.toContain("Nenhuma publicação disponível");
  });
});
