"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Disc3, LockKeyhole, Radio, Sparkles, Trophy } from "lucide-react";
import type { getCompetitionState, previewFreeze, FreezeMode } from "@/lib/competition/service";
import type { PublishedPlayoffResult } from "@/lib/catalog/types";
import { resultForMatch, type Bracket, type Participant } from "@/lib/competition/rules";
import type { CompetitionPhaseHistory, HistoricalPhase, PhaseHistoryEntry } from "@/lib/competition/history";
import styles from "./competition-panel.module.css";
import { CompetitionBracket } from "./competition-bracket";

type State = Awaited<ReturnType<typeof getCompetitionState>>;
type Preview = Awaited<ReturnType<typeof previewFreeze>>;
function dateTime(value: string) { return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }); }
function label(p: Participant) { return `#${p.seed} ${p.artist} — ${p.title}`; }
function routeLabel(route: Participant["route"]) { return route === "elite" ? "Elite" : route === "direct" ? "Entrada direta" : "Pré-playoff"; }
const HISTORICAL_PHASES: { id: HistoricalPhase; label: string; caption: string }[] = [
  { id: "preplayoff", label: "Pré-playoff", caption: "Última seleção antes da chave" },
  { id: "playin", label: "Play-in", caption: "Disputa pelas vagas seguintes" },
  { id: "repescagem", label: "Repescagem", caption: "Registros mencionados na fonte" },
];

function phaseScore(score: number | null) {
  return score === null ? "—" : score.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function CompetitionPanel({ state, ready, sourceTop50Positions, playoffResults, resultsVersion, history }: {
  state: State | null;
  ready: boolean;
  sourceTop50Positions: number;
  playoffResults: PublishedPlayoffResult[];
  resultsVersion: string | null;
  history: CompetitionPhaseHistory | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [backup, setBackup] = useState(false);
  const [eligibility, setEligibility] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedHistoricalPhase, setSelectedHistoricalPhase] = useState<HistoricalPhase>("preplayoff");
  const mode: FreezeMode = state?.active ? "correction" : "initial";

  async function loadPreview(selectedMode: FreezeMode) {
    setBusy(true); setFeedback(""); setPreview(null);
    try {
      const response = await fetch("/api/competition/preview", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selectedMode }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "PREVIEW_FAILED");
      setPreview(result as Preview);
    } catch (error) { setFeedback(`Prévia indisponível: ${error instanceof Error ? error.message : "PREVIEW_FAILED"}.`); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!ready || state?.active) return;
    const controller = new AbortController();
    void fetch("/api/competition/preview", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "initial" }), signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "PREVIEW_FAILED"); return result as Preview; })
      .then(result => setPreview(result))
      .catch(error => { if (!controller.signal.aborted) setFeedback(`Prévia indisponível: ${error instanceof Error ? error.message : "PREVIEW_FAILED"}.`); });
    return () => controller.abort();
  }, [ready, state?.active]);

  async function confirm() {
    if (!preview || !preview.canConfirm || !backup || busy) return;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/competition/freeze", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        mode: preview.mode, token: preview.token, backupAttested: backup, eligibilityAttested: eligibility, noMatchAttested: noMatch, reason,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "FREEZE_FAILED");
      setFeedback(`Snapshot confirmado: ${result.participants} participantes da versão ${result.fileVersion}.`);
      setPreview(null); setBackup(false); setEligibility(false); setNoMatch(false); setReason(""); router.refresh();
    } catch (error) { setFeedback(`Confirmação recusada: ${error instanceof Error ? error.message : "FREEZE_FAILED"}. Refaça a prévia se o arquivo mudou.`); }
    finally { setBusy(false); }
  }

  const participants = preview?.participants ?? state?.active?.participants ?? [];
  const bracket: Bracket | null = preview?.bracket ?? state?.active?.bracket ?? null;
  const projection = preview?.projection ?? state?.projection;
  const active = Boolean(state?.active);
  const draft = Boolean(preview?.draft);
  const reserved = projection?.reserved ?? participants.length;
  const firstRoundStatus = active ? "CHAVE CONGELADA" : draft ? "PRÉVIA DO CORTE" : "CHAVE A PUBLICAR";
  const publishedMatchCount = bracket?.matches.filter(match => resultForMatch(match.high, match.low, playoffResults) !== null).length ?? 0;
  const historicalEntries = history?.entries.filter(entry => entry.phase === selectedHistoricalPhase)
    .sort((a, b) => (b.latest.score ?? -1) - (a.latest.score ?? -1) || a.artist.localeCompare(b.artist, "pt-BR")) ?? [];

  return <section className={styles.panel} id="top-50" aria-labelledby="competition-title">
    <div className={styles.hero}>
      <div className={styles.heroArt} aria-hidden="true">
        <div className={styles.heroOrbit} />
        <div className={styles.heroRecord}><Disc3 size={72} strokeWidth={0.8} /><span>2026</span></div>
        <span className={styles.heroSpark}><Sparkles size={17} /></span>
        <span className={styles.heroIndex}>LADO B<br />PLAYOFFS</span>
      </div>
      <div className={styles.heroCopy}>
        <div className={styles.eyebrow}><span className={styles.liveDot} />TEMPORADA 2026 <span className={styles.eyebrowDivider}>/</span> DISPUTA PELO TOP 50</div>
        <h2 id="competition-title">Playoffs <em>em andamento.</em></h2>
        <p>Acompanhe os confrontos, os caminhos até a final e a projeção das vagas restantes do Top 50.</p>
        <div className={styles.heroMeta}>
          <span className={active ? styles.liveBadge : styles.neutralBadge}><Radio size={12} aria-hidden="true" />{firstRoundStatus}</span>
          {active && state?.active && <span className={styles.snapshotBadge}><LockKeyhole size={11} aria-hidden="true" />CHAVE CONGELADA · V{state.active.fileVersion}</span>}
        </div>
      </div>
      <a className={styles.jumpLink} href="#chaveamento">Ver chave <ArrowDown size={14} aria-hidden="true" /></a>
    </div>

    {!ready && !state?.active && <div className={styles.setupNotice}>
      <span className={styles.setupIcon}><Trophy size={17} aria-hidden="true" /></span>
      <div><strong>A chave está sendo preparada</strong><p>A prévia do Drive aparece aqui após configurar a sincronização privada.</p></div>
    </div>}

    {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}

    {participants.length > 0 && <div className={styles.scoreboard} aria-label="Resumo da chave">
      <div><strong>{participants.length}</strong><span>participantes</span></div>
      <div><strong>{bracket?.matches.length ?? "—"}</strong><span>confrontos na 1ª rodada</span></div>
      <div><strong>{bracket?.byes.length ?? "—"}</strong><span>avançam direto</span></div>
      <div className={styles.scoreboardNote}><span className={styles.pulseDot} />
        {publishedMatchCount > 0
          ? `${publishedMatchCount} resultado${publishedMatchCount === 1 ? "" : "s"} publicado${publishedMatchCount === 1 ? "" : "s"} na primeira rodada${resultsVersion ? ` · fonte v${resultsVersion}` : ""}`
          : `Nenhum resultado de confronto identificado${resultsVersion ? ` na v${resultsVersion} sincronizada` : " na fonte sincronizada"}`}
      </div>
    </div>}

    {bracket && <CompetitionBracket bracket={bracket} results={playoffResults} resultsVersion={resultsVersion} />}

    {!bracket && <div className={styles.emptyBracket} id="chaveamento">
      <div className={styles.emptyBracketIcon}><Trophy size={22} aria-hidden="true" /></div>
      <div><strong>A chave ainda não foi publicada</strong><p>Seeds, confrontos e projeção aparecem após a leitura e confirmação do corte oficial.</p></div>
    </div>}

    {projection && <section className={styles.top50Section} aria-labelledby="top50-title">
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>CORRIDA PELAS 50 POSIÇÕES</span><h3 id="top50-title">Top 50 provisório</h3></div>
        <span className={styles.projectionTag}>PROJEÇÃO</span>
      </div>
      <div className={styles.projectionIntro}>
        <div><strong>01–{reserved}</strong><span>vagas reservadas aos participantes dos Playoffs</span></div>
        <div className={styles.projectionArrow}><ArrowDown size={15} aria-hidden="true" /></div>
        <div><strong>{projection.slots}</strong><span>vagas residuais calculadas pela versão publicada</span></div>
        <p>Índice = nota original + maior bônus comprovado.</p>
      </div>
      {projection.tieAtCut && <p className={styles.warning}>Empate na última vaga: posição depende de decisão manual.</p>}
      {projection.unresolved > 0 && <p className={styles.warning}>{projection.unresolved} divergência(s) de fase ou fonte sem posição definitiva.</p>}
      <ol className={styles.residualList}>
        {projection.entries.filter(entry => entry.position !== null).slice(0, 6).map(entry => <li key={entry.identityKey}>
          <span className={styles.residualPosition}>#{entry.position}</span><span className={styles.residualIdentity}><strong>{entry.artist}</strong><small>{entry.title}</small></span>
          <span className={styles.residualPhase}>{entry.phase}</span><span className={styles.residualMath}>{entry.originalScore} <i>+</i> {entry.bonus} <i>=</i> <strong>{entry.index}</strong></span>
        </li>)}
      </ol>
      {projection.entries.filter(entry => entry.position !== null).length > 6 && <details className={styles.details}>
        <summary>Ver todas as {projection.entries.filter(entry => entry.position !== null).length} posições provisórias</summary>
        <ol className={styles.residualList}>{projection.entries.filter(entry => entry.position !== null).slice(6).map(entry => <li key={entry.identityKey}>
          <span className={styles.residualPosition}>#{entry.position}</span><span className={styles.residualIdentity}><strong>{entry.artist}</strong><small>{entry.title}</small></span>
          <span className={styles.residualPhase}>{entry.phase}</span><span className={styles.residualMath}>{entry.originalScore} <i>+</i> {entry.bonus} <i>=</i> <strong>{entry.index}</strong></span>
        </li>)}</ol>
      </details>}
      {projection.entries.some(entry => entry.conflicts.length > 0 || entry.position === null) && <details className={styles.details}>
        <summary>Itens sem posição provisória</summary><ul className={styles.conflictList}>{projection.entries.filter(entry => entry.conflicts.length > 0 || entry.position === null).map(entry => <li key={entry.identityKey}>
          <strong>{entry.artist} — {entry.title}</strong><span>{entry.conflicts.join("; ") || "Fora das vagas / empate na última vaga"}</span>
        </li>)}</ul>
      </details>}
    </section>}
    {!projection && sourceTop50Positions > 0 && <p className={styles.pendingProjection}>{sourceTop50Positions} posições informadas pela fonte aguardam a projeção calculada.</p>}

    {history && <section className={styles.historySection} id="historico-competitivo" aria-labelledby="historical-title">
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>CAMINHOS ATÉ OS PLAYOFFS</span><h3 id="historical-title">Histórico das fases</h3></div>
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

    {participants.length > 0 && <details className={styles.details}>
      <summary>{active ? "Elenco e seeds congelados" : "Participantes e seeds da prévia"} ({participants.length})</summary><div className={styles.participantGrid}>{participants.map(p => <div key={p.identityKey}>
        <span>#{p.seed}</span><strong>{p.artist}</strong><small>{p.title} · {routeLabel(p.route)} · nota {p.originalScore}</small>
      </div>)}</div>
    </details>}

    {state?.active && <div className={styles.activeMeta}><LockKeyhole size={13} aria-hidden="true" /><span>Snapshot ativo · v{state.active.fileVersion}</span><small>{state.active.fileName} · {dateTime(state.active.frozenAt)} · SHA-256 {state.active.sha256}{state.active.correctionReason ? ` · Correção: ${state.active.correctionReason}` : ""}</small></div>}

    <details className={styles.operator} open={!state?.active && Boolean(preview?.canConfirm)}>
      <summary><span>Operação do corte e auditoria</span><span>Prévia, confirmação e histórico</span></summary>
      <div className={styles.operatorBody}>
        {ready && <button className={styles.action} type="button" disabled={busy} onClick={() => void loadPreview(mode)}>{busy ? "Lendo…" : state?.active ? "Prévia de correção" : "Atualizar prévia do corte"}</button>}
        {!ready && <p>A prévia do Drive ficará disponível após configurar a sincronização privada.</p>}
        {preview && <div className={styles.preview}>
          <div className={styles.meta}><strong>{preview.draft ? "Rascunho mutável" : "Arquivo candidato"} · v{preview.file.version}</strong><span>{preview.file.name} · modificado {dateTime(preview.file.modifiedAt)}</span><span>SHA-256 {preview.file.sha256}</span><span>{preview.participants.length} participantes · {preview.issues.filter(i => i.severity === "error").length} erros · {preview.issues.filter(i => i.severity === "warning").length} avisos</span></div>
          {preview.issues.length > 0 && <details><summary>Divergências da fonte ({preview.issues.length})</summary><ul>{preview.issues.map((issue, i) => <li key={i}>{issue.severity === "error" ? "Bloqueio" : "Aviso"}: {issue.message}{"sourceRow" in issue && issue.sourceRow ? ` · linha ${issue.sourceRow}` : ""}</li>)}</ul></details>}
          {preview.mode === "correction" && <div className={styles.meta}><strong>Comparação com snapshot ativo</strong><span>Adicionados: {preview.changes.added.map(label).join("; ") || "nenhum"}</span><span>Removidos: {preview.changes.removed.map(label).join("; ") || "nenhum"}</span><span>Seed, rota ou nota alterados: {preview.changes.changed.map(label).join("; ") || "nenhum"}</span></div>}
          {preview.canConfirm && <div className={styles.confirm}>
            <label><input type="checkbox" checked={backup} onChange={e => setBackup(e.target.checked)} /> Confirmo que há backup restaurável atualizado antes desta operação.</label>
            {preview.mode === "correction" && <><label>Justificativa da correção <textarea value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={2000} /></label>
              <label><input type="checkbox" checked={eligibility} onChange={e => setEligibility(e.target.checked)} /> Confirmo a elegibilidade de cada participante no corte de 30/09.</label>
              <label><input type="checkbox" checked={noMatch} onChange={e => setNoMatch(e.target.checked)} /> Confirmo que nenhuma primeira partida foi realizada.</label></>}
            <button type="button" className={styles.action} disabled={!backup || busy || (preview.mode === "correction" && (!eligibility || !noMatch || reason.trim().length < 10))} onClick={() => void confirm()}>{preview.mode === "correction" ? "Confirmar correção auditada" : "Confirmar congelamento"}</button>
          </div>}
          {preview.draft && <p>O corte é 30/09/2026 às 23:59:59 em São Paulo. O congelamento só poderá ser confirmado após esse horário, com nova leitura e validação do arquivo.</p>}
        </div>}
        {state?.history.length ? <details className={styles.details}>
          <summary>Histórico de snapshots ({state.history.length})</summary><ol className={styles.historyList}>{state.history.map(item => <li key={item.id}>
            <div><strong>v{item.fileVersion} · {dateTime(item.frozenAt)}</strong><span>{item.fileName}{item.correctionReason ? ` · ${item.correctionReason}` : ""}</span></div>
            {item.changes && <details><summary>Comparação com snapshot anterior</summary><span>Adicionados: {item.changes.added.map(label).join("; ") || "nenhum"}</span><br /><span>Removidos: {item.changes.removed.map(label).join("; ") || "nenhum"}</span><br /><span>Seed, rota ou nota alterados: {item.changes.changed.map(label).join("; ") || "nenhum"}</span></details>}
          </li>)}</ol>
        </details> : null}
      </div>
    </details>
  </section>;
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
