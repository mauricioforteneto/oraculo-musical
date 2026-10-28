import { describe, expect, it } from "vitest";
import { rankAnnualAlbums } from "../../src/lib/catalog/ranking";
import { parseSummaryNumber } from "../../src/lib/catalog/summary";
import { parseWorkbookSheets, type WorkbookSheetData } from "../../src/lib/ingestion/workbook-parser";

const albumHeaders = [
  "Rank", "Artista", "Álbum", "Nota", "Faixa", "Gênero", "País", "Fonte", "Nota Original",
  "Repescagem 75-79", "Desqualificado Repescagem?", "Observação Repescagem", "Play-in Score",
  "Resultado Play-in", "Pré-playoff Score", "Resultado Pré-playoff", "Desempate Pré-playoff", "Seed Playoff",
  "Melhor fase Top 50", "Bônus Top 50", "Índice Top 50", "Rank Top 50 provisório",
];

function albumRow(values: Partial<Record<string, unknown>> = {}) {
  const defaults: Record<string, unknown> = {
    Rank: 1, Artista: "Banda fictícia", Álbum: "Disco fictício", Nota: 80, Faixa: "Elite", Gênero: "Rock",
    País: "Brasil", Fonte: "Avaliação fictícia", "Nota Original": 78, "Repescagem 75-79": "80* — promoção registrada",
    "Desqualificado Repescagem?": "Não", "Observação Repescagem": "", "Play-in Score": null,
    "Resultado Play-in": "", "Pré-playoff Score": null, "Resultado Pré-playoff": "",
    "Desempate Pré-playoff": "", "Seed Playoff": null, "Melhor fase Top 50": "Sem pós-temporada",
    "Bônus Top 50": 0, "Índice Top 50": 78, "Rank Top 50 provisório": null,
  };
  return albumHeaders.map((header) => Object.prototype.hasOwnProperty.call(values, header) ? values[header] : defaults[header] ?? null);
}

function workbook(albums: unknown[][], backlog = [[1, "Artista fictício", "Backlog fictício", "Normal", "Fonte fictícia"]]): WorkbookSheetData[] {
  return [
    {
      sheet: "Albuns 2026",
      data: [albumHeaders, ...albums],
    },
    {
      sheet: "Backlog",
      data: [
        ["Backlog atualizado — 1 disco"],
        ["Ordem", "Artista", "Álbum", "Prioridade", "Fonte / referência"],
        ...backlog,
      ],
    },
    {
      sheet: "Resumo",
      data: [
        ["Resumo do Projeto — Álbuns 2026"],
        ["Data de referência", "26/09/2026"],
        ["Álbuns ouvidos", albums.length],
        ["Nota média", 79.5],
        ["Backlog atual", "23 discos"],
      ],
    },
  ];
}

describe("parser da fonte XLSX", () => {
  it("encontra a tabela de backlog após o título e mantém promoção fora da nota anual", () => {
    const source = parseWorkbookSheets(workbook([
      albumRow({ Rank: 2, Artista: "Artista A", Álbum: "Disco A", Nota: 80, "Nota Original": 78 }),
      albumRow({ Rank: 1, Artista: "Artista B", Álbum: "Disco B", Nota: 79, "Nota Original": 79, "Repescagem 75-79": "" }),
    ]), { season: 2026, sourceVersion: "80" });

    expect(source.canPublish).toBe(true);
    expect(source.albums).toHaveLength(2);
    expect(source.backlog).toHaveLength(1);
    expect(source.backlog[0].order).toBe(1);
    expect(source.referenceDate).toBe("2026-09-26");
    expect(source.albums[0].repescagem).toContain("80*");
    expect(source.albums[0].originalScore).toBe(78);
    expect(source.counts.reportedOriginalDifferences).toBe(1);
    expect(source.issues.map((issue) => issue.code)).toContain("SUMMARY_BACKLOG_COUNT_MISMATCH");

    const ranking = rankAnnualAlbums(source.albums);
    expect(ranking.map((album) => album.artist)).toEqual(["Artista B", "Artista A"]);
    expect(ranking.map((album) => album.annualPosition)).toEqual([1, 2]);
  });

  it("bloqueia original ausente, nota fora do limite e identidades duplicadas", () => {
    const source = parseWorkbookSheets(workbook([
      albumRow({ Artista: "Artista A", Álbum: "Disco A", "Nota Original": null }),
      albumRow({ Artista: "Artista B", Álbum: "Disco B", Nota: 101, "Nota Original": 101 }),
      albumRow({ Artista: "Artista A", Álbum: "Disco A", "Nota Original": 78 }),
    ]), { season: 2026, sourceVersion: "80" });

    expect(source.canPublish).toBe(false);
    expect(source.issues.map((issue) => issue.code)).toContain("ORIGINAL_SCORE_MISSING");
    expect(source.issues.map((issue) => issue.code)).toContain("REPORTED_SCORE_OUT_OF_RANGE");
    expect(source.issues.map((issue) => issue.code)).toContain("ORIGINAL_SCORE_OUT_OF_RANGE");
    expect(source.issues.map((issue) => issue.code)).toContain("DUPLICATE_IDENTITY");
  });

  it("bloqueia cabeçalhos incompatíveis e linhas sem identidade", () => {
    const rows = workbook([albumRow()]);
    rows[0] = { ...rows[0], data: [["Rank", "Artista", "Nome do disco"], ...rows[0].data.slice(1)] };
    const missingHeader = parseWorkbookSheets(rows, { season: 2026, sourceVersion: "80" });
    expect(missingHeader.canPublish).toBe(false);
    expect(missingHeader.issues.map((issue) => issue.code)).toContain("ALBUM_HEADER_NOT_FOUND");

    const missingIdentity = parseWorkbookSheets(workbook([albumRow({ Álbum: "" })]), { season: 2026, sourceVersion: "80" });
    expect(missingIdentity.canPublish).toBe(false);
    expect(missingIdentity.issues.map((issue) => issue.code)).toContain("ALBUM_IDENTITY_MISSING");
  });

  it("trata células de erro e ordem de backlog duplicada como problemas", () => {
    const source = parseWorkbookSheets(workbook(
      [albumRow({ Nota: "#VALUE!" })],
      [
        [1, "Artista fictício", "Disco A", "Normal", "Fonte"],
        [1, "Artista fictício", "Disco B", "Normal", "Fonte"],
      ],
    ), { season: 2026, sourceVersion: "80" });

    expect(source.canPublish).toBe(false);
    expect(source.issues.map((issue) => issue.code)).toContain("EXCEL_ERROR_VALUE");
    expect(source.issues.map((issue) => issue.code)).toContain("DUPLICATE_BACKLOG_ORDER");
  });

  it("lê valores numéricos do resumo mesmo quando há unidade", () => {
    expect(parseSummaryNumber("23 discos")).toBe(23);
    expect(parseSummaryNumber("74,62")).toBe(74.62);
    expect(parseSummaryNumber("sem valor")).toBeNull();
  });
});

const resultHeaders = ["Fase", "Jogo", "Seed A", "Artista A", "Seed B", "Artista B", "Resultado", "Vencedor", "Critério"];
function playoffSource(rows: unknown[][]) {
  return [...workbook([albumRow()]),
    { sheet: "Playoffs", data: [["Seed A", "Artista A", "Seed B", "Artista B", "Resultado 1ª rodada", "Vencedor", "Critério"],
      [9, "Artista fictício A", 24, "Artista fictício B", "13 × 12", "Artista fictício A (#9)", "Placar direto"]] },
    { sheet: "Resultados Playoffs", data: [resultHeaders, ...rows] }];
}
const firstResult = ["1ª rodada", "Jogo 01", 9, "Artista fictício A", 24, "Artista fictício B", "13 × 12", "Artista fictício A (#9)", "Placar direto"];

describe("resultados por fase na planilha", () => {
  it("prefere a nova primeira rodada, ignora agendamentos e preserva proveniência", () => {
    const source = parseWorkbookSheets(playoffSource([firstResult,
      ["Oitavas", "O1", 1, "Artista fictício C", 24, "Artista fictício B", null, null, null],
      ["Quartas", "QF1", null, null, null, null, null, null, null],
    ]), { season: 2026, sourceVersion: "99" });
    expect(source.canPublish).toBe(true);
    expect(source.playoffResults).toHaveLength(1);
    expect(source.playoffResults[0]).toMatchObject({ phase: "first", gameId: "Jogo 01", sourceSheet: "Resultados Playoffs", sourceRow: 2 });
  });
  it("mantém primeira rodada legada quando a nova aba contém somente fases seguintes", () => {
    const source = parseWorkbookSheets(playoffSource([
      ["Oitavas", "O8", 8, "Artista fictício C", 9, "Artista fictício A", "10 × 11", "Artista fictício A (#9)", "Placar direto"],
    ]), { season: 2026, sourceVersion: "99" });
    expect(source.playoffResults).toHaveLength(2);
    expect(source.playoffResults[0].phase).toBeUndefined();
    expect(source.playoffResults[1]).toMatchObject({ phase: "roundOf16", gameId: "O8", sourceRow: 2 });
  });
  it("não recupera resultado antigo quando a nova tabela declara a primeira rodada vazia", () => {
    const blank = [...firstResult]; blank[6] = ""; blank[7] = ""; blank[8] = "";
    expect(parseWorkbookSheets(playoffSource([blank]), { season: 2026, sourceVersion: "99" }).playoffResults).toEqual([]);
  });
  it("bloqueia fatos com fase, jogo ou participantes inválidos sem mascarar com a aba antiga", () => {
    for (const [column, value] of [[0, "Desconhecida"], [1, "O99"], [2, "1"], [3, ""], [4, 9]] as const) {
      const row = [...firstResult]; row[column] = value;
      const parsed = parseWorkbookSheets(playoffSource([row]), { season: 2026, sourceVersion: "99" });
      expect(parsed.canPublish).toBe(false);
      expect(parsed.issues.some(i => i.code === "PLAYOFF_RESULT_ROW_INVALID")).toBe(true);
    }
    const sheets = playoffSource([]); sheets[4] = { sheet: "Resultados Playoffs", data: [["Formato desconhecido"]] };
    expect(parseWorkbookSheets(sheets, { season: 2026, sourceVersion: "99" }).canPublish).toBe(false);
  });
});
