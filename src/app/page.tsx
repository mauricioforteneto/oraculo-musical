import { Dashboard } from "@/components/dashboard";
import { getLocalSourcePreview } from "@/lib/catalog/local-preview";
import { getPublishedSource } from "@/lib/catalog/database";
import { authConfigured, requireOwner } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompetitionState } from "@/lib/competition/service";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

function isLoopbackHost(value: string | null) {
  if (!value) return false;
  const host = value.trim().toLowerCase();
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export default async function Home() {
  const season = Number(process.env.SOURCE_SEASON ?? "2026");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  const usingPreview = process.env.NODE_ENV === "development" && !process.env.DATABASE_READ_URL;
  const localPreview = usingPreview
    && !authConfigured()
    && isLoopbackHost((await headers()).get("host"));

  if (!localPreview) await requireOwner();
  const source = usingPreview
    ? await getLocalSourcePreview()
    : process.env.DATABASE_READ_URL ? await getPublishedSource(season, folderId) : null;
  const competition = !usingPreview && source?.version ? await getCompetitionState(source.albums, source.playoffResults, source.top50Decisions) : null;
  return <AppShell title="O ano em discos." description="Um retrato da sua escuta, da primeira avaliação à disputa pelo Top 50." version={source?.version} localPreview={usingPreview}>
    <Dashboard source={source} competition={competition} />
  </AppShell>;
}
