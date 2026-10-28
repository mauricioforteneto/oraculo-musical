import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getPublishedSource } from "@/lib/catalog/database";
import { buildCatalogStatistics, type CatalogStatistics } from "@/lib/catalog/statistics";
import { StatisticsPage } from "@/components/statistics-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estatísticas · Oráculo Musical" };

export default async function Statistics() {
  // Authorize before any catalog access, including in development.
  await requireOwner();
  let statistics: CatalogStatistics | null = null;
  let version: string | null = null;
  let loadFailed = false;
  try {
    const source = await getPublishedSource(Number(process.env.SOURCE_SEASON ?? "2026"), process.env.GOOGLE_DRIVE_FOLDER_ID ?? "");
    if (source?.version != null) {
      statistics = buildCatalogStatistics(source.albums);
      version = String(source.version);
    }
  } catch {
    console.error("Statistics catalog load failed");
    loadFailed = true;
  }
  return <StatisticsPage statistics={statistics} version={version} loadFailed={loadFailed} />;
}
