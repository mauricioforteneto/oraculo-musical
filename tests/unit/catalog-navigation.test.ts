import { describe, expect, it } from "vitest";
import { catalogFilters, catalogQuery } from "../../src/lib/catalog/catalog-navigation";
import { visibleIssue } from "../../src/lib/catalog/visible-issues";
import { activeDestination } from "../../src/components/app-shell";
describe("navegação e filtros", () => {
  it("preserva busca, nota e quantidade na URL e limita parâmetros inválidos", () => {
    const filters = catalogFilters(new URLSearchParams("q=jazz+%26+rock&nota=80&limite=45"));
    expect(catalogQuery(filters)).toBe("?q=jazz+%26+rock&nota=80&limite=45");
    expect(catalogFilters(new URLSearchParams("nota=invalid&limite=-1"))).toEqual({q:"",nota:"all",limite:15});
    expect(catalogFilters(new URLSearchParams("limite=9999999")).limite).toBe(10000);
    expect(catalogQuery({q:"",nota:"all",limite:15})).toBe("");
  });
  it("marca avaliações como parte dos álbuns e mantém rotas secundárias", () => {
    expect(activeDestination("/albuns/uuid")).toBe("/albuns");
    expect(activeDestination("/historico")).toBe("/historico");
  });
  it("oculta avisos do backlog preservando erros bloqueantes e outros avisos", () => {
    expect(visibleIssue({severity:"warning",code:"SUMMARY_DIVERGENCE",message:"Backlog difere"})).toBe(false);
    expect(visibleIssue({severity:"error",code:"MISSING_SHEET",sourceLocator:"Backlog",message:"Aba obrigatória ausente"})).toBe(true);
    expect(visibleIssue({severity:"warning",code:"SCORE_DIVERGENCE",message:"Nota divergente"})).toBe(true);
  });
});
