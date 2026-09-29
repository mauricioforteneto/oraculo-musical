"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { getCompetitionState, previewFreeze, FreezeMode } from "@/lib/competition/service";
import type { Bracket, Participant } from "@/lib/competition/rules";
import styles from "./competition-panel.module.css";

type State = Awaited<ReturnType<typeof getCompetitionState>>;
type Preview = Awaited<ReturnType<typeof previewFreeze>>;
function dateTime(value: string) { return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }); }
function label(p: Participant) { return `#${p.seed} ${p.artist} — ${p.title}`; }

export function CompetitionPanel({ state, ready, sourceTop50Positions }: { state: State | null; ready: boolean; sourceTop50Positions: number }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [backup, setBackup] = useState(false);
  const [eligibility, setEligibility] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [reason, setReason] = useState("");
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
  return <div className={styles.panel} id="top-50">
    <div className={styles.heading}><div><span className={styles.eyebrow}>TEMPORADA 2026</span><h2>Playoffs e Top 50 provisório</h2></div><span className={styles.badge}>{state?.active ? "CONGELADO" : preview?.draft ? "RASCUNHO" : "AGUARDA CORTE"}</span></div>
    <p>Participantes ocupam as vagas 1–N sem ordem final. A primeira rodada usa os seeds da planilha. Resultados e adversários das oitavas dependem das partidas reais.</p>
    {state?.active && <div className={styles.meta}><strong>Snapshot ativo · v{state.active.fileVersion}</strong><span>{state.active.fileName} · {dateTime(state.active.frozenAt)} · SHA-256 {state.active.sha256}</span>{state.active.correctionReason && <span>Correção: {state.active.correctionReason}</span>}</div>}
    {ready && <button className={styles.action} type="button" disabled={busy} onClick={() => void loadPreview(mode)}>{busy ? "Lendo…" : state?.active ? "Prévia de correção" : "Atualizar prévia do corte"}</button>}
    {!ready && <p>A prévia do Drive ficará disponível após configurar a sincronização privada.</p>}
    {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
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
    {participants.length > 0 && <details className={styles.section}><summary>Participantes e seeds ({participants.length})</summary><ol>{participants.map(p => <li key={p.identityKey}>{label(p)} · {p.route === "elite" ? "Elite" : p.route === "direct" ? "Entrada direta" : "Pré-playoff"} · original {p.originalScore}</li>)}</ol></details>}
    {bracket && <section id="chaveamento" className={styles.section}><h3>Primeira rodada</h3><p>{bracket.byes.length} byes · {bracket.matches.length} jogos</p><div className={styles.bracket}><div><strong>Avançam sem jogar</strong><ol>{bracket.byes.map(p => <li key={p.identityKey}>{label(p)}</li>)}</ol></div><div><strong>Jogos</strong><ol>{bracket.matches.map(m => <li key={m.high.seed}>{label(m.high)} × {label(m.low)}</li>)}</ol></div></div><details><summary>Oitavas condicionais · reseeding único</summary><p>Após conhecer os 16 sobreviventes, ordenar pelos seeds congelados e preencher:</p><ol>{bracket.roundOf16.map(slot => <li key={slot.slot}>{slot.slot}: {slot.high} × {slot.low}</li>)}</ol></details></section>}
    {projection && <section className={styles.section}><h3>Vagas restantes do Top 50</h3><p>1–{projection.reserved}: reservadas aos Playoffs. {projection.slots} vagas residuais calculadas pela versão publicada mais recente; índice = original + maior bônus comprovado.</p>
      {projection.tieAtCut && <p className={styles.warning}>Empate na última vaga: posição depende de decisão manual.</p>}
      {projection.unresolved > 0 && <p className={styles.warning}>{projection.unresolved} divergência(s) de fase ou fonte sem posição definitiva.</p>}
      <ol className={styles.residual}>{projection.entries.filter(e => e.position !== null).map(e => <li key={e.identityKey}><strong>#{e.position}</strong> {e.artist} — {e.title} · {e.originalScore} + {e.bonus} = {e.index} · {e.phase}{e.late ? " · entrada após corte" : ""}</li>)}</ol>
      {projection.entries.some(e => e.conflicts.length > 0 || e.position === null) && <details><summary>Sem posição provisória</summary><ul>{projection.entries.filter(e => e.conflicts.length > 0 || e.position === null).map(e => <li key={e.identityKey}>{e.artist} — {e.title}: {e.conflicts.join("; ") || "fora das vagas / empate na última vaga"}</li>)}</ul></details>}
    </section>}
    {state?.history.length ? <details className={styles.section}><summary>Histórico de snapshots ({state.history.length})</summary><ol>{state.history.map(item => <li key={item.id}>v{item.fileVersion} · {dateTime(item.frozenAt)} · {item.fileName}{item.correctionReason ? ` · ${item.correctionReason}` : ""}{item.changes && <details><summary>Comparação com snapshot anterior</summary><span>Adicionados: {item.changes.added.map(label).join("; ") || "nenhum"}</span><br /><span>Removidos: {item.changes.removed.map(label).join("; ") || "nenhum"}</span><br /><span>Seed, rota ou nota alterados: {item.changes.changed.map(label).join("; ") || "nenhum"}</span></details>}</li>)}</ol></details> : null}
    {!projection && sourceTop50Positions > 0 && <p>{sourceTop50Positions} posições informadas pela fonte aguardam projeção calculada.</p>}
  </div>;
}
