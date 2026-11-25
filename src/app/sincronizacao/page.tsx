import { pageSeason } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import { requireOwner } from "@/lib/auth";
import { readPageSource, synchronizationReady } from "@/lib/catalog/page-source";
import { loadCompetitionState } from "@/lib/competition/engine";
import { AppShell } from "@/components/app-shell";
import { SynchronizationPage } from "@/components/synchronization-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sincronização · Oráculo Musical" };
export default async function Synchronization({searchParams = Promise.resolve({})}: {searchParams?:Promise<SeasonParams>} = {}) {
  await requireOwner();
  const context = pageSeason(await searchParams);
  const source = await readPageSource(context);
  const state = await loadCompetitionState(context, source);
  const competition = state.format === "legacy-2026" ? state.data : null;
  return <AppShell season={context.year} title="Sincronização" description="Publique a versão mais recente da planilha e confira os relatórios e operações do corte." version={source?.version}>
    <SynchronizationPage source={source} ready={synchronizationReady(context)} competition={competition} />
  </AppShell>;
}
