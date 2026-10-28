export type CatalogFilters = { q: string; nota: "all" | "90" | "80" | "70"; limite: number };
type Params = { get(name: string): string | null };
export function catalogFilters(params: Params): CatalogFilters {
  const nota = params.get("nota");
  const requested = Number(params.get("limite"));
  return { q: (params.get("q") ?? "").slice(0,200), nota: nota === "90" || nota === "80" || nota === "70" ? nota : "all",
    limite: Number.isSafeInteger(requested) && requested >= 15 ? Math.min(requested,10000) : 15 };
}
export function catalogQuery(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q",filters.q);
  if (filters.nota !== "all") params.set("nota", filters.nota);
  if (filters.limite > 15) params.set("limite",String(filters.limite));
  const query = params.toString();
  return query ? `?${query}` : "";
}
