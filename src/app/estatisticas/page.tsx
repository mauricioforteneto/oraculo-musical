import { pageSeason } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getPublishedSource } from "@/lib/catalog/database";
import { buildCatalogStatistics, type CatalogStatistics } from "@/lib/catalog/statistics";
import { StatisticsPage } from "@/components/statistics-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estatísticas · Oráculo Musical" };

export default async function Statistics({searchParams = Promise.resolve({})}: {searchParams?:Promise<SeasonParams>} = {}) {
  // Authorize before any catalog access, including in development.
  await requireOwner();
  const context = pageSeason(await searchParams);
  let statistics: CatalogStatistics | null = null;
  let version: string | null = null;
  let loadFailed = false;
  try {
    const source = await getPublishedSource(context.year, context.folderId);
    if (source?.version != null) {
      statistics = buildCatalogStatistics(source.albums);
      version = String(source.version);
    }
  } catch {
    console.error("Statistics catalog load failed");
    loadFailed = true;
  }
  return <StatisticsPage key={context.year} season={context.year} statistics={statistics} version={version} loadFailed={loadFailed} />;
}
