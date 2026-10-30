import { afterEach, describe, expect, it, vi } from "vitest";
import { seasonContext, sourceFolders, requestSeason } from "../../src/lib/seasons/context";
import { seasonHref } from "../../src/lib/seasons/definitions";
import { buildMonthlyState, validCalendarDate } from "../../src/lib/competition/monthly";
import type { MonthlyDecision } from "../../src/lib/competition/monthly";
import { syntheticAlbum } from "../fixtures/synthetic/top50";
import { parseWorkbookSheets } from "../../src/lib/ingestion/workbook-parser";
import { MONTHLY_CLOSURE_HEADERS, MONTHLY_DECISION_HEADERS } from "../../src/lib/ingestion/monthly-records";
import { readFile } from "node:fs/promises";
import { parseSourceWorkbook } from "../../src/lib/ingestion/workbook";

afterEach(() => vi.unstubAllEnvs());
const album = (id: number, score: number, date = "2027-01-15", releaseYear: number | null = 2027) => syntheticAlbum(id, { originalScore: score, evaluatedOn: date, releaseYear });
const now = new Date("2027-02-01T03:00:00Z");
const decisions = (ids: number[]): MonthlyDecision[] => ids.map((id, index) => ({ decisionId: "reescuta-jan", season: 2027, month: 1,
  rulesVersion: "2027-monthly-1", artist: album(id, 90).artist, title: album(id, 90).title, originalScore: 90, order: index + 1,
  status: "Confirmada", confirmedBy: "Proprietário fictício", confirmedOn: "2027-01-31", reference: "Confirmação sintética", sourceRow: index + 2 }));

describe("fontes e navegação por temporada", () => {
  it("preserva a configuração antiga e o padrão de 2026", () => {
    vi.stubEnv("SOURCE_SEASON", "2026"); vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "folder_2026"); vi.stubEnv("SEASON_SOURCES_JSON", "");
    expect(seasonContext()).toMatchObject({ year: 2026, folderId: "folder_2026", format: "legacy-2026" });
    expect(seasonContext("2027")).toMatchObject({ year: 2027, folderId: "", format: "monthly" });
  });
  it("o mapa explícito não recupera pastas de outra temporada", () => {
    vi.stubEnv("SOURCE_SEASON", "2026"); vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "legacy");
    vi.stubEnv("SEASON_SOURCES_JSON", '{"2027":"new_folder"}');
    expect(seasonContext("2026").folderId).toBe(""); expect(seasonContext("2027").folderId).toBe("new_folder");
  });
  it.each(['[]', 'null', '{"2026":"same","2027":"same"}', '{"2027":7}', '{"2027":"https://foreign"}'])('rejeita mapa inválido %s', raw => {
    vi.stubEnv("SEASON_SOURCES_JSON", raw); expect(sourceFolders).toThrow("SOURCE_CONFIGURATION_INVALID");
  });
  it("rejeita ano desconhecido ou parâmetros ambíguos", () => {
    expect(() => seasonContext("2028")).toThrow("SEASON_UNAVAILABLE"); expect(() => seasonContext(["2026", "2027"])).toThrow("INVALID_SEASON");
    expect(() => requestSeason(new Request("https://local.test/api/sync?temporada=2026&temporada=2027"))).toThrow("INVALID_SEASON");
  });
  it("mantém filtros e fragmentos sem tocar links externos ou logout", () => {
    expect(seasonHref("/albuns?q=jazz#ranking", 2027)).toBe("/albuns?q=jazz&temporada=2027#ranking");
    expect(seasonHref("/auth/logout",2027)).toBe("/auth/logout"); expect(seasonHref("https://other.test",2027)).toBe("https://other.test");
    expect(seasonHref("/albuns",2026,false)).toBe("/albuns");
  });
});
describe("classificação mensal 2027", () => {
  it("separa conclusão da avaliação e ano de lançamento, preservando entradas", () => {
    const input = [album(1,95), album(2,91), album(3,90), album(4,100,"2027-01-02",2026), album(5,99,"2027-02-01")];
    const before = structuredClone(input); const state = buildMonthlyState(input,[],now);
    expect(state.months[0].provisional.map(item => item.originalScore)).toEqual([95,91]);
    expect(state.months[1].provisional.map(item => item.originalScore)).toEqual([99]); expect(input).toEqual(before);
  });
  it("não preenche vagas de meses vazios nem altera as notas por reescuta", () => {
    const state = buildMonthlyState([album(1,90)],[],now);
    expect(state.months[0].provisional).toHaveLength(1); expect(state.months[1].provisional).toHaveLength(0); expect(state.slots).toBe(24);
  });
  it("empate entre os dois únicos líderes não exige decidir quem passa", () => {
    const month = buildMonthlyState([album(1,90),album(2,90),album(3,80)],[],now).months[0];
    expect(month.pending).toEqual([]); expect(month.provisional).toHaveLength(2);
  });
  it("não usa alfabeto para resolver uma vaga disputada", () => {
    const month = buildMonthlyState([album(1,95),album(2,90),album(3,90)],[],now).months[0];
    expect(month.provisional.map(item => item.originalScore)).toEqual([95]); expect(month.pending.join()).toContain("Empate na segunda vaga");
  });
  it("aplica somente decisão confirmada, completa e correspondente ao empate", () => {
    const input = [album(1,95),album(2,90),album(3,90)]; const rows = decisions([3,2]);
    expect(buildMonthlyState(input,rows,now).months[0].provisional.map(item => item.key)).toEqual([JSON.stringify([input[0].artist,input[0].title]),JSON.stringify([input[2].artist,input[2].title])]);
    for (const invalid of [rows.slice(0,1),rows.map(row=>({...row,status:"Pendente"})),rows.map(row=>({...row,originalScore:89})),rows.map(row=>({...row,rulesVersion:"2026-top50-2"}))]) {
      expect(buildMonthlyState(input,invalid,now).months[0].pending.length).toBeGreaterThan(0);
    }
  });
  it("metadados sem mês bloqueiam todos os fechamentos potencialmente afetados", () => {
    const state = buildMonthlyState([album(1,90,"")],[],now);
    expect(state.months.every(month=>month.pending.length>0)).toBe(true);
    expect(buildMonthlyState([album(1,90,"2027-01-01",null)],[],now).months[0].pending.join()).toContain("Ano de lançamento");
  });
  it("respeita a meia-noite de São Paulo e mantém dezembro em aberto", () => {
    expect(buildMonthlyState([],[],new Date("2027-02-01T02:59:59Z")).months[0].periodEnded).toBe(false);
    expect(buildMonthlyState([],[],now).months[0].periodEnded).toBe(true);
    const december = buildMonthlyState([],[],new Date("2028-02-01T03:00:00Z")).months[11];
    expect(december.closesOn).toBeNull(); expect(december.periodEnded).toBe(false);
    expect(validCalendarDate("2027-02-29")).toBe(false);
  });
});
describe("contrato da planilha 2027", () => {
  it("o XLSX público é fictício, publicável e não confirma decisões", async () => {
    const parsed=await parseSourceWorkbook(await readFile("docs/templates/Oraculo_Musical_2027_v1.xlsx"),{season:2027,sourceVersion:"1"});
    expect(parsed.issues.filter(issue=>issue.severity==="error")).toEqual([]);
    expect(parsed.canPublish).toBe(true);expect(parsed.albums).toHaveLength(4);
    expect(parsed.albums.every(album=>album.artist.includes("fictício") && album.evaluatedOn?.startsWith("2027-"))).toBe(true);
    expect(parsed.monthlyRecords).toEqual({decisions:[],closures:[]});
  });
  const headers = ["Rank","Artista","Álbum","Nota","Faixa","Gênero","País","Fonte","Nota Original","Data da avaliação","Ano de lançamento"];
  const workbook = (date: unknown = "31/01/2027") => [{sheet:"Albuns 2027",data:[headers,[1,"Artista fictício","Disco fictício",90,"","Rock","Brasil","Fixture",90,date,2027]]},
    {sheet:"Backlog",data:[["Ordem","Artista","Álbum","Prioridade","Fonte"]]},
    {sheet:"Desempates mensais",data:[MONTHLY_DECISION_HEADERS]}, {sheet:"Fechamentos mensais",data:[MONTHLY_CLOSURE_HEADERS]}];
  it("lê data brasileira, data Excel e as abas mensais", () => {
    for(const value of ["31/01/2027",new Date("2027-01-31T00:00:00Z")]) {
      const parsed=parseWorkbookSheets(workbook(value),{season:2027,sourceVersion:"1"});
      expect(parsed.albums[0]).toMatchObject({evaluatedOn:"2027-01-31",releaseYear:2027}); expect(parsed.issues.filter(issue=>issue.severity === "error")).toEqual([]); expect(parsed.canPublish).toBe(true); expect(parsed.monthlyRecords).toEqual({decisions:[],closures:[]});
    }
  });
  it("não inventa data e rejeita data inválida ou de outra temporada", () => {
    expect(parseWorkbookSheets(workbook(""),{season:2027,sourceVersion:"1"}).albums[0].evaluatedOn).toBeNull();
    for(const value of ["31/02/2027","2026-12-31"]) expect(parseWorkbookSheets(workbook(value),{season:2027,sourceVersion:"1"}).canPublish).toBe(false);
  });
});
