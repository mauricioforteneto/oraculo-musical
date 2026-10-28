import type { ArtworkFilter } from "@/lib/artwork/review";
export type CatalogFilters = { q: string; nota: "all" | "90" | "80" | "70"; limite: number; capas?: ArtworkFilter };
type Params = { get(name: string): string | null };
export function catalogFilters(params: Params): CatalogFilters {
  const nota = params.get("nota");
  const capas = params.get("capas");
  const requested = Number(params.get("limite"));
  return { ...(capas === "revisar" || capas === "sem-capa" || capas === "falhas" ? {capas} : {}), q: (params.get("q") ?? "").slice(0,200), nota: nota === "90" || nota === "80" || nota === "70" ? nota : "all",
    limite: Number.isSafeInteger(requested) && requested >= 15 ? Math.min(requested,10000) : 15 };
}
export function catalogQuery(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q",filters.q);
  if (filters.nota !== "all") params.set("nota", filters.nota);
  if (filters.limite > 15) params.set("limite",String(filters.limite));
  if (filters.capas) params.set("capas", filters.capas);
  const query = params.toString();
  return query ? `?${query}` : "";
}
