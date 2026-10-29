'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from './app-shell';
import { ISSUE_CATEGORIES, evidenceText, issuePrompt, type IssueReport, type PendingIssue } from '@/lib/issues/report';
import { filterIssues, issueFilters, issueQuery, type IssueFilters } from '@/lib/issues/filters';
import { dateTime } from '@/lib/catalog/presentation';
import { isUuid } from '@/lib/artwork/types';
import common from './workspace.module.css';
import styles from './pending-issues-page.module.css';
export function PendingIssuesPage({report,loadFailed=false}:{report:IssueReport|null;loadFailed?:boolean}) {
  const params=useSearchParams();
  const filters=issueFilters(params);
  const [feedback,setFeedback]=useState('');
  const items=report?.items ?? [],filtered=filterIssues(items,filters);
  function update(next:Partial<IssueFilters>) {window.history.replaceState(null,'',`/pendencias${issueQuery({...filters,...next})}`);setFeedback('');}
  async function copy(items:PendingIssue[]) {
    try {await navigator.clipboard.writeText(issuePrompt(items,report?.version ?? null));setFeedback('Orientação copiada. Cole no chat que gera a planilha.');}
    catch {setFeedback('Não foi possível copiar automaticamente. Abra “Texto para o chat da planilha”, selecione o texto e copie manualmente.');}
  }
  return <AppShell title="Central de pendências" description="Confira o que precisa de correção ou decisão na planilha antes de avançar a temporada." version={report?.version}>
    <div className={common.stack}>
      {loadFailed ? <section className={common.card} role="alert"><h2>Não foi possível carregar as pendências</h2><p>Não foi possível conferir a fonte e a competição. Recarregue a página para tentar novamente.</p><a className={common.action} href="/pendencias">Tentar novamente</a></section> : report && <>
        <section className={common.card} aria-label="Como resolver pendências"><h2>Confira o que pode ser corrigido na planilha</h2>
          <p>{report.version!==null ? `Publicação em análise: v${report.version}${report.publishedAt ? ` · ${dateTime(report.publishedAt)}`:''}.`:'Ainda não há uma publicação válida.'} A lista é recalculada a cada consulta; após sincronizar a correção, os itens que deixarem de ocorrer desaparecem.</p>
          <p>Copie a orientação para o chat que gera o XLSX. Corrija os dados comprovados; decisões de participação e desempate precisam de confirmação do proprietário. Desempates manuais devem estar na aba Desempates Top 50, com o grupo completo e a confirmação. Até uma decisão válida ser importada, o grupo empatado no corte permanece sem posição. Resultados ainda não publicados são aguardados normalmente.</p>
          <div className={common.actions}><Link className={common.action} href="/sincronizacao">Abrir sincronização</Link><Link className={common.action} href="/top-50">Ver Top 50</Link><Link className={common.action} href="/playoffs">Ver Playoffs</Link></div>
          {report.notices.map(notice=><p key={notice}>{notice}</p>)}
        </section>
        <section className={styles.metrics} aria-label="Resumo das pendências">
          <div className={common.metric}><span>Pendências reunidas</span><strong>{items.length}</strong></div>
          <div className={common.metric}><span>Impedem posição, avanço ou importação</span><strong>{items.filter(i=>i.blocking).length}</strong></div>
          <div className={common.metric}><span>Para conferir</span><strong>{items.filter(i=>!i.blocking).length}</strong></div>
        </section>
        <section className={common.card} aria-label="Buscar e filtrar pendências">
          <label className={common.search}>Buscar álbum, artista, motivo ou linha<input type="search" value={filters.q} maxLength={200} onChange={e=>update({q:e.target.value,limit:20})} placeholder="Encontre uma pendência"/></label>
          <div className={styles.filters}>
            <label>Tipo de pendência<select aria-label="Tipo de pendência" value={filters.category} onChange={e=>update({category:e.target.value as IssueFilters['category'],limit:20})}><option value="all">Todos os tipos</option>{ISSUE_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label} ({items.filter(i=>i.category===c.id).length})</option>)}</select></label>
            <label>Origem da pendência<select aria-label="Origem da pendência" value={filters.scope} onChange={e=>update({scope:e.target.value as IssueFilters['scope'],limit:20})}><option value="all">Todas as origens</option><option value="publication">Publicação atual</option><option value="attempt">Última tentativa recusada</option></select></label>
            <label>Impacto<select aria-label="Impacto da pendência" value={filters.impact} onChange={e=>update({impact:e.target.value as IssueFilters['impact'],limit:20})}><option value="all">Todos os impactos</option><option value="blocking">Impede posição, avanço ou importação</option><option value="review">Para conferir</option></select></label>
          </div>
          <p role="status">{filtered.length} de {items.length} pendências nos filtros atuais.</p>
          <div className={common.actions}><button className={common.action} disabled={!filtered.length} type="button" onClick={()=>void copy(filtered)}>Copiar pendências filtradas</button>
            <button className={common.action} type="button" onClick={()=>update({q:'',category:'all',scope:'all',impact:'all',limit:20})}>Limpar filtros</button></div>
          {feedback && <p role="status">{feedback}</p>}
          {filtered.length>0 && <details className={styles.prompt}><summary>Texto para o chat da planilha</summary><textarea aria-label="Texto das pendências filtradas" readOnly value={issuePrompt(filtered,report.version)} onFocus={e=>e.currentTarget.select()}/></details>}
        </section>
        <section className={common.stack} aria-label="Lista de pendências">
          {filtered.slice(0,filters.limit).map(item=><article className={common.card} key={item.id} aria-labelledby={`${item.id}-title`}>
            <div className={styles.tags}><span className={item.blocking ? styles.blocking:styles.review}>{item.blocking ? 'Requer correção ou decisão':'Conferir'}</span><span>{item.scope==='publication' ? 'Publicação atual':'Tentativa recusada'}</span></div>
            <h2 id={`${item.id}-title`}>{item.title}</h2>
            {item.subjects.length>0 && <ul className={styles.subjects}>{item.subjects.map((s,i)=><li key={`${s.albumId ?? s.artist}-${i}`}>
              {s.albumId && isUuid(s.albumId) ? <Link href={`/albuns/${s.albumId}`}><strong>{s.artist}</strong> — {s.title}</Link>:<><strong>{s.artist}</strong> — {s.title}</>}
            </li>)}</ul>}
            <ul className={styles.messages}>{item.messages.map((message,i)=><li key={i}>{message}</li>)}</ul>
            <dl className={styles.explanation}><dt>Efeito</dt><dd>{item.impact}</dd><dt>Como resolver</dt><dd>{item.action}</dd><dt>Origem disponível</dt><dd><ul>{item.evidence.length ? item.evidence.map((e,i)=><li key={i}>{evidenceText(e)}</li>):<li>Versão e linha não registradas para este item.</li>}</ul></dd></dl>
            <p className={styles.code}>Referência: {item.code}</p>
            <button className={common.action} type="button" onClick={()=>void copy([item])}>Copiar orientação desta pendência</button>
            <details className={styles.prompt}><summary>Texto para o chat da planilha</summary><textarea aria-label={`Orientação: ${item.title}`} readOnly value={issuePrompt([item],report.version)} onFocus={e=>e.currentTarget.select()}/></details>
          </article>)}
          {!items.length ? <section className={common.card}><h2>{report.version===null ? 'Aguardando uma publicação válida':'Nenhuma pendência identificada'}</h2><p>As verificações disponíveis não encontraram apontamentos. Confira também os avisos de disponibilidade acima; novas versões e resultados podem gerar novos itens.</p></section>
            : !filtered.length && <section className={common.card}><h2>Nenhuma pendência corresponde aos filtros</h2><p>Limpe os filtros para consultar os outros apontamentos.</p></section>}
          {filtered.length>filters.limit && <button className={common.action} type="button" onClick={()=>update({limit:filters.limit+20})}>Mostrar mais pendências ({filtered.length-filters.limit} restantes)</button>}
        </section>
      </>}
    </div>
  </AppShell>;
}
