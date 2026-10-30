"use client";
import { useState } from "react";
import { SeasonLink as Link } from "./season-context";
import type { MonthlyState, MonthlyMonth } from "@/lib/competition/monthly";
import { MONTHLY_RULES } from "@/lib/seasons/definitions";
import { scoreLabel } from "@/lib/catalog/presentation";
import styles from "./season-pages.module.css";

function closureText(state: MonthlyState, month: MonthlyMonth) {
  return `Na aba Fechamentos mensais, registre uma linha com:\nFechamento: NOVO_IDENTIFICADOR\nTemporada: ${state.season}\nMês: ${month.month}\nRegra: ${state.rulesVersion}\nVersão base: ${state.sourceVersion}\nHash do contexto: ${month.contextHash}\nStatus: Pendente\nConfirmado por: \nConfirmado em: \nReferência da confirmação: \nCorrige fechamento: ${month.confirmed?.closureId ?? ""}\nJustificativa: \n\nRevise os ${month.candidates.length} candidatos e os ${month.provisional.length} classificados propostos. Só use Confirmada após sua decisão explícita, preenchendo autor, data real e referência. Correção exige identificação nova e justificativa. Não altere as notas originais. Publique uma versão nova da planilha e sincronize.`;
}
export function MonthlyCompetition({ state }: { state: MonthlyState }) {
  const [selected, setSelected] = useState(1);
  const [feedback, setFeedback] = useState("");
  const month = state.months[selected - 1];
  const total = state.months.reduce((sum, item) => sum + (item.confirmed?.qualified.length ?? 0), 0);
  const instruction = closureText(state, month);
  const canPrepare = state.storageReady && state.sourceVersion && month.contextHash && month.periodEnded && month.closesOn && !month.pending.length;
  return <section className={styles.stack} aria-label="Classificação mensal">
    <div className={styles.intro}><p><strong>{total}</strong> classificados confirmados para até {state.slots} vagas. Cada mês oferece {MONTHLY_RULES.slotsPerMonth} vagas pelas notas originais.</p><Link href="/regras">Consultar regras de {state.season}</Link></div>
    {!state.storageReady && <p role="status">A classificação é provisória. Configure a fonte e a estrutura mensal e sincronize a planilha para habilitar fechamentos.</p>}
    <div className={styles.months} role="group" aria-label="Escolher mês">{state.months.map(item => <button key={item.month} type="button" aria-pressed={item.month === selected} onClick={() => { setSelected(item.month); setFeedback(""); }}>
      <strong>{item.label}</strong><span>{item.confirmed ? "Fechado" : !item.closesOn ? "Calendário em definição" : item.pending.length ? "Com pendências" : "Provisório"}</span>
    </button>)}</div>
    <div className={styles.heading}><h2>{month.label}</h2><span>{month.confirmed ? `Fechamento ${month.confirmed.closureId}` : "Classificação provisória"}</span></div>
    <p>{month.closesOn ? `Período de avaliação até ${month.closesOn.split("-").reverse().join("/")}. Fechamento após encerrar o período, no fuso de São Paulo.` : "O corte de dezembro e o prazo do AOTY continuam indefinidos. O fechamento deste mês está desabilitado."}</p>
    {month.confirmed && <div className={styles.confirmed}><h3>Classificados confirmados</h3><ol>{month.confirmed.qualified.map(album => <li key={album.key}>{album.artist} — {album.title} <strong>{scoreLabel(album.originalScore)}</strong></li>)}</ol>
      <p>{month.confirmed.vacancies} vagas sem preenchimento. Fonte v{month.confirmed.sourceVersion}, regra {month.confirmed.rulesVersion}. Confirmação de {month.confirmed.confirmedBy}, em {month.confirmed.confirmedOn}: {month.confirmed.reference}.</p>
      {month.confirmed.reason && <p>Justificativa da correção: {month.confirmed.reason}</p>}
    </div>}
    {month.changedSinceClosure && <p className={styles.notice} role="status">Os fatos mudaram após o fechamento. Os classificados confirmados foram preservados; uma correção exige nova confirmação.</p>}
    {month.pending.length > 0 && <details className={styles.disclosure} open><summary>Pendências deste mês ({month.pending.length})</summary><ul>{month.pending.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
      <p>Para desempatar a segunda vaga, registre o grupo completo na aba Desempates mensais: Decisão, Temporada, Mês, Regra, Artista, Álbum, Nota original, Ordem no grupo, Status, Confirmado por, Confirmado em e Referência da confirmação. Preserve as notas originais.</p>
    </details>}
    <ol className={styles.candidates}>{month.candidates.map(album => <li key={album.key}><div>{album.albumId ? <Link href={`/albuns/${album.albumId}`}>{album.title}</Link> : <strong>{album.title}</strong>}<span>{album.artist}</span><small>Avaliação: {album.evaluatedOn.split("-").reverse().join("/")}</small></div>
      <div><strong>{scoreLabel(album.originalScore)}</strong>{month.provisional.some(item => item.key === album.key) && <small>Em posição de classificação</small>}</div></li>)}</ol>
    {!month.candidates.length && <p>Nenhum lançamento elegível registrado para este mês.</p>}
    <details className={styles.disclosure}><summary>{month.confirmed ? "Preparar correção do fechamento" : "Preparar fechamento na planilha"}</summary>
      <p>Copie a orientação, preencha a confirmação na planilha e sincronize uma versão nova. O aplicativo valida a versão-base e o contexto antes de fixar as vagas.</p>
      <button className={styles.action} type="button" disabled={!canPrepare} onClick={async () => {
        try { await navigator.clipboard.writeText(instruction); setFeedback("Orientação copiada. Revise e preencha a confirmação na planilha."); }
        catch { setFeedback("Não foi possível copiar automaticamente. Selecione o texto abaixo para copiar manualmente."); }
      }}>Copiar orientação de fechamento</button>
      {!canPrepare && <p>Orientação indisponível até encerrar o período, resolver as pendências e publicar o contexto na fonte.</p>}
      {canPrepare && <textarea readOnly aria-label="Texto de fechamento para a planilha" value={instruction} rows={12} />}
      {feedback && <p role="status">{feedback}</p>}
    </details>
    <p>As vagas não preenchidas permanecem vazias. O mata-mata e o Top 50 competitivo de 2027 serão definidos em uma próxima entrega.</p>
  </section>;
}
