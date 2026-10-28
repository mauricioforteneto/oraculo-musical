import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { getVersionHistory } from "@/lib/catalog/version-history-database";
import type { VersionHistoryData } from "@/lib/catalog/version-history";
import { VersionHistoryPage } from "@/components/version-history-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Histórico de versões · Oráculo Musical" };

export default async function History({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const params = await searchParams;
  let history: VersionHistoryData | null = null;
  let loadFailed = false;
  try {
    history = await getVersionHistory(Number(process.env.SOURCE_SEASON ?? "2026"), process.env.GOOGLE_DRIVE_FOLDER_ID ?? "", params.versao, params.pagina);
  } catch {
    loadFailed = true; console.error("Version history load failed");
  }
  return <VersionHistoryPage key={history?.selected.version ?? "empty"} history={history} loadFailed={loadFailed} />;
}
