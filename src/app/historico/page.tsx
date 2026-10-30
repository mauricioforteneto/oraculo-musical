import { pageSeason } from "@/lib/seasons/context";
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
  const context = pageSeason(params);
  let history: VersionHistoryData | null = null;
  let loadFailed = false;
  try {
    history = context.folderId ? await getVersionHistory(context.year, context.folderId, params.versao, params.pagina) : null;
  } catch {
    loadFailed = true; console.error("Version history load failed");
  }
  return <VersionHistoryPage season={context.year} key={`${context.year}:${history?.selected.version ?? "empty"}`} history={history} loadFailed={loadFailed} />;
}
