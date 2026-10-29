import { requireOwner } from "@/lib/auth";
import { readPageSource, synchronizationReady } from "@/lib/catalog/page-source";
import { getCompetitionState } from "@/lib/competition/service";
import { AppShell } from "@/components/app-shell";
import { SynchronizationPage } from "@/components/synchronization-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sincronização · Oráculo Musical" };
export default async function Synchronization() {
  await requireOwner();
  const source = await readPageSource();
  const competition = source?.version ? await getCompetitionState(source.albums,source.playoffResults,source.top50Decisions) : null;
  return <AppShell title="Sincronização" description="Publique a versão mais recente da planilha e confira os relatórios e operações do corte." version={source?.version}>
    <SynchronizationPage source={source} ready={synchronizationReady()} competition={competition} />
  </AppShell>;
}
