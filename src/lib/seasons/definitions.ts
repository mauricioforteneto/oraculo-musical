import { RULES_VERSION } from "@/lib/competition/rules";
import { TOP50_RULES_VERSION } from "@/lib/competition/top50";
export const MONTHLY_RULES = { version: "2027-monthly-1", slotsPerMonth: 2, releaseYearMatchesSeason: true, timezone: "America/Sao_Paulo" } as const;
export const SEASONS = [
  { year: 2026, competitionId: "2026-principal", format: "legacy-2026", ruleVersions: [RULES_VERSION, TOP50_RULES_VERSION], title: "Campeonato 2026" },
  { year: 2027, competitionId: "2027-principal", format: "monthly", ruleVersions: [MONTHLY_RULES.version], title: "Campeonato 2027" },
] as const;
export type SeasonDefinition = typeof SEASONS[number];
export type SeasonParams = Record<string, string | string[] | undefined>;
export function seasonDefinition(year: number): SeasonDefinition {
  const definition = SEASONS.find(item => item.year === year);
  if (!definition) throw new Error("SEASON_UNAVAILABLE");
  return definition;
}
export function seasonHref(href: string, year: number, explicit = true) {
  if (!explicit || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/auth/")) return href;
  const url = new URL(href, "http://local.invalid");
  url.searchParams.set("temporada", String(year));
  return url.pathname + url.search + url.hash;
}
