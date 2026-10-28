import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { syntheticAlbum } from "../fixtures/synthetic/top50";
const deps = vi.hoisted(() => ({ owner: vi.fn(), catalog: vi.fn(), competition: vi.fn(), history: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireOwner: deps.owner, authConfigured: () => false }));
vi.mock("@/lib/catalog/database", () => ({ getPublishedSource: deps.catalog }));
vi.mock("@/lib/competition/service", () => ({ getCompetitionState: deps.competition }));
vi.mock("@/lib/competition/history-database", () => ({ getCompetitionPhaseHistory: deps.history }));
vi.mock("next/navigation", () => ({ usePathname: () => "/albuns", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
import Albums from "../../src/app/albuns/page";
import Album from "../../src/app/albuns/[id]/page";
import Top50 from "../../src/app/top-50/page";
import Playoffs from "../../src/app/playoffs/page";
import Synchronization from "../../src/app/sincronizacao/page";
import PendingIssues from '../../src/app/pendencias/page';
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("SOURCE_SEASON", "2026"); vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "configured-folder");
  deps.owner.mockResolvedValue({ id: "owner" });
  deps.catalog.mockResolvedValue({ version: "100", albums: [syntheticAlbum(1,{ albumId: id })], playoffResults: [] });
  deps.competition.mockResolvedValue(null); deps.history.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
const routes = [
  ["álbuns", () => Albums()], ["avaliação", () => Album({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })],
  ["Top 50", () => Top50()], ["playoffs", () => Playoffs({ searchParams: Promise.resolve({}) })],
  ["sincronização", () => Synchronization()],
  ['pendências',()=>PendingIssues()],
] as const;
describe("novas rotas privadas", () => {
  for (const [name, route] of routes) {
    it(`autoriza antes de qualquer leitura: ${name}`, async () => {
      deps.owner.mockRejectedValue(new Error("NEXT_REDIRECT"));
      await expect(route()).rejects.toThrow("NEXT_REDIRECT");
      expect(deps.catalog).not.toHaveBeenCalled(); expect(deps.competition).not.toHaveBeenCalled(); expect(deps.history).not.toHaveBeenCalled();
    });
    it(`consulta somente a fonte configurada: ${name}`, async () => {
      deps.catalog.mockImplementation(async (...args) => {
        expect(deps.owner).toHaveBeenCalledOnce(); expect(args).toEqual([2026,"configured-folder"]);
        return { version: "100", albums: [syntheticAlbum(1,{ albumId: id })], playoffResults: [] };
      });
      expect(await route()).toBeDefined();
    });
  }
  it("retorna 404 para ID inválido e para álbum de outra fonte", async () => {
    await expect(Album({ params: Promise.resolve({ id: "invalid" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(deps.catalog).not.toHaveBeenCalled();
    await expect(Album({ params: Promise.resolve({ id: "00000000-0000-4000-8000-999999999999" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(deps.catalog).toHaveBeenCalledWith(2026,"configured-folder");
  });
  it("preserva álbum ausente e filtros no retorno sem aceitar URL externa", async () => {
    deps.catalog.mockResolvedValue({ version: "100", albums: [syntheticAlbum(1,{albumId:id,isPresent:false})] });
    const html = renderToStaticMarkup(await Album({ params: Promise.resolve({id}), searchParams: Promise.resolve({ q: "jazz & rock", nota:"80",limite:"45", returnTo:"https://foreign.example",folder:"foreign" }) }));
    expect(html).toContain("não consta na versão atual"); expect(html).toContain('href="/albuns?q=jazz+%26+rock&amp;nota=80&amp;limite=45"');
    expect(html).not.toContain("foreign.example"); expect(html).toContain("última ocorrência conhecida");
  });
  it("preserva o filtro de capas no retorno e abre a correção", async () => {
    const html = renderToStaticMarkup(await Album({params:Promise.resolve({id}),searchParams:Promise.resolve({capas:"revisar",q:"jazz",nota:"80",limite:"30"})}));
    expect(html).toContain('href="/albuns?q=jazz&amp;nota=80&amp;limite=30&amp;capas=revisar"');
    expect(html).toContain('Voltar à lista de capas');
    expect(html).toMatch(/<details[^>]*open=""/);
  });
  it("carrega histórico competitivo apenas na aba correspondente", async () => {
    await Playoffs({searchParams:Promise.resolve({aba:"historico"})});
    expect(deps.history).toHaveBeenCalledWith(2026,"configured-folder","100");
    expect(deps.competition).not.toHaveBeenCalled();
  });
  it('mostra falha segura ao não conseguir conferir as pendências, sem afirmar que a lista está limpa',async()=>{
    deps.catalog.mockRejectedValue(new Error('sensitive connection string'));
    const logger=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      const html=renderToStaticMarkup(await PendingIssues());
      expect(html).toContain('Não foi possível carregar as pendências');expect(html).not.toContain('sensitive connection string');
      expect(html).not.toContain('Nenhuma pendência identificada');expect(logger).toHaveBeenCalledWith('Pending issue report load failed');
    } finally {logger.mockRestore();}
  });
});
