"use client";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ArtworkSummary, ArtworkBatch } from '@/lib/artwork/types';
import { artworkMessage, artworkPost } from '@/lib/artwork/messages';
import styles from './workspace.module.css';
import art from './artwork.module.css';
export type ArtworkSyncHandle={ start:()=>void };
export function ArtworkSync({initial,ref}: {initial?:ArtworkSummary;ref?:React.Ref<ArtworkSyncHandle>}) {
  const router=useRouter();
  const [summary,setSummary]=useState<ArtworkSummary|null>(null);
  const current=summary ?? initial;
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const running=useRef(false),stopped=useRef(false),mounted=useRef(true),controller=useRef<AbortController|null>(null);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;stopped.current=true;controller.current?.abort();};},[]);
  const start=useCallback(async ()=>{
    if(running.current || !initial?.ready) return;
    running.current=true; stopped.current=false; setBusy(true); setFeedback('Buscando capas…');
    controller.current=new AbortController();
    try {
      for(;;) {
        const result=await artworkPost<ArtworkBatch>('/api/artwork/batch',{},controller.current.signal);
        if(!mounted.current) return;
        setSummary(result.summary);
        if(result.paused) {setFeedback(artworkMessage(result.error ?? 'ARTWORK_PROVIDER_UNAVAILABLE')); break;}
        if(stopped.current) {setFeedback('Busca pausada. O progresso foi salvo; você pode retomar depois.');break;}
        if(result.remaining===0) {setFeedback('Busca concluída. Casos sem capa ou com correspondência duvidosa podem ser revisados no detalhe do álbum.');break;}
        // Defensive stop: a provider gate or exhausted budget must not cause a busy loop.
        if(result.processed===0) {setFeedback(artworkMessage('ARTWORK_RATE_LIMIT'));break;}
        setFeedback(`${result.summary.found} de ${result.summary.total} álbuns com capa. Buscando o próximo lote…`);
      }
    } catch(error) {if(mounted.current) setFeedback(artworkMessage(error instanceof Error ? error.message : 'ARTWORK_PROVIDER_UNAVAILABLE'));}
    finally {running.current=false;if(mounted.current) {setBusy(false);router.refresh();}}
  },[initial?.ready,router]);
  useImperativeHandle(ref,()=>({start:()=>{void start();}}),[start]);
  function stop() {stopped.current=true;setFeedback('Parando após o lote atual…');}
  return <section className={styles.card} aria-labelledby="artwork-sync-title">
    <span className={styles.eyebrow}>CAPAS DOS ÁLBUNS</span><h2 id="artwork-sync-title">Completar as capas</h2>
    <p>Busca gratuita no MusicBrainz e Cover Art Archive. Após sincronizar, procuramos as capas em lotes. Mantenha esta página aberta durante a busca; o progresso concluído fica salvo.</p>
    {!current?.ready ? <p>A busca de capas ainda precisa da configuração de armazenamento. O catálogo continua disponível.</p> : <>
      <p>{current.found} de {current.total} álbuns com capa · {current.ambiguous} para revisar · {current.missing} sem capa encontrada · {current.error} com falha temporária · {current.hidden} ocultas · {current.due} aguardando busca.</p>
      <progress className={art.progress} value={current.total-current.due} max={Math.max(1,current.total)} aria-label="Progresso da busca de capas" />
    </>}
    <div className={styles.actions}><button className={styles.action} type="button" disabled={busy || !current?.ready} onClick={()=>void start()}>{current && current.found+current.ambiguous+current.missing+current.error+current.hidden>0 ? 'Retomar busca de capas':'Buscar capas'}</button>
      {busy && <button className={styles.action} type="button" onClick={stop}>Parar busca</button>}</div>
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
