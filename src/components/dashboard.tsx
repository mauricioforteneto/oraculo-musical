"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArtworkAttribution } from "./artwork-attribution";
import { AlbumCover } from "./album-cover";
import { useRouter } from "next/navigation";
import type { LocalSourcePreview } from "@/lib/catalog/types";
import { rankAnnualAlbums } from "@/lib/catalog/ranking";
import { scoreLabel } from "@/lib/catalog/presentation";
import type { getCompetitionState } from "@/lib/competition/service";
import styles from "./workspace.module.css";

const legacyDestinations: Record<string, string> = {
  "#acervo": "/albuns", "#top-50": "/top-50", "#chaveamento": "/playoffs",
  "#historico-competitivo": "/playoffs?aba=historico", "#backlog": "/",
};
export function Dashboard({ source, competition }: { source: LocalSourcePreview | null; competition: Awaited<ReturnType<typeof getCompetitionState>> | null }) {
  const router = useRouter();
  useEffect(() => {
    function redirect() { const destination = legacyDestinations[window.location.hash]; if (destination) router.replace(destination); }
    redirect(); window.addEventListener("hashchange", redirect);
    return () => window.removeEventListener("hashchange", redirect);
  }, [router]);
  const albums = rankAnnualAlbums(source?.albums ?? []);
  const scores = albums.flatMap(a => a.originalScore === null ? [] : [a.originalScore]);
  const average = scores.length ? scores.reduce((a,b) => a+b,0)/scores.length : null;
  const metrics = [["Álbuns ouvidos", String(albums.length)], ["Média original", scoreLabel(average)],
    ["Notas 90 ou mais", String(scores.filter(s => s >= 90).length)], ["Participantes nos Playoffs", String(competition?.active?.participants.length ?? 0)]];
  return <div className={styles.stack}>
    {!source?.version && <section className={styles.card}><h2>Seu acervo começa aqui</h2><p>Publique a planilha pela página de sincronização para acompanhar a temporada.</p><Link className={styles.action} href="/sincronizacao">Abrir sincronização</Link></section>}
    <section className={styles.metrics} aria-label="Resumo do acervo">{metrics.map(([label,value]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    {albums.length > 0 && <section className={styles.card}><span className={styles.eyebrow}>DESTAQUES DA ESCUTA</span><h2>As maiores notas originais</h2>
      <ol className={styles.highlights}>{albums.slice(0,3).map(a => <li key={a.key}><span>{String(a.annualPosition).padStart(2,"0")}</span><AlbumCover artwork={a.artwork} artist={a.artist} title={a.title} /><div>{a.albumId ? <Link href={`/albuns/${a.albumId}`}><strong>{a.artist}</strong><small>{a.title}</small></Link> : <><strong>{a.artist}</strong><small>{a.title}</small></>}<ArtworkAttribution artwork={a.artwork} /></div><span>{scoreLabel(a.originalScore)}</span></li>)}</ol>
      <Link className={styles.action} href="/albuns">Explorar os álbuns</Link>
    </section>}
    <div className={styles.grid}>
      <section className={styles.card}><span className={styles.eyebrow}>TEMPORADA EM DISPUTA</span><h2>Playoffs</h2><p>{competition?.active ? `Chave congelada na versão ${competition.active.fileVersion}. Acompanhe os resultados publicados e os classificados de cada fase.` : "A chave aparecerá após a confirmação do corte oficial."}</p><Link className={styles.action} href="/playoffs">Acompanhar confrontos</Link></section>
      <section className={styles.card}><span className={styles.eyebrow}>RANKING DA TEMPORADA</span><h2>Top 50 provisório</h2><p>{competition?.projection ? "Confira a classificação calculada pela nota original e pela melhor fase comprovada de cada álbum." : "A projeção estará disponível após a confirmação dos participantes."}</p><Link className={styles.action} href="/top-50">Ver classificação</Link></section>
    </div>
  </div>;
}
