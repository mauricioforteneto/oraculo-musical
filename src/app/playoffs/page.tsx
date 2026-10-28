import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { getCompetitionState } from "@/lib/competition/service";
import { getCompetitionPhaseHistory } from "@/lib/competition/history-database";
import { AppShell } from "@/components/app-shell";
import { CompetitionBracket } from "@/components/competition-bracket";
import { CompetitionHistory } from "@/components/competition-history";
import styles from "@/components/workspace.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Playoffs · Oráculo Musical" };
export default async function Playoffs({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireOwner();
  const historical = (await searchParams).aba === "historico";
  const source = await readPageSource();
  const state = !historical && source?.version ? await getCompetitionState(source.albums,source.playoffResults) : null;
  const history = historical && source?.version ? await getCompetitionPhaseHistory(Number(process.env.SOURCE_SEASON ?? "2026"), process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",String(source.version)) : null;
  return <AppShell title="Playoffs" description="Confrontos, resultados publicados e os caminhos de cada álbum na competição." version={source?.version}>
    <div className={styles.stack}>
      <nav className={styles.actions} aria-label="Seções dos Playoffs"><Link className={styles.action} href="/playoffs" aria-current={!historical ? "page" : undefined}>Chave e resultados</Link><Link className={styles.action} href="/playoffs?aba=historico" aria-current={historical ? "page" : undefined}>Histórico das fases</Link></nav>
      {historical ? <CompetitionHistory history={history} /> : state?.active?.bracket ? <CompetitionBracket bracket={state.active.bracket} results={source?.playoffResults ?? []} resultsVersion={source?.version == null ? null : String(source.version)} /> : <section className={styles.card}><h2>A chave ainda não foi publicada</h2><p>Os confrontos aparecerão após a confirmação do corte oficial.</p></section>}
    </div>
  </AppShell>;
}
