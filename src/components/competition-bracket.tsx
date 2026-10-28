"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Trophy } from "lucide-react";
import type { PublishedPlayoffResult } from "@/lib/catalog/types";
import { buildBracketView, type BracketGame, type BracketPhaseId, type BracketSide } from "@/lib/competition/bracket";
import { MATCH_PENDING_LABELS, type Bracket, type Participant } from "@/lib/competition/rules";
import styles from "./competition-panel.module.css";

export function CompetitionBracket({ bracket, results, resultsVersion }: {
  bracket: Bracket; results: PublishedPlayoffResult[]; resultsVersion: string | null;
}) {
  const view = buildBracketView(bracket, results);
  const [selected, setSelected] = useState<BracketPhaseId | null>(null);
  const phase = view.phases.find(item => item.id === (selected ?? view.initialPhase))!;
  const panelId = useId();
  const title = phase.id === "roundOf16" ? "Oitavas de final" : phase.label;

  return <section id="chaveamento" className={`${styles.roundSection} ${styles.bracketView}`} aria-label="Chave do campeonato">
    <div className={styles.bracketNavigation} role="group" aria-label="Escolher fase do campeonato">
      {view.phases.map(item => <button key={item.id} type="button" aria-pressed={item.id === phase.id}
        aria-controls={panelId} className={item.id === phase.id ? styles.phaseSelected : styles.phaseButton}
        onClick={() => setSelected(item.id)}>
        <strong>{item.label}</strong><span>{item.games.length} {item.games.length === 1 ? "jogo" : "jogos"}</span>
        <small>{item.defined ? "Participantes definidos" : "Caminhos previstos"}</small>
      </button>)}
    </div>

    {view.pending.length > 0 && <details className={styles.bracketPending}>
      <summary>{view.pending.length} {view.pending.length === 1 ? "jogo pendente" : "jogos pendentes"} na primeira rodada · oitavas aguardam definição</summary>
      <ul>{view.pending.map(item => <li key={item.game}><strong>{item.game}:</strong> {MATCH_PENDING_LABELS[item.reason]}</li>)}</ul>
    </details>}

    <div id={panelId} role="region" aria-label={title}>
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>CHAVE PRINCIPAL</span><h3>{title}</h3></div>
        <span className={styles.reseedTag}>{phase.id === "first" ? "RODADA INICIAL" : phase.id === "roundOf16" ? "RESEEDING ÚNICO" : "CHAVE FIXA"}</span>
      </div>

      {phase.id === "first" && bracket.byes.length > 0 && <div className={styles.byeBlock}>
        <div className={styles.blockHeading}><span className={styles.byeIcon}><ArrowUpRight size={14} aria-hidden="true" /></span>
          <div><strong>Direto para as oitavas</strong><span>{bracket.byes.length} participantes com bye</span></div></div>
        <div className={styles.byeGrid}>{bracket.byes.map(p => <div className={styles.byeCard} key={p.identityKey}>
          <span className={styles.byeSeed}>#{p.seed}</span><span className={styles.byeIdentity}><strong>{p.artist}</strong><small>{p.title}</small></span>
          <span className={styles.byeScore}>{p.originalScore}<small>NOTA</small></span>
        </div>)}</div>
      </div>}

      {phase.id === "roundOf16" && <p className={styles.bracketIntro}>{phase.defined
        ? "Os 16 classificados foram reordenados pelos seeds congelados: vencedores da primeira rodada e participantes com bye. A partir daqui, a chave fica fixa."
        : "Os cruzamentos indicam posições entre os 16 sobreviventes. Os participantes serão definidos após resolver todos os vencedores da primeira rodada."}</p>}
      {phase.id !== "first" && <p className={styles.bracketIntro}>{phase.games.some(g => g.resolution?.result)
        ? `${phase.games.filter(g => g.resolution?.result).length} de ${phase.games.length} resultados publicados nesta fase. Os vencedores avançam sem novo reseeding.`
        : "Sem resultados publicados nesta fase. As vagas seguintes aguardam os vencedores, sem novo reseeding."}</p>}
      {phase.id === "final" && view.champion && <div className={styles.bracketChampion}>
        <Trophy size={24} aria-hidden="true" /><div><strong>Campeão · #{view.champion.seed} {view.champion.artist}</strong><span>{view.champion.title}</span></div>
      </div>}

      <div className={styles.matchGrid}>{phase.games.map(game => <BracketGameCard key={game.id} game={game} resultsVersion={resultsVersion} />)}</div>
    </div>
  </section>;
}

function BracketGameCard({ game, resultsVersion }: { game: BracketGame; resultsVersion: string | null }) {
  const result = game.resolution?.result;
  return <article className={styles.matchCard} aria-label={game.label}>
    <div className={styles.matchTop}><span>{game.label}</span>
      <span className={result ? styles.resultPublished : styles.pendingResult}>{result ? `RESULTADO · V${resultsVersion ?? "?"}` : "AGUARDA RESULTADO"}</span>
    </div>
    <BracketMatchSide side={game.high} />
    <div className={styles.versus}><span>VS</span><i /></div>
    <BracketMatchSide side={game.low} />
    {result && <div className={styles.matchOutcome}>
      <span className={styles.outcomeIcon}><Trophy size={14} aria-hidden="true" /></span>
      <div><small>RESULTADO PUBLICADO · LINHA {result.sourceRow}</small><strong>{result.result || "Resultado informado na fonte"}</strong>
        {result.winner && <span><b>Vencedor:</b> {result.winner}</span>}
        {result.sourceSheet && <small>FONTE: {result.sourceSheet} · {result.gameId}</small>}
        {result.criterion && <small className={styles.outcomeCriterion}>{result.criterion}</small>}
      </div>
    </div>}
    {game.resolution?.pending && <p className={styles.bracketIssue}>{MATCH_PENDING_LABELS[game.resolution.pending]}</p>}
    <div className={styles.matchFooter}><span>{game.resolution?.winner ? "VENCEDOR IDENTIFICADO" : "AGUARDA DEFINIÇÃO"}</span><span>SEED E NOTA ORIGINAL /100</span></div>
  </article>;
}

function BracketMatchSide({ side }: { side: BracketSide }) {
  if (!side.participant) return <p className={styles.bracketPlaceholder}>{side.origin}</p>;
  const p: Participant = side.participant;
  return <div className={styles.matchSide}>
    <span className={styles.matchSeed}>#{p.seed}</span>
    <span className={styles.matchIdentity}><strong>{p.artist}</strong><small>{p.title}</small></span>
    <span className={styles.matchScore} aria-label={`Nota original: ${p.originalScore} de 100`}>{p.originalScore}</span>
  </div>;
}
