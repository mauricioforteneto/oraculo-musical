import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { syntheticStatisticsAlbums } from "../fixtures/synthetic/statistics";

const dependencies = vi.hoisted(() => ({ owner: vi.fn(), catalog: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: dependencies.owner }));
vi.mock("@/lib/catalog/database", () => ({ getPublishedSource: dependencies.catalog }));
import Statistics from "../../src/app/estatisticas/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SOURCE_SEASON", "2026"); vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "synthetic-folder");
  dependencies.owner.mockResolvedValue({ id: "owner" });
  dependencies.catalog.mockResolvedValue({ version: "100", albums: syntheticStatisticsAlbums() });
});
afterEach(() => vi.unstubAllEnvs());

describe("acesso à página de estatísticas", () => {
  it("não carrega catálogo quando a autorização falha", async () => {
    dependencies.owner.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(Statistics()).rejects.toThrow("NEXT_REDIRECT");
    expect(dependencies.catalog).not.toHaveBeenCalled();
  });
  it("autoriza antes de ler a fonte e renderiza a versão publicada", async () => {
    dependencies.catalog.mockImplementation(async () => {
      expect(dependencies.owner).toHaveBeenCalledOnce();
      return { version: "100", albums: syntheticStatisticsAlbums() };
    });
    const html = renderToStaticMarkup(await Statistics());
    expect(dependencies.catalog).toHaveBeenCalledWith(2026, "synthetic-folder");
    expect(html).toContain("Fonte v100");
    expect(html).toContain("4 álbuns com nota original");
  });
  it("mostra falha segura sem expor detalhes nem apresentar zero álbuns", async () => {
    dependencies.catalog.mockRejectedValue(new Error("sensitive connection detail"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = renderToStaticMarkup(await Statistics());
      expect(html).toContain("Não foi possível carregar as estatísticas");
      expect(html).not.toContain("sensitive connection detail");
      expect(html).not.toContain("Resumo estatístico");
      expect(logger).toHaveBeenCalledWith("Statistics catalog load failed");
    } finally { logger.mockRestore(); }
  });
});
