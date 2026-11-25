import { pageSeason } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import { Dashboard } from "@/components/dashboard";
import { getLocalSourcePreview } from "@/lib/catalog/local-preview";
import { getPublishedSource } from "@/lib/catalog/database";
import { authConfigured, requireOwner } from "@/lib/auth";
import { headers } from "next/headers";
import { loadCompetitionState } from "@/lib/competition/engine";
import { MonthlyCompetition } from "@/components/monthly-competition";
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

export default async function Home({searchParams = Promise.resolve({})}: {searchParams?:Promise<SeasonParams>} = {}) {
  const params = await searchParams;
  const requestedYear = params.temporada ?? process.env.SOURCE_SEASON ?? "2026";
  const usingPreview = requestedYear === "2026" && process.env.NODE_ENV === "development" && !process.env.DATABASE_READ_URL;
  const localPreview = usingPreview
    && !authConfigured()
    && isLoopbackHost((await headers()).get("host"));

  if (!localPreview) await requireOwner();
  const context = pageSeason(params);
  const season = context.year;
  const folderId = context.folderId;
  const source = usingPreview
    ? await getLocalSourcePreview()
    : process.env.DATABASE_READ_URL && folderId ? await getPublishedSource(season, folderId) : null;
  const state = !usingPreview ? await loadCompetitionState(context, source) : null;
  const competition = state?.format === "legacy-2026" ? state.data : null;
  return <AppShell season={context.year} title="O ano em discos." description="Um retrato da sua escuta, da primeira avaliação à disputa pelo Top 50." version={source?.version} localPreview={usingPreview}>
    <Dashboard source={source} competition={competition} monthly={context.year === 2027} />
    {state?.format === "monthly" && <MonthlyCompetition state={state.data} />}
  </AppShell>;
}
