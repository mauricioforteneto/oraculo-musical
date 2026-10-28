"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocalSourcePreview } from "@/lib/catalog/types";
import type { getCompetitionState } from "@/lib/competition/service";
import { dateTime, scoreLabel } from "@/lib/catalog/presentation";
import { parseSummaryNumber } from "@/lib/catalog/summary";
import { visibleIssue } from "@/lib/catalog/visible-issues";
import { ArtworkSync, type ArtworkSyncHandle } from "./artwork-sync";
import { CompetitionOperations } from "./competition-operations";
import styles from "./workspace.module.css";
const statusLabel = (s: string) => s === "running" ? "Em andamento" : s === "succeeded" ? "Publicada" : s === "unchanged" ? "Sem alterações" : "Falhou";
export function SynchronizationPage({ source, ready, competition }: { source: LocalSourcePreview | null; ready: boolean; competition: Awaited<ReturnType<typeof getCompetitionState>> | null }) {
  const router = useRouter();
  const artwork = useRef<ArtworkSyncHandle>(null);
  const [syncing,setSyncing] = useState(false);
  const [feedback,setFeedback] = useState("");
  async function synchronize() {
    if (!ready || syncing) return;
    setSyncing(true); setFeedback("");
    try {
      const response = await fetch("/api/sync", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json() as { status?: string; version?: string; error?: string };
      setFeedback(!response.ok ? `Falha na sincronização (${result.error ?? "SYNC_FAILED"}).` : result.status === "unchanged" ? `A versão ${result.version} já está publicada.` : `Versão ${result.version} publicada.`);
      router.refresh();
      if (response.ok) artwork.current?.start();
    } catch { setFeedback("Não foi possível concluir a sincronização."); }
    finally { setSyncing(false); }
  }
  const attempt = source?.lastAttempt;
  const issues = attempt?.issues.filter(visibleIssue) ?? [];
  const albums = source?.albums ?? [];
  const scores = albums.flatMap(a => a.originalScore === null ? [] : [a.originalScore]);
  const average = scores.length ? scores.reduce((a,b) => a+b,0)/scores.length : null;
  const reportedAverage = parseSummaryNumber(source?.summary["Nota média"]);
  const differences = albums.filter(a => a.originalScore !== null && a.reportedScore !== null && a.originalScore !== a.reportedScore).length;
  return <div className={styles.stack}>
    <section className={styles.card} aria-labelledby="sync-title"><span className={styles.eyebrow}>FONTE PRIVADA</span><h2 id="sync-title">Atualizar a publicação</h2>
      <p>{source?.version != null ? `Última publicação válida: v${source.version}${source.publishedAt ? ` · ${dateTime(source.publishedAt)}` : ""}.` : "Ainda não há publicação válida."} A leitura da planilha preserva a última publicação válida se houver falha.</p>
      {!ready && <p>A configuração privada de sincronização está pendente.</p>}
      <button className={styles.action} disabled={!ready || syncing} type="button" onClick={synchronize}>{syncing ? "Lendo…" : "Sincronizar"}</button>
      {feedback && <p role="status">{feedback}</p>}
    </section>
    {attempt && <section className={styles.card} aria-label="Relatório da última tentativa"><h2>Última tentativa: {statusLabel(attempt.status)}</h2>
      <p>{dateTime(attempt.startedAt)}{attempt.finishedAt ? ` · finalizada em ${dateTime(attempt.finishedAt)}` : ""}{attempt.errorCode ? ` · código ${attempt.errorCode}` : ""}</p>
      <p>{[["Novos",attempt.counts.new],["Alterados",attempt.counts.changed],["Sem mudança",attempt.counts.unchanged],["Ausentes",attempt.counts.absent]].filter(([,n]) => typeof n === "number").map(([label,n]) => `${label}: ${n}`).join(" · ")}</p>
      {issues.length > 0 && <details><summary>Ver {issues.length} apontamentos</summary><ul className={styles.issueList}>{issues.map((issue,i) => <li key={i}><strong>{issue.severity === "error" ? "Erro" : "Aviso"} · {issue.code}</strong><span>{issue.sourceLocator}</span>{issue.message}</li>)}</ul></details>}
    </section>}
    {source?.attemptHistory && source.attemptHistory.length > 0 && <section className={styles.card}><h2>Tentativas recentes</h2><ol className={styles.issueList}>{source.attemptHistory.map((a,i) => <li key={i}><strong>{statusLabel(a.status)}{a.version ? ` · v${a.version}` : ""}{a.isCurrentPublication ? " · publicação ativa" : ""}</strong><span>{dateTime(a.startedAt)}{a.finishedAt ? ` · ${dateTime(a.finishedAt)}` : ""}</span>{a.errorCode && <span>Código {a.errorCode}</span>}</li>)}</ol></section>}
    {(differences > 0 || (average !== null && reportedAverage !== null && Math.abs(average-reportedAverage) > .005)) && <section className={styles.card} aria-label="Conferência da fonte"><h2>Conferência das notas</h2>{differences > 0 && <p>{differences} notas informadas diferem da avaliação original.</p>}{average !== null && reportedAverage !== null && Math.abs(average-reportedAverage) > .005 && <p>O resumo informa média {scoreLabel(reportedAverage)}; a média original calculada é {scoreLabel(average)}.</p>}</section>}
    <ArtworkSync ref={artwork} initial={source?.artworkSummary} />
    <CompetitionOperations key={competition?.active?.id ?? "initial"} state={competition} ready={ready} />
  </div>;
}
