"use client";
import { useArtworkPost } from "./season-context";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SeasonLink as Link } from "./season-context";
import { useRouter } from 'next/navigation';
import type { AlbumRecord } from '@/lib/catalog/types';
import type { ArtworkSummary, ArtworkBatch } from '@/lib/artwork/types';
import { artworkMessage } from '@/lib/artwork/messages';
import { runArtworkSearch, waitForArtwork } from '@/lib/artwork/runner';
import styles from './workspace.module.css';
import art from './artwork.module.css';
export type ArtworkSyncHandle={ start:()=>void };
export function ArtworkSync({initial,failures=[],ref}: {initial?:ArtworkSummary;failures?:AlbumRecord[];ref?:React.Ref<ArtworkSyncHandle>}) {
  const router=useRouter();
  const artworkPost=useArtworkPost();
  const [summary,setSummary]=useState<ArtworkSummary|null>(null);
  const current=summary ?? initial;
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const waiting=useRef<AbortController|null>(null);
  const running=useRef(false),stopped=useRef(false),mounted=useRef(true),controller=useRef<AbortController|null>(null);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;stopped.current=true;controller.current?.abort();waiting.current?.abort();};},[]);
  const start=useCallback(async ()=>{
    if(running.current || !initial?.ready) return;
    running.current=true; stopped.current=false; setBusy(true); setFeedback('Buscando capas…');
    controller.current=new AbortController();waiting.current=new AbortController();
    try {
      await runArtworkSearch({
        request:()=>artworkPost<ArtworkBatch>('/api/artwork/batch',{},controller.current!.signal),
        update:result=>{if(mounted.current) setSummary(result.summary);},
        feedback:message=>{if(mounted.current) setFeedback(message);},
        stopped:()=>stopped.current || !mounted.current,
        wait:ms=>waitForArtwork(ms,waiting.current!.signal),
      });
    } catch(error) {if(mounted.current) setFeedback(artworkMessage(error instanceof Error ? error.message : 'ARTWORK_PROVIDER_UNAVAILABLE'));}
    finally {running.current=false;if(mounted.current) {setBusy(false);router.refresh();}}
  },[initial?.ready,router,artworkPost]);
  useImperativeHandle(ref,()=>({start:()=>{void start();}}),[start]);
  function stop() {stopped.current=true;waiting.current?.abort();setFeedback('Parando após o lote atual…');}
  return <section className={styles.card} aria-labelledby="artwork-sync-title">
    <span className={styles.eyebrow}>CAPAS DOS ÁLBUNS</span><h2 id="artwork-sync-title">Completar as capas</h2>
    <p>Busca gratuita no MusicBrainz, Cover Art Archive e iTunes. Após sincronizar, procuramos as capas em lotes. Falhas temporárias têm retomada automática por até dez minutos. Mantenha esta página aberta; o progresso concluído fica salvo.</p>
    {!current?.ready ? <p>A busca de capas ainda precisa da configuração de armazenamento. O catálogo continua disponível.</p> : <>
      <p>{current.found} de {current.total} álbuns com capa · {current.ambiguous} para revisar · {current.missing} sem capa encontrada · {current.error} com falha temporária · {current.hidden} ocultas · {current.due} aguardando busca.</p>
      <progress className={art.progress} value={current.total-current.due} max={Math.max(1,current.total)} aria-label="Progresso da busca de capas" />
    </>}
    <div className={styles.actions}><button className={styles.action} type="button" disabled={busy || !current?.ready} onClick={()=>void start()}>{current && current.found+current.ambiguous+current.missing+current.error+current.hidden>0 ? 'Retomar busca de capas':'Buscar capas'}</button>
      {busy && <button className={styles.action} type="button" onClick={stop}>Parar busca</button>}</div>
    <div className={styles.actions} aria-label="Revisar capas"><Link className={styles.action} href="/albuns?capas=revisar">Revisar capas{current ? ` (${current.ambiguous})`:''}</Link><Link className={styles.action} href="/albuns?capas=sem-capa">Ver álbuns sem capa</Link></div>
    {failures.length>0 && <details className={art.failures}><summary>Ver falhas das capas ({failures.length})</summary><ul className={styles.issueList}>{failures.map(album=><li key={album.albumId}><strong>{album.artist} — {album.title}</strong><span>{album.artwork?.errorCode?.includes(':') ? artworkMessage(album.artwork.errorCode) : 'A tentativa anterior não registrou o motivo detalhado. Ele será registrado após uma nova tentativa.'}</span></li>)}</ul></details>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
