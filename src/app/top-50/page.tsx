import { pageSeason } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { loadCompetitionState } from "@/lib/competition/engine";
import { CompetitionView } from "@/components/competition-view";
import { SeasonLink as Link } from "@/components/season-context";
import { AppShell } from "@/components/app-shell";
import styles from "@/components/workspace.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Top 50 · Oráculo Musical" };
export default async function Top50({searchParams = Promise.resolve({})}: {searchParams?:Promise<SeasonParams>} = {}) {
  await requireOwner();
  const context = pageSeason(await searchParams);
  const source = await readPageSource(context);
  const state = await loadCompetitionState(context, source);
  return <AppShell season={context.year} title="Top 50" description="A classificação provisória da temporada, com as regras e pendências da projeção." version={source?.version}>
    <div className={styles.stack}><Link className={styles.link} href="/regras">Regras da temporada</Link><CompetitionView state={state} source={source} view="top50" /></div>
  </AppShell>;
}
