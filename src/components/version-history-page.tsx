"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { Brand } from "./brand";
import { HISTORY_DOMAINS, HISTORY_KINDS, filterHistoryChanges, type HistoryChange, type HistoryChangeKind,
  type HistoryDomain, type HistoryValue, type VersionHistoryData } from "@/lib/catalog/version-history";
import styles from "./version-history-page.module.css";

const href = (version: string, page: number) => `/historico?${new URLSearchParams({ versao: version, pagina: String(page) })}`;
function date(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "não registrado";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}
const displayValue = (v: HistoryValue) => v === null ? "Não informado" : typeof v === "boolean" ? v ? "Sim" : "Não"
  : typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 20 }) : v;
const changeLabel: Record<HistoryChangeKind, string> = { added: "Adicionado", changed: "Alterado", absent: "Deixou de constar", reappeared: "Reapareceu" };

export function VersionHistoryPage({ history, loadFailed = false }: { history: VersionHistoryData | null; loadFailed?: boolean }) {
  const [domain, setDomain] = useState<HistoryDomain | "all">("all");
  const [kind, setKind] = useState<HistoryChangeKind | "all">("all");
  const [query, setQuery] = useState("");
  const [includeDerived, setIncludeDerived] = useState(true);
  const [shown, setShown] = useState(50);
  const filtersId = useId();
  const filtered = history ? filterHistoryChanges(history.comparison, { domain, kind, query, includeDerived }) : [];
  const ready = history && HISTORY_DOMAINS.some(d => history.comparison.blocks[d.id].status === "ready");
  const totalChanges = history ? HISTORY_DOMAINS.reduce((n, d) => n + history.comparison.blocks[d.id].changes.length, 0) : 0;
  const hasWarnings = history && HISTORY_DOMAINS.some(d => history.comparison.blocks[d.id].warnings.length > 0);

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="Oráculo Musical, início" className={styles.brand}><Brand /></Link>
      <Link href="/#acervo" className={styles.back}><ArrowLeft size={16} aria-hidden="true" />Voltar ao acervo</Link></header>
    <div className={styles.title}><span>ACOMPANHE A FONTE</span><h1>Histórico de versões</h1></div>
    <p className={styles.note}>Publicações importadas de álbuns, backlog e resultados dos Playoffs. Horários são de importação ou modificação do arquivo, não de escuta ou realização de partidas.</p>

    {loadFailed ? <section className={styles.panel} role="alert"><h2>Histórico indisponível neste momento</h2><p>Tente recarregar a página. Seus dados permanecem preservados.</p><a href="/historico">Tentar novamente</a></section>
      : !history ? <section className={styles.panel}><History size={28} aria-hidden="true" /><h2>Nenhuma publicação disponível</h2><p>O histórico aparecerá após uma publicação da fonte. Volte ao acervo para conferir a sincronização.</p></section>
      : <>
        {history.notices.map(notice => <p className={styles.notice} role="status" key={notice}>{notice}</p>)}
        <section className={styles.panel} aria-label="Comparação selecionada">
          <h2>{history.previous ? `v${history.previous.version} → v${history.selected.version}` : `Ponto inicial · v${history.selected.version}`}</h2>
          <p>{history.selected.fileName}{history.selected.isCurrent ? " · Publicação atual" : ""}</p>
          <p className={styles.note}>Importada em: {date(history.selected.importedAt)} · Arquivo modificado em: {date(history.selected.modifiedAt)}</p>
          {history.previous ? <p className={styles.note}>Comparada com {history.previous.fileName} · importada em {date(history.previous.importedAt)}. A comparação usa a publicação anterior disponível, mesmo quando há lacunas de numeração.</p>
            : <p className={styles.note}>Não há publicação anterior disponível para comparar. Este é o ponto inicial preservado, sem presumir novas adições ou ausência de mudanças anteriores.</p>}
          <p className={styles.note}>Valores registrados na publicação. O histórico não recalcula rankings antigos pelas regras atuais.</p>
        </section>

        <details className={styles.panel}>
          <summary>Escolher publicação · página {history.page}</summary>
          <nav aria-label="Publicações importadas"><ul className={styles.versions}>{history.versions.map(v => <li key={v.version}>
            <Link href={href(v.version, history.page)} aria-current={v.version === history.selected.version ? "page" : undefined}>
              <strong>v{v.version}{v.isCurrent ? " · Atual" : ""}</strong><span>{v.fileName}</span><small>Importada em {date(v.importedAt)}</small>
            </Link></li>)}</ul></nav>
          <nav className={styles.pagination} aria-label="Paginação das publicações">
            {history.page > 1 && <Link href={href(history.selected.version, history.page - 1)}>Publicações mais recentes</Link>}
            {history.hasMore && <Link href={href(history.selected.version, history.page + 1)}>Carregar publicações anteriores</Link>}
            <Link href="/historico">Ir para a publicação atual</Link>
          </nav>
        </details>

        <section className={styles.blocks} aria-label="Resumo da comparação">{HISTORY_DOMAINS.map(d => {
          const block = history.comparison.blocks[d.id];
          return <div className={styles.panel} key={d.id}><h2>{d.label}</h2>
            {block.status === "unavailable" ? <p className={styles.notice}>Histórico indisponível para este bloco: uma das publicações não possui extração comparável. Isso não significa uma lista vazia.</p>
              : block.status === "baseline" ? <p>Ponto inicial: {block.records} registros preservados, sem comparação anterior.</p>
              : <><p>{block.changes.length} {block.changes.length === 1 ? "mudança" : "mudanças"} no total do bloco</p><ul className={styles.counts}>{HISTORY_KINDS.map(k => <li key={k.id}><strong>{block.changes.filter(c => c.kind === k.id).length}</strong> {k.label}</li>)}</ul>
                {block.changes.length === 0 && block.warnings.length === 0 && <p className={styles.note}>Nenhuma alteração neste bloco.</p>}</>}
            {block.warnings.map((warning, i) => <p className={styles.notice} key={i}>{warning}</p>)}
          </div>;
        })}</section>

        {ready && <section className={styles.panel} aria-label="Mudanças entre versões">
          <h2>Explore as mudanças</h2>
          <div className={styles.filters}>
            <div><label htmlFor={`${filtersId}-domain`}>Bloco</label><select id={`${filtersId}-domain`} value={domain} onChange={e => { setDomain(e.target.value as HistoryDomain | "all"); setShown(50); }}>
              <option value="all">Todos os blocos</option>{HISTORY_DOMAINS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
            <div><label htmlFor={`${filtersId}-kind`}>Tipo de mudança</label><select id={`${filtersId}-kind`} value={kind} onChange={e => { setKind(e.target.value as HistoryChangeKind | "all"); setShown(50); }}>
              <option value="all">Todos os tipos</option>{HISTORY_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
            <div><label htmlFor={`${filtersId}-query`}>Buscar</label><input id={`${filtersId}-query`} type="search" value={query} placeholder="Artista, álbum ou jogo" onChange={e => { setQuery(e.target.value); setShown(50); }} /></div>
          </div>
          <label className={styles.checkbox}><input type="checkbox" checked={includeDerived} onChange={e => { setIncludeDerived(e.target.checked); setShown(50); }} />Incluir posições e índices</label>
          <p className={styles.note}>Esse filtro inclui ranking anual informado e campos derivados do Top 50: fase, bônus, índice e posição. Não altera as contagens totais da comparação.</p>
          <p role="status" className={styles.note}>{filtered.length} mudanças correspondem aos filtros · {totalChanges} no total disponível</p>
          <div className={styles.changes}>{filtered.slice(0, shown).map(change => <ChangeCard key={`${change.domain}:${change.key}`} change={change} previousVersion={history.previous?.version ?? null} />)}</div>
          {filtered.length === 0 && <p className={styles.note}>{totalChanges ? "Nenhuma mudança corresponde aos filtros." : hasWarnings
            ? "Nenhuma mudança inequívoca para listar; confira as pendências acima." : "Nenhuma alteração nos blocos com comparação disponível."}</p>}
          {filtered.length > shown && <button className={styles.more} type="button" onClick={() => setShown(n => n + 50)}>Mostrar mais mudanças</button>}
        </section>}
      </>}
  </main>;
}

function ChangeCard({ change, previousVersion }: { change: HistoryChange; previousVersion: string | null }) {
  return <details className={styles.change}>
    <summary><span>{changeLabel[change.kind]} · {HISTORY_DOMAINS.find(d => d.id === change.domain)!.label}</span><strong>{change.label}</strong></summary>
    {change.kind === "absent" && <p className={styles.note}>Deixou de constar nesta versão. Isso não confirma exclusão definitiva ou cancelamento; os dados anteriores continuam preservados.</p>}
    {change.kind === "reappeared" && <p className={styles.note}>Ausente em v{previousVersion}; último registro disponível em v{change.before!.version}.</p>}
    <p className={styles.note}>Antes: {change.before ? `v${change.before.version} · ${change.before.locator ?? "localização não registrada"}` : "não constava na publicação anterior"}
      <br />Depois: {change.after ? `v${change.after.version} · ${change.after.locator ?? "localização não registrada"}` : "não consta na publicação selecionada"}</p>
    {change.fields.length > 0 ? <table className={styles.table}><caption>Valores registrados — {change.label}</caption><thead><tr><th>Campo</th>
      <th>Antes{change.before ? ` · v${change.before.version}` : ""}</th><th>Depois{change.after ? ` · v${change.after.version}` : ""}</th></tr></thead>
      <tbody>{change.fields.map(f => <tr key={f.field}><th scope="row">{f.label}{f.derived ? " · derivado" : ""}</th>
        <td>{change.before ? displayValue(f.before) : "Não constava"}</td><td>{change.after ? displayValue(f.after) : "Não consta nesta versão"}</td></tr>)}</tbody></table>
      : <p className={styles.note}>O registro reapareceu com os mesmos valores conhecidos, ou os campos alterados estão ocultos pelo filtro.</p>}
  </details>;
}
