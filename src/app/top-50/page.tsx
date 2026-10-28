import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { getCompetitionState } from "@/lib/competition/service";
import { AppShell } from "@/components/app-shell";
import { Top50Panel } from "@/components/top50-panel";
import styles from "@/components/workspace.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Top 50 · Oráculo Musical" };
export default async function Top50() {
  await requireOwner();
  const source = await readPageSource();
  const state = source?.version ? await getCompetitionState(source.albums,source.playoffResults) : null;
  return <AppShell title="Top 50" description="A classificação provisória da temporada, com as regras e pendências da projeção." version={source?.version}>
    {state?.projection ? <Top50Panel projection={state.projection} /> : <section className={styles.card}><h2>Aguardando o corte oficial</h2><p>A classificação calculada aparecerá após a confirmação dos participantes.</p></section>}
  </AppShell>;
}
