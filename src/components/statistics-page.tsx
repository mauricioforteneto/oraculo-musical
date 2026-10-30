"use client";

import { useId, useState } from "react";
import { SeasonLink as Link } from "./season-context";
import { BarChart3, Disc3, Globe2, Headphones, Music2 } from "lucide-react";
import { seasonHref } from "@/lib/seasons/definitions";
import { AppShell } from "./app-shell";
import { albumsForStatisticsGroup, type CatalogStatistics, type StatisticsDimension } from "@/lib/catalog/statistics";
import styles from "./statistics-page.module.css";

const dimensions: { id: StatisticsDimension; label: string }[] = [{ id: "genres", label: "Gêneros" }, { id: "countries", label: "Países" }, { id: "artists", label: "Artistas" }];
const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function StatisticsPage({ statistics, version, loadFailed = false, season }: { statistics: CatalogStatistics | null; version: string | null; loadFailed?: boolean; season?: number }) {
  const [dimension, setDimension] = useState<StatisticsDimension>("genres");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const groups = statistics?.groups[dimension] ?? [];
  const selected = groups.find(g => g.key === selectedKey) ?? null;
  const selectedAlbums = statistics && selected ? albumsForStatisticsGroup(statistics, dimension, selected.key) : [];
  const visibleGroups = showAll ? groups : groups.slice(0, 10);
  const maxCount = Math.max(1, ...groups.map(g => g.count));

  return <AppShell season={season} title="Estatísticas" description="Seu acervo em perspectiva: gêneros, países e artistas da publicação atual." version={version}><div className={styles.page}>
    {loadFailed ? <section className={styles.empty} role="alert"><h2>Não foi possível carregar as estatísticas</h2>
      <p>O catálogo está indisponível neste momento. Tente recarregar a página ou volte ao acervo.</p><a href={seasonHref("/estatisticas",season ?? 2026,season!=null)}>Tentar novamente</a></section>
      : !statistics || statistics.total === 0 ? <section className={styles.empty}><Disc3 size={32} aria-hidden="true" />
        <h2>Nenhum álbum presente para analisar</h2><p>As estatísticas aparecem quando houver álbuns na versão publicada. Confira a página de Sincronização para publicar a fonte.</p></section>
      : <>
        <p className={styles.scope}>Somente álbuns presentes na versão publicada atual. Registros ausentes continuam preservados no histórico e ficam fora destas estatísticas.</p>
        <section className={styles.metrics} aria-label="Resumo estatístico">
          <Metric icon={<Headphones size={18} aria-hidden="true" />} label="Álbuns" value={number(statistics.total)} note="presentes na fonte" />
          <Metric icon={<BarChart3 size={18} aria-hidden="true" />} label="Média original" value={statistics.average === null ? "—" : number(statistics.average)} note={`${statistics.scoredCount} álbuns com nota original`} />
          <Metric icon={<Music2 size={18} aria-hidden="true" />} label="Gêneros" value={number(statistics.genreCount)} note="categorias informadas" />
          <Metric icon={<Globe2 size={18} aria-hidden="true" />} label="Países" value={number(statistics.countryCount)} note="como informados na fonte" />
          <Metric icon={<Disc3 size={18} aria-hidden="true" />} label="Artistas" value={number(statistics.artistCount)} note="créditos preservados" />
        </section>
        <section className={styles.explorer} aria-label="Explorar estatísticas">
          <div className={styles.selector} role="group" aria-label="Dimensão das estatísticas">{dimensions.map(d => <button type="button" key={d.id}
            aria-pressed={dimension === d.id} onClick={() => { setDimension(d.id); setSelectedKey(null); setShowAll(false); }}>{d.label}</button>)}</div>
          <h2>{dimensions.find(d => d.id === dimension)!.label} no acervo</h2>
          <p className={styles.explanation}>Ordenados por quantidade de álbuns. Selecione um grupo para consultar seus discos; o resumo geral permanece igual.</p>
          {dimension === "genres" && <p className={styles.explanation}>Cada álbum conta uma vez em cada gênero informado, separado por “/”. Os percentuais usam o total de álbuns e podem somar mais de 100%.</p>}
          {dimension === "countries" && <p className={styles.explanation}>As categorias de país são preservadas, sem unir Inglaterra, Escócia ou Irlanda do Norte.</p>}
          {dimension === "artists" && <p className={styles.explanation}>{statistics.allArtistsSingleAlbum
            ? "Todos os artistas têm apenas um álbum nesta publicação. A média descreve esse disco e não indica preferência recorrente."
            : "Créditos e colaborações são preservados. A média considera somente os álbuns com nota original disponível."}</p>}
          <ul className={styles.groups} aria-label="Grupos por quantidade de álbuns">{visibleGroups.map(g => <li key={g.key}>
            <button type="button" className={styles.group} aria-pressed={selected?.key === g.key} aria-controls={listId}
              onClick={() => setSelectedKey(current => current === g.key ? null : g.key)}>
              <span className={styles.groupHeading}><strong>{g.label}</strong><span>{g.count} {g.count === 1 ? "álbum" : "álbuns"} · {number(g.percentage)}%</span></span>
              {dimension !== "artists" && <span className={styles.track} aria-hidden="true"><span style={{ width: `${g.count / maxCount * 100}%` }} /></span>}
              <span className={styles.groupNote}>{g.average === null ? "Sem notas originais disponíveis" : `Média original ${number(g.average)} · ${g.scoredCount} com nota`}</span>
            </button>
          </li>)}</ul>
          {groups.length > 10 && <button className={styles.action} type="button" onClick={() => setShowAll(current => !current)}>
            {showAll ? "Mostrar os primeiros 10" : `Ver todos os ${groups.length} grupos`}</button>}
        </section>
        <section className={styles.albums} id={listId} aria-label="Álbuns do grupo selecionado">
          <div className={styles.albumHeading}><h2>{selected ? selected.label : "Explore um grupo"}</h2>
            {selected && <button className={styles.action} type="button" onClick={() => setSelectedKey(null)}>Limpar seleção</button>}</div>
          <p className={styles.explanation} role="status">{selected ? `${selectedAlbums.length} álbuns neste grupo, ordenados pela nota original.` : "Selecione um gênero, país ou artista para ver os álbuns correspondentes."}</p>
          {selected && <ol className={styles.albumList}>{selectedAlbums.map(a => <li key={a.key}>
            <div><strong>{a.albumId ? <Link href={`/albuns/${a.albumId}`}>{a.artist}</Link> : a.artist}</strong><span>{a.title}</span><small>{a.country || "País não informado"} · {a.genre || "Gênero não informado"}</small></div>
            <span className={styles.score}>{a.originalScore === null ? "—" : number(a.originalScore)}<small>NOTA ORIGINAL</small></span>
          </li>)}</ol>}
        </section>
      </>}
  </div></AppShell>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className={styles.metric}><span>{icon}{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
