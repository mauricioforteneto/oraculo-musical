import type { Top50Entry, Top50Projection } from "@/lib/competition/top50";
import { SeasonLink as Link } from "./season-context";
import styles from "./competition-panel.module.css";

export function Top50Panel({ projection }: { projection: Top50Projection }) {
  const ranked = projection.entries.filter(e => e.position !== null);
  const pending = projection.entries.filter(e => e.position === null);
  const warnings = [...projection.entries, ...projection.survivors].filter(e => e.warnings.length > 0);
  return <section className={styles.top50Section} aria-labelledby="top50-title">
    <div className={styles.sectionHeading}>
      <div><span className={styles.sectionKicker}>REGRA {projection.rulesVersion}</span><h2 id="top50-title">Top 50 provisório</h2></div>
      <span className={styles.projectionTag}>PROJEÇÃO</span>
    </div>
    <div className={styles.top50Summary}>
      <div><strong>{projection.completed ? "1º e 2º" : `01–${projection.reserved}`}</strong>
        <span>{projection.completed ? "campeão e vice definidos" : `${projection.reserved} vagas reservadas aos sobreviventes`}</span></div>
      <div><strong>{projection.reserved + 1}–50</strong><span>{projection.slots} vagas disputadas por índice</span></div>
    </div>
    <p className={styles.bracketIntro}>Índice = nota original + bônus da melhor fase, sem acumular. Os eliminados disputam posição com os demais álbuns.
      {projection.completed ? " A final não congela o restante do ranking anual." : " Os sobreviventes ainda não têm posição individual; ao fim, só campeão e vice ficam protegidos."}</p>

    <details className={styles.top50Details}>
      <summary>Entenda os bônus e os desempates</summary>
      <p>Sem pós-temporada +0 · Repescagem +1 · Play-in +3 · Pré-playoff +6 · Primeira rodada dos Playoffs +8 · Oitavas +10 · Quartas +12 · Semifinais +14.</p>
      <p>Vale a fase alcançada, incluindo bye nas oitavas. Compare índice, depois fase mais avançada. Entre eliminados da mesma fase dos Playoffs, o melhor seed original vence o empate. Nas fases anteriores, valem score do Pré-playoff ou Play-in e etapa da Repescagem; depois, nota original. Empates persistentes compartilham posição; na última vaga, exigem decisão manual.</p>
      <p>Sem pós-temporada, a nota original mínima é 79. O ranking anual por nota original permanece separado.</p>
    </details>

    {projection.survivors.length > 0 && <details className={styles.top50Details}>
      <summary>{projection.survivors.length} álbuns em disputa — sem posição individual</summary>
      <ul className={styles.top50Notes}>{projection.survivors.map(e => <li key={e.identityKey}><strong>Seed #{e.seed} · {e.artist}</strong><span>{e.title} · Em disputa, sem bônus nem índice definidos</span></li>)}</ul>
    </details>}
    {projection.tieAtCut && <p className={styles.top50Notice}>Empate na última vaga: o grupo empatado permanece sem posição até uma decisão confirmada e válida na aba Desempates Top 50 ser importada.</p>}
    {(projection.appliedDecisions ?? []).length>0 && <details className={styles.top50Details}>
      <summary>Desempates manuais aplicados ({projection.appliedDecisions.length})</summary>
      <ul className={styles.top50Notes}>{projection.appliedDecisions.map(decision=><li key={decision.decisionId}>
        <strong>Decisão {decision.decisionId} · {decision.confirmedBy} · {decision.confirmedAt}</strong>
        <span>{decision.rows.map(row=>`${row.order}º ${row.artist} — ${row.title}`).join(' → ')}</span>
        <span>Confirmação: {decision.confirmationReference}</span>
        <span>Origem: {decision.rows.map(row=>`${row.sourceSheet}!${row.sourceRow}`).join(', ')}</span>
      </li>)}</ul>
    </details>}
    {(projection.decisionIssues ?? []).length>0 && <p className={styles.top50Notice}><Link href="/pendencias">Conferir decisões manuais que não puderam ser aplicadas ({projection.decisionIssues.length})</Link></p>}
    {(projection.tieAtCut || projection.unresolved>0 || projection.resultIssues.length>0 || warnings.length>0) && <p className={styles.top50Notice}><Link href="/pendencias">Conferir a central de pendências e copiar orientações para a planilha</Link></p>}
    {projection.unresolved > 0 && <p className={styles.top50Notice}>{projection.unresolved} álbum(ns) com fatos conflitantes, sem posição provisória.</p>}
    {projection.resultIssues.length > 0 && <details className={styles.top50Details}>
      <summary>Resultados pendentes de conferência</summary><ul>{projection.resultIssues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
      <p>Sem vencedor validado, não presumimos eliminação nem liberamos a vaga reservada.</p>
    </details>}

    <Top50List entries={ranked.slice(0, 8)} />
    {ranked.length === 0 && <p className={styles.bracketIntro}>Nenhuma posição por índice definida nesta publicação.</p>}
    {ranked.length > 8 && <details className={styles.top50Details}>
      <summary>Ver todas as {ranked.length} posições calculadas</summary><Top50List entries={ranked.slice(8)} />
    </details>}
    {pending.length > 0 && <details className={styles.top50Details}>
      <summary>Álbuns sem posição no Top 50 ({pending.length})</summary>
      <ul className={styles.top50Notes}>{pending.map(e => <li key={e.identityKey}><strong>{e.artist} — {e.title}</strong>
        <span>{e.phase} · {e.originalScore} + {e.bonus} = {e.index}</span><span>{e.conflicts.join("; ") || "Fora das vagas disponíveis ou empate na última vaga."}</span></li>)}</ul>
    </details>}
    {warnings.length > 0 && <details className={styles.top50Details}>
      <summary>Diferenças em relação à planilha ({warnings.length})</summary>
      <p>A posição exibida segue a regra atual. Valores derivados da planilha não substituem o cálculo.</p>
      <ul className={styles.top50Notes}>{warnings.map(e => <li key={e.identityKey}><strong>{e.artist} — {e.title}</strong><span>{e.warnings.join("; ")}</span></li>)}</ul>
    </details>}
  </section>;
}

function Top50List({ entries }: { entries: Top50Entry[] }) {
  return <ol className={styles.top50List} aria-label="Posições calculadas do Top 50">{entries.map(e => <li key={e.identityKey} value={e.position!}>
    <span className={styles.top50Position}>#{e.position}</span>
    <div className={styles.top50Identity}><strong>{e.artist}</strong><span>{e.title}</span>
      <small>{e.status === "eliminated" ? "Eliminado · " : ""}{e.phase}{e.seed !== null ? ` · seed original #${e.seed}` : ""}{e.late ? " · entrada após o corte" : ""}</small>
      {e.manualDecisionId && <small>Desempate manual · {e.manualDecisionId}</small>}
    </div>
    <div className={styles.top50Index}>{e.index === null ? <span>Posição garantida pela final</span> : <><strong>{e.index}</strong><span>{e.originalScore} + {e.bonus}</span><small>ÍNDICE</small></>}</div>
  </li>)}</ol>;
}
