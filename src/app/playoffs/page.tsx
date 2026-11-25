import { pageSeason } from "@/lib/seasons/context";
import { SeasonLink as Link } from "@/components/season-context";
import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { loadCompetitionState } from "@/lib/competition/engine";
import { CompetitionView } from "@/components/competition-view";
import { getCompetitionPhaseHistory } from "@/lib/competition/history-database";
import { AppShell } from "@/components/app-shell";
import { CompetitionHistory } from "@/components/competition-history";
import styles from "@/components/workspace.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Playoffs · Oráculo Musical" };
export default async function Playoffs({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireOwner();
  const context = pageSeason(await searchParams);
  const historical = context.format === "legacy-2026" && (await searchParams).aba === "historico";
  const source = await readPageSource(context);
  const state = historical ? { format: "legacy-2026", data: null } as const : await loadCompetitionState(context, source);
  const history = historical && source?.version ? await getCompetitionPhaseHistory(context.year, context.folderId, String(source.version)) : null;
  return <AppShell season={context.year} title={context.format === "monthly" ? "Classificação mensal" : "Playoffs"} description={context.format === "monthly" ? undefined : "Confrontos, resultados publicados e os caminhos de cada álbum na competição."} version={source?.version}>
    <div className={styles.stack}>
      {context.format === "legacy-2026" && <nav className={styles.actions} aria-label="Seções dos Playoffs"><Link className={styles.action} href="/playoffs" aria-current={!historical ? "page" : undefined}>Chave e resultados</Link><Link className={styles.action} href="/playoffs?aba=historico" aria-current={historical ? "page" : undefined}>Histórico das fases</Link></nav>}
      <Link className={styles.link} href="/regras">Regras da temporada</Link>
      {historical ? <CompetitionHistory history={history} /> : <CompetitionView state={state} source={source} />}
    </div>
  </AppShell>;
}
