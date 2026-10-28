import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const dependencies = vi.hoisted(() => ({ owner: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: dependencies.owner }));
vi.mock("@/lib/catalog/version-history-database", () => ({ getVersionHistory: dependencies.history }));
import History from "../../src/app/historico/page";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("SOURCE_SEASON", "2026"); vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "configured-folder");
  dependencies.owner.mockResolvedValue({ id: "owner" }); dependencies.history.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
describe("acesso ao histórico", () => {
  it("exige autorização antes de ler versões", async () => {
    dependencies.owner.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(History({ searchParams: Promise.resolve({ versao: "100" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(dependencies.history).not.toHaveBeenCalled();
  });
  it("usa somente a fonte configurada e encaminha parâmetros para validação no servidor", async () => {
    const html = renderToStaticMarkup(await History({ searchParams: Promise.resolve({ versao: "100", pagina: "2", folder: "other-folder" }) }));
    expect(dependencies.owner).toHaveBeenCalledOnce();
    expect(dependencies.history).toHaveBeenCalledWith(2026, "configured-folder", "100", "2");
    expect(html).toContain("Nenhuma publicação disponível");
  });
  it("mostra falha distinta sem expor detalhes internos", async () => {
    dependencies.history.mockRejectedValue(new Error("private connection detail"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = renderToStaticMarkup(await History({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("Histórico indisponível neste momento"); expect(html).not.toContain("private connection detail");
      expect(html).not.toContain("Nenhuma publicação disponível");
    } finally { logger.mockRestore(); }
  });
});
