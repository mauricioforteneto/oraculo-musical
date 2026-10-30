"use client";
import Link from "next/link";
import { Search } from "lucide-react";
import { ARTWORK_FILTERS, matchesArtworkFilter } from "@/lib/artwork/review";
import { ArtworkAttribution } from "./artwork-attribution";
import { AlbumCover } from "./album-cover";
import { useSearchParams } from "next/navigation";
import type { AlbumRecord } from "@/lib/catalog/types";
import { rankAnnualAlbums } from "@/lib/catalog/ranking";
import { catalogFilters, catalogQuery, type CatalogFilters } from "@/lib/catalog/catalog-navigation";
import { scoreLabel } from "@/lib/catalog/presentation";
import "./catalog.tokens.css";
import styles from "./catalog-page.module.css";
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function CatalogPage({ albums }: { albums: AlbumRecord[] }) {
  const params = useSearchParams();
  const filters = catalogFilters(params);
  const ranked = rankAnnualAlbums(albums);
  const artworkView = ARTWORK_FILTERS.find(item => item.id === filters.capas);
  const filtered = ranked.filter(a => normalize([a.artist,a.title,a.genre,a.country].join(" ")).includes(normalize(filters.q.trim()))
    && (filters.nota === "all" || (a.originalScore ?? -1) >= Number(filters.nota)) && matchesArtworkFilter(a,filters.capas));
  function update(next: Partial<CatalogFilters>) {
    window.history.replaceState(null,"",`/albuns${catalogQuery({ ...filters,...next })}`);
  }
  return <div className={styles.catalog}>
    <section className={styles.toolbar} aria-label="Buscar e filtrar álbuns">
      <label className={styles.search}>
        <span>Buscar por álbum, artista, gênero ou país</span>
        <span className={styles.searchField}>
          <Search size={20} strokeWidth={1.5} aria-hidden="true" />
          <input type="search" value={filters.q} maxLength={200} placeholder="O que você quer encontrar?" onChange={e => update({ q: e.target.value, limite: 15 })} />
        </span>
      </label>
      <div className={styles.scoreFilter}>
        <p>Filtrar por nota original</p>
        <div className={styles.filters} role="group" aria-label="Filtrar por nota original">{(["all","90","80","70"] as const).map(n => <button key={n} type="button" aria-pressed={filters.nota === n} onClick={() => update({ nota:n,limite:15 })}>{n === "all" ? "Todos" : `${n}+`}</button>)}</div>
      </div>
    </section>
    <section className={styles.artworkReview} aria-label="Revisão das capas">
      <div className={styles.artworkHeading}>
        <h2>Capas dos álbuns</h2>
        <p>Encontre as capas que precisam da sua escolha ou de uma nova pesquisa.</p>
      </div>
      <div className={styles.artworkFilters} role="group" aria-label="Filtrar por situação da capa">
        <button type="button" aria-pressed={!filters.capas} onClick={()=>update({capas:undefined,limite:15})}>Todas as capas</button>
        {ARTWORK_FILTERS.map(item=><button type="button" key={item.id} aria-pressed={filters.capas===item.id} onClick={()=>update({capas:item.id,limite:15})}>{item.label} ({albums.filter(a=>matchesArtworkFilter(a,item.id)).length})</button>)}
      </div>
    </section>
    <section className={styles.results} aria-label={artworkView?.title ?? "Ranking anual"}>
      <div className={styles.resultsHeading}>
        <h2>{artworkView?.title ?? "Ranking anual"}</h2>
        <p className={styles.resultCount} role="status"><strong>{filtered.length}</strong> de {ranked.length} álbuns</p>
      </div>
      <p className={styles.resultsNote}>Empates compartilham posição.</p>
      {artworkView && <p className={styles.reviewDescription}>{artworkView.description}</p>}
      {filtered.length > 0 && <div className={styles.columns} aria-hidden="true"><span>Posição</span><span>Álbum</span><span>Nota original</span></div>}
      <ol className={styles.ranking}>{filtered.slice(0,filters.limite).map(a => <li key={a.key} className={styles.album}>
        <Link className={styles.row} href={`/albuns/${a.albumId}${catalogQuery(filters)}`}>
          <span className={styles.position}>{a.annualPosition || "Sem posição"}</span>
          <span className={styles.cover}><AlbumCover artwork={a.artwork} artist={a.artist} title={a.title} /></span>
          <span className={styles.identity}>
            <strong>{a.artist}</strong>
            <span className={styles.albumTitle}>{a.title}</span>
            <small className={styles.metadata}>{a.country || "País não informado"}{a.isPresent === false && <span>Ausente na versão atual</span>}</small>
            {filters.capas && <small className={styles.reviewLink}>Buscar ou corrigir capa</small>}
          </span>
          <span className={styles.score}>{scoreLabel(a.originalScore)}<small>Original</small></span>
        </Link>
        <div className={styles.attribution}><ArtworkAttribution artwork={a.artwork} /></div>
      </li>)}</ol>
      {ranked.length === 0 ? <p className={styles.empty}>Nenhum álbum publicado. <Link href="/sincronizacao">Abrir sincronização</Link></p> : filtered.length === 0 && <p className={styles.empty}>{filters.capas ? "Nenhum álbum nesta situação corresponde aos filtros atuais." : "Nenhum álbum encontrado. Tente outro artista, título ou país."}</p>}
      {filtered.length > filters.limite && <button className={styles.more} type="button" onClick={() => update({limite:filters.limite+15})}>Mostrar mais álbuns ({filtered.length-filters.limite} restantes)</button>}
    </section>
  </div>;
}
