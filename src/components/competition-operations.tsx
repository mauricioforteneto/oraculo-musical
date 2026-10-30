"use client";
import { useSeasonFetch } from "./season-context";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import type { getCompetitionState, previewFreeze, FreezeMode } from "@/lib/competition/service";
import type { Participant } from "@/lib/competition/rules";
import { visibleIssue } from "@/lib/catalog/visible-issues";
import { dateTime } from "@/lib/catalog/presentation";
import styles from "./competition-panel.module.css";
type State = Awaited<ReturnType<typeof getCompetitionState>>;
type Preview = Awaited<ReturnType<typeof previewFreeze>>;
function label(p: Participant) { return `#${p.seed} ${p.artist} — ${p.title}`; }
function routeLabel(route: Participant["route"]) { return route === "elite" ? "Elite" : route === "direct" ? "Entrada direta" : "Pré-playoff"; }
export function CompetitionOperations({ state, ready }: { state: State | null; ready: boolean }) {
  const router = useRouter();
  const request = useSeasonFetch();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [backup, setBackup] = useState(false);
  const [eligibility, setEligibility] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [reason, setReason] = useState("");
  const mode: FreezeMode = state?.active ? "correction" : "initial";

  async function loadPreview(selectedMode: FreezeMode) {
    setBusy(true); setFeedback(""); setPreview(null); setBackup(false); setEligibility(false); setNoMatch(false); setReason("");
    try {
      const response = await request("/api/competition/preview", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selectedMode }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "PREVIEW_FAILED");
      setPreview(result as Preview);
    } catch (error) { setFeedback(`Prévia indisponível: ${error instanceof Error ? error.message : "PREVIEW_FAILED"}.`); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!preview || !preview.canConfirm || !backup || busy) return;
    setBusy(true); setFeedback("");
    try {
      const response = await request("/api/competition/freeze", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        mode: preview.mode, token: preview.token, backupAttested: backup, eligibilityAttested: eligibility, noMatchAttested: noMatch, reason,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "FREEZE_FAILED");
      setFeedback(`Snapshot confirmado: ${result.participants} participantes da versão ${result.fileVersion}.`);
      setPreview(null); setBackup(false); setEligibility(false); setNoMatch(false); setReason(""); router.refresh();
    } catch (error) { setFeedback(`Confirmação recusada: ${error instanceof Error ? error.message : "FREEZE_FAILED"}. Refaça a prévia se o arquivo mudou.`); }
    finally { setBusy(false); }
  }

  const previewIssues = preview?.issues.filter(i => visibleIssue({ ...i, message: i.message })) ?? [];
  const participants = preview?.participants ?? state?.active?.participants ?? [];
  const active = Boolean(state?.active);
  return <section className={styles.panel} aria-label="Operação do corte">
    {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
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
          <div className={styles.meta}><strong>{preview.draft ? "Rascunho mutável" : "Arquivo candidato"} · v{preview.file.version}</strong><span>{preview.file.name} · modificado {dateTime(preview.file.modifiedAt)}</span><span>SHA-256 {preview.file.sha256}</span><span>{preview.participants.length} participantes · {previewIssues.filter(i => i.severity === "error").length} erros · {previewIssues.filter(i => i.severity === "warning").length} avisos</span></div>
          {previewIssues.length > 0 && <details><summary>Divergências da fonte ({previewIssues.length})</summary><ul>{previewIssues.map((issue, i) => <li key={i}>{issue.severity === "error" ? "Bloqueio" : "Aviso"}: {issue.message}{"sourceRow" in issue && issue.sourceRow ? ` · linha ${issue.sourceRow}` : ""}</li>)}</ul></details>}
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
