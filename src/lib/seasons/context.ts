import "server-only";
import { notFound } from "next/navigation";
import { seasonDefinition, type SeasonDefinition, type SeasonParams } from "./definitions";

export type SeasonContext = SeasonDefinition & { folderId: string };
export class SeasonError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "SeasonError"; }
}
export function defaultSeason() {
  const raw = process.env.SOURCE_SEASON ?? "2026";
  if (!/^\d{4}$/.test(raw)) throw new SeasonError("SOURCE_NOT_CONFIGURED");
  return Number(raw);
}
export function sourceFolders(): Record<string, string> {
  const raw = process.env.SEASON_SOURCES_JSON;
  if (raw === undefined || raw === "") return { [defaultSeason()]: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "" };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const entries = Object.entries(value);
    if (entries.some(([year, folder]) => !/^\d{4}$/.test(year) || typeof folder !== "string" || !/^[\w-]+$/.test(folder))) throw new Error();
    if (new Set(entries.map(([, folder]) => folder)).size !== entries.length) throw new Error();
    return Object.fromEntries(entries) as Record<string, string>;
  } catch { throw new SeasonError("SOURCE_CONFIGURATION_INVALID"); }
}
export function seasonContext(raw?: string | string[] | null): SeasonContext {
  if (Array.isArray(raw) || (raw != null && !/^\d{4}$/.test(raw))) throw new SeasonError("INVALID_SEASON");
  const year = raw == null ? defaultSeason() : Number(raw);
  const definition = (() => { try { return seasonDefinition(year); } catch { throw new SeasonError("SEASON_UNAVAILABLE"); } })();
  return { ...definition, folderId: sourceFolders()[String(year)] ?? "" };
}
export function pageSeason(params: SeasonParams = {}) {
  try { return seasonContext(params.temporada); }
  catch (error) { if (error instanceof SeasonError && ["INVALID_SEASON", "SEASON_UNAVAILABLE"].includes(error.code)) notFound(); throw error; }
}
export function pageSeasonDefinition(params: SeasonParams = {}) {
  const raw = params.temporada;
  if (Array.isArray(raw) || (raw != null && !/^\d{4}$/.test(raw))) notFound();
  try { return seasonDefinition(raw == null ? defaultSeason() : Number(raw)); } catch { notFound(); }
}
export function requestSeason(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.getAll("temporada").length > 1) throw new SeasonError("INVALID_SEASON");
  return seasonContext(params.get("temporada"));
}
