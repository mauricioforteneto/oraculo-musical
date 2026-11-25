import type { CompetitionState } from "@/lib/competition/engine";
import type { LocalSourcePreview } from "@/lib/catalog/types";
import { CompetitionBracket } from "./competition-bracket";
import { Top50Panel } from "./top50-panel";
import { MonthlyCompetition } from "./monthly-competition";
import { SeasonLink as Link } from "./season-context";
import styles from "./workspace.module.css";
export function CompetitionView({ state, source, view = "championship" }: {state:CompetitionState;source:LocalSourcePreview|null;view?:"championship"|"top50"}) {
  if (state.format === "monthly") return view === "top50" ? <section className={styles.card}><h2>Top 50 competitivo em definição</h2><p>O ranking anual por nota original permanece disponível em Álbuns. O mata-mata e a composição do Top 50 de 2027 serão definidos em uma próxima entrega.</p><Link className={styles.action} href="/regras">Consultar regras de 2027</Link><Link className={styles.action} href="/playoffs">Ver classificação mensal</Link></section> : <MonthlyCompetition key="2027-principal" state={state.data} />;
  if (view === "top50") return state.data?.projection ? <Top50Panel projection={state.data.projection} /> : <section className={styles.card}><h2>Aguardando o corte oficial</h2><p>A classificação calculada aparecerá após a confirmação dos participantes.</p></section>;
  return state.data?.active?.bracket ? <CompetitionBracket bracket={state.data.active.bracket} results={source?.playoffResults ?? []} resultsVersion={source?.version == null ? null : String(source.version)} />
    : <section className={styles.card}><h2>A chave ainda não foi publicada</h2><p>Os confrontos aparecerão após a confirmação do corte oficial.</p></section>;
}
