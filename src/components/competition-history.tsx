"use client";
import { useState } from "react";
import type { CompetitionPhaseHistory, HistoricalPhase, PhaseHistoryEntry } from "@/lib/competition/history";
import styles from "./competition-panel.module.css";
const HISTORICAL_PHASES: { id: HistoricalPhase; label: string; caption: string }[] = [
  { id: "preplayoff", label: "Pré-playoff", caption: "Última seleção antes da chave" },
  { id: "playin", label: "Play-in", caption: "Disputa pelas vagas seguintes" },
  { id: "repescagem", label: "Repescagem", caption: "Registros mencionados na fonte" },
];

function phaseScore(score: number | null) {
  return score === null ? "—" : score.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function CompetitionHistory({ history }: { history: CompetitionPhaseHistory | null }) {
  const [selectedHistoricalPhase, setSelectedHistoricalPhase] = useState<HistoricalPhase>("preplayoff");
  const historicalEntries = history?.entries.filter(entry => entry.phase === selectedHistoricalPhase)
    .sort((a,b) => (b.latest.score ?? -1) - (a.latest.score ?? -1) || a.artist.localeCompare(b.artist,"pt-BR")) ?? [];
  return <>{!history && <p>Nenhum histórico de fases disponível nesta publicação.</p>}
{history && <section className={styles.historySection} id="historico-competitivo" aria-labelledby="historical-title">
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>CAMINHOS ATÉ OS PLAYOFFS</span><h2 id="historical-title">Histórico das fases</h2></div>
        <span className={styles.sectionCount}>FONTE V{history.sourceVersion}</span>
      </div>
      <p className={styles.historyIntro}>Scores e resultados como registrados na planilha. A versão indica quando o app observou cada informação, sem atribuir data à partida.</p>
      <div className={styles.phaseSelector} role="group" aria-label="Filtrar histórico por fase">
        {HISTORICAL_PHASES.map(phase => <button key={phase.id} type="button"
          className={selectedHistoricalPhase === phase.id ? styles.phaseSelected : styles.phaseButton}
          aria-pressed={selectedHistoricalPhase === phase.id} onClick={() => setSelectedHistoricalPhase(phase.id)}>
          <strong>{phase.label}</strong><span>{history.entries.filter(entry => entry.phase === phase.id).length} registros</span><small>{phase.caption}</small>
        </button>)}
      </div>
      {historicalEntries.length > 0 ? <div className={styles.phaseHistoryGrid}>
        {historicalEntries.map(entry => <HistoricalPhaseCard key={entry.identityKey + entry.phase} entry={entry} currentVersion={history.sourceVersion} />)}
      </div> : <p className={styles.historyEmpty}>Nenhum registro desta fase nas versões publicadas.</p>}
    </section>}
  </>;
}

function HistoricalPhaseCard({ entry, currentVersion }: { entry: PhaseHistoryEntry; currentVersion: string }) {
  return <article className={styles.phaseHistoryCard}>
    <div className={styles.phaseHistoryTop}><span>{entry.current ? `REGISTRADO NA V${currentVersion}` : `ÚLTIMA EVIDÊNCIA V${entry.lastSeenVersion}`}</span>
      <strong>{entry.phase === "repescagem" ? "REGISTRO" : entry.latest.score === null ? "SEM SCORE" : `${phaseScore(entry.latest.score)} / 25`}</strong></div>
    <div className={styles.phaseHistoryIdentity}><strong>{entry.artist}</strong><span>{entry.title}</span></div>
    <p className={styles.phaseHistoryResult}>{entry.latest.result || "Resultado não informado na fonte"}</p>
    {entry.latest.detail && <p className={styles.phaseHistoryDetail}>{entry.latest.detail}</p>}
    <div className={styles.phaseHistorySource}>Álbuns 2026 · linha {entry.latest.sourceRow} · primeira evidência v{entry.firstSeenVersion}</div>
    {!entry.current && <p className={styles.phaseHistoryStale}>Esta fase não consta na v{currentVersion} publicada.</p>}
    {entry.revisions.length > 1 && <details className={styles.phaseHistoryRevisions}>
      <summary>Ver alterações observadas ({entry.revisions.length})</summary>
      <ol>{entry.revisions.map((revision, index) => <li key={revision.version + "-" + index}>
        <strong>v{revision.version} · linha {revision.sourceRow}</strong>
        <span>{revision.score === null ? "Sem score" : `${phaseScore(revision.score)} / 25`}{revision.result ? ` · ${revision.result}` : ""}</span>
        {revision.detail && <small>{revision.detail}</small>}
      </li>)}</ol>
    </details>}
  </article>;
}
