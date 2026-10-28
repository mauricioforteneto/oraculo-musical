import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCatalogStatistics, albumsForStatisticsGroup } from "../../src/lib/catalog/statistics";
import { StatisticsPage } from "../../src/components/statistics-page";
import { syntheticStatisticsAlbums } from "../fixtures/synthetic/statistics";
import { syntheticAlbum } from "../fixtures/synthetic/top50";

describe("estatísticas do catálogo publicado", () => {
  it("usa somente álbuns presentes e médias de notas originais, incluindo zero", () => {
    const albums = syntheticStatisticsAlbums();
    const before = structuredClone(albums);
    const stats = buildCatalogStatistics(albums);
    expect(stats).toMatchObject({ total: 6, scoredCount: 4, average: 60, genreCount: 4, countryCount: 4, artistCount: 5 });
    expect(stats.groups.genres.some(g => g.label === "Metal")).toBe(false);
    expect(stats.groups.countries.some(g => g.label === "França")).toBe(false);
    expect(albums).toEqual(before);
  });

  it("conta cada álbum uma vez em cada gênero, sem confundir rock com post-rock", () => {
    const stats = buildCatalogStatistics(syntheticStatisticsAlbums());
    const rock = stats.groups.genres.find(g => g.key === "value:rock")!;
    expect(rock).toMatchObject({ count: 2, scoredCount: 1, average: 80 });
    expect(rock.percentage).toBeCloseTo(100 / 3);
    expect(stats.groups.genres.reduce((n, g) => n + g.percentage, 0)).toBeGreaterThan(100);
    const selected = albumsForStatisticsGroup(stats, "genres", rock.key);
    expect(selected.map(a => a.originalScore)).toEqual([80, null]);
    expect(selected).toHaveLength(rock.count);
    expect(selected.some(a => a.genre === "Post-rock")).toBe(false);
    expect(albumsForStatisticsGroup(stats, "genres", "missing-key")).toEqual([]);
  });

  it("preserva países distintos, créditos de colaborações e denominadores de média", () => {
    const stats = buildCatalogStatistics(syntheticStatisticsAlbums());
    expect(stats.groups.countries.find(g => g.key === "value:brasil")).toMatchObject({ count: 2, scoredCount: 1, average: 80 });
    expect(stats.groups.countries.map(g => g.label)).toEqual(expect.arrayContaining(["Escócia", "Inglaterra", "Irlanda do Norte"]));
    expect(stats.groups.artists[0]).toMatchObject({ label: "Banda & Convidado", count: 2, average: 80 });
    expect(stats.groups.artists.some(g => g.label === "Convidado")).toBe(false);
    expect(stats.allArtistsSingleAlbum).toBe(false);
    expect(stats.groups.countries.find(g => g.key === "missing:")).toMatchObject({ count: 1, scoredCount: 0, average: null });
    expect(stats.groups.genres.find(g => g.key === "missing:")).toMatchObject({ count: 1, scoredCount: 1, average: 0 });
  });

  it("normaliza espaços, caixa e NFC em categorias, preservando nomes de artistas", () => {
    const stats = buildCatalogStatistics([
      syntheticAlbum(1, { artist: "Banda", genre: "Mu\u0301sica  popular", country: "País X" }),
      syntheticAlbum(2, { artist: "banda", genre: " MÚSICA popular ", country: "país x" }),
    ]);
    expect(stats.genreCount).toBe(1);
    expect(stats.countryCount).toBe(1);
    expect(stats.artistCount).toBe(2);
    expect(stats.groups.genres[0].count).toBe(2);
    expect(stats.allArtistsSingleAlbum).toBe(true);
  });

  it("ordena grupos por contagem e nome, sem fabricar média para notas ausentes", () => {
    const stats = buildCatalogStatistics([
      syntheticAlbum(1, { genre: "Zebra", originalScore: null }),
      syntheticAlbum(2, { genre: "Alpha", originalScore: null, isPresent: undefined }),
      syntheticAlbum(3, { genre: "Zebra", originalScore: null }),
    ]);
    expect(stats.groups.genres.map(g => g.label)).toEqual(["Zebra", "Alpha"]);
    expect(stats.average).toBeNull();
    expect(stats.groups.genres.every(g => g.average === null && g.scoredCount === 0)).toBe(true);
    expect(buildCatalogStatistics([])).toMatchObject({ total: 0, average: null, genreCount: 0, countryCount: 0, artistCount: 0 });
  });
});

describe("apresentação das estatísticas", () => {
  it("mostra fonte, recorte, notas originais e o aviso de múltiplos gêneros", () => {
    const html = renderToStaticMarkup(<StatisticsPage statistics={buildCatalogStatistics(syntheticStatisticsAlbums())} version="100" />);
    expect(html).toContain("Fonte v100");
    expect(html).toContain("Somente álbuns presentes");
    expect(html).toContain("4 álbuns com nota original");
    expect(html).toContain("podem somar mais de 100%");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("href=\"/#acervo\"");
  });
  it("distingue falha de carregamento de catálogo vazio", () => {
    const error = renderToStaticMarkup(<StatisticsPage statistics={null} version={null} loadFailed />);
    expect(error).toContain("Não foi possível carregar as estatísticas");
    expect(error).not.toContain("Nenhum álbum presente");
    expect(error).not.toContain("Resumo estatístico");
    const empty = renderToStaticMarkup(<StatisticsPage statistics={buildCatalogStatistics([])} version="101" />);
    expect(empty).toContain("Nenhum álbum presente para analisar");
    expect(empty).not.toContain("Não foi possível carregar");
  });
});
