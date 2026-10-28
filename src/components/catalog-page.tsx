"use client";
import Link from "next/link";
import { AlbumCover } from "./album-cover";
import { useSearchParams } from "next/navigation";
import type { AlbumRecord } from "@/lib/catalog/types";
import { rankAnnualAlbums } from "@/lib/catalog/ranking";
import { catalogFilters, catalogQuery, type CatalogFilters } from "@/lib/catalog/catalog-navigation";
import { scoreLabel } from "@/lib/catalog/presentation";
import styles from "./workspace.module.css";
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function CatalogPage({ albums }: { albums: AlbumRecord[] }) {
  const params = useSearchParams();
  const filters = catalogFilters(params);
  const ranked = rankAnnualAlbums(albums);
  const filtered = ranked.filter(a => normalize([a.artist,a.title,a.genre,a.country].join(" ")).includes(normalize(filters.q.trim()))
    && (filters.nota === "all" || (a.originalScore ?? -1) >= Number(filters.nota)));
  function update(next: Partial<CatalogFilters>) {
    window.history.replaceState(null,"",`/albuns${catalogQuery({ ...filters,...next })}`);
  }
  return <div className={styles.stack}>
    <section className={styles.card} aria-label="Buscar e filtrar álbuns">
      <label className={styles.search}>Buscar por álbum, artista, gênero ou país<input type="search" value={filters.q} maxLength={200} placeholder="O que você quer encontrar?" onChange={e => update({ q: e.target.value, limite: 15 })} /></label>
      <p className={styles.muted}>Filtrar por nota original</p>
      <div className={styles.filters} role="group" aria-label="Filtrar por nota original">{(["all","90","80","70"] as const).map(n => <button key={n} type="button" aria-pressed={filters.nota === n} onClick={() => update({ nota:n,limite:15 })}>{n === "all" ? "Todos" : `${n}+`}</button>)}</div>
    </section>
    <section className={styles.card} aria-label="Ranking anual">
      <h2>Ranking anual</h2><p className={styles.muted} role="status">{filtered.length} de {ranked.length} álbuns · Empates compartilham posição.</p>
      <ol className={styles.ranking}>{filtered.slice(0,filters.limite).map(a => <li key={a.key}>
        <Link className={styles.row} href={`/albuns/${a.albumId}${catalogQuery(filters)}`}><span>{a.annualPosition || "—"}</span><AlbumCover artwork={a.artwork} artist={a.artist} title={a.title} /><span className={styles.identity}><strong>{a.artist}</strong><span>{a.title}</span><small>{a.country || "País não informado"}{a.isPresent === false ? " · ausente na versão atual" : ""}</small></span><span className={styles.score}>{scoreLabel(a.originalScore)}<small>ORIGINAL</small></span></Link>
      </li>)}</ol>
      {ranked.length === 0 ? <p className={styles.muted}>Nenhum álbum publicado. <Link href="/sincronizacao">Abrir sincronização</Link></p> : filtered.length === 0 && <p className={styles.muted}>Nenhum álbum encontrado. Tente outro artista, título ou país.</p>}
      {filtered.length > filters.limite && <button className={styles.action} type="button" onClick={() => update({limite:filters.limite+15})}>Mostrar mais álbuns ({filtered.length-filters.limite} restantes)</button>}
    </section>
  </div>;
}
