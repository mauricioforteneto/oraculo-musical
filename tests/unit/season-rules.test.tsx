import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RULES_VERSION } from "../../src/lib/competition/rules";
import { TOP50_RULES_VERSION } from "../../src/lib/competition/top50";
const deps = vi.hoisted(() => ({ owner: vi.fn(), catalog: vi.fn(), year: "2026" }));
vi.mock("@/lib/auth", () => ({ requireOwner: deps.owner }));
vi.mock("@/lib/catalog/database", () => ({ getPublishedSource: deps.catalog }));
vi.mock("next/navigation", () => ({ usePathname: () => "/regras", useSearchParams: () => new URLSearchParams(`temporada=${deps.year}`), useRouter: () => ({push:vi.fn()}), notFound: () => {throw new Error("NEXT_NOT_FOUND");} }));
import Rules from "../../src/app/regras/page";
import Playoffs from "../../src/app/playoffs/page";
import { buildIssueReport, issuePrompt } from "../../src/lib/issues/report";
beforeEach(() => { vi.clearAllMocks(); deps.owner.mockResolvedValue({id:"owner"}); vi.stubEnv("SOURCE_SEASON","2026"); });
afterEach(() => vi.unstubAllEnvs());
describe("regras privadas independentes de publicação", () => {
  it.each([2026,2027])("mostra regras de %s sem fonte, credenciais ou banco", async year => {
    deps.year=String(year);
    vi.stubEnv("SEASON_SOURCES_JSON","malformed-private-configuration");
    vi.stubEnv("DATABASE_READ_URL","");
    const html = renderToStaticMarkup(await Rules({searchParams:Promise.resolve({temporada:String(year)})}));
    expect(html).toContain(`Regras de ${year}`); expect(html).toContain("Regulamento completo");
    expect(html).toContain("Histórico de alterações"); expect(deps.catalog).not.toHaveBeenCalled();
    expect(html).toContain(`/albuns?temporada=${year}`);
    if(year===2026) { expect(html).toContain(RULES_VERSION); expect(html).toContain(TOP50_RULES_VERSION); expect(html).toContain("substitui as disposições anteriores"); expect(html).toContain("Ler o regulamento vigente consolidado de 2026"); expect(html).toContain("Primeira rodada, reseeding e chave fixa"); }
    else { expect(html).toContain("2027-monthly-1"); expect(html).toContain("24 vagas"); expect(html).toContain("Corte de dezembro"); expect(html).toContain("Em aberto:"); }
  });
  it("autoriza antes de consultar a temporada ou o regulamento", async () => {
    deps.owner.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await expect(Rules({searchParams:Promise.resolve({temporada:"unknown"})})).rejects.toThrow("AUTH_REQUIRED");
    expect(deps.catalog).not.toHaveBeenCalled();
  });
  it("rejeita temporada desconhecida e parâmetros duplicados", async () => {
    for(const temporada of ["2028",["2026","2027"]]) await expect(Rules({searchParams:Promise.resolve({temporada})})).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("2027 sem publicação usa somente o formato mensal", async () => {
    vi.stubEnv("SEASON_SOURCES_JSON",JSON.stringify({2026:"legacy-folder"})); deps.catalog.mockResolvedValue(null);
    const html=renderToStaticMarkup(await Playoffs({searchParams:Promise.resolve({temporada:"2027"})}));
    expect(html).toContain("Classificação mensal"); expect(html).not.toContain("Congelar participantes");
    expect(deps.catalog).toHaveBeenCalledWith(2027,"");
  });
  it("as orientações de pendências de 2027 usam somente as abas mensais", () => {
    const report=buildIssueReport(null,null,2027);
    expect(report.season).toBe(2027);
    const prompt=issuePrompt([],"1",2027);
    expect(prompt).toContain("Albuns 2027");expect(prompt).toContain("Fechamentos mensais");
    expect(prompt).not.toContain("Albuns 2026");expect(prompt).not.toContain("Desempates Top 50");
  });
});
