"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AlbumRecord } from '@/lib/catalog/types';
import type { AlbumArtwork, ArtworkCandidate, ArtworkSource } from '@/lib/artwork/types';
import { artworkMessage, artworkPost } from '@/lib/artwork/messages';
import { ArtworkAttribution } from './artwork-attribution';
import { AlbumCover } from './album-cover';
import styles from './workspace.module.css';
import art from './artwork.module.css';
type Preview={candidate:ArtworkCandidate;artwork:AlbumArtwork};
export function ArtworkEditor({album,initialOpen=false}: {album:AlbumRecord;initialOpen?:boolean}) {
  const router=useRouter();
  const [open,setOpen]=useState(initialOpen || album.artwork?.status==='ambiguous');
  const [artist,setArtist]=useState(album.artist),[title,setTitle]=useState(album.title);
  const [provider,setProvider]=useState<ArtworkSource>(album.artwork?.provider ?? 'musicbrainz');
  const [candidates,setCandidates]=useState<ArtworkCandidate[]>([]);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
  const [override,setOverride]=useState<AlbumArtwork|undefined>(undefined);
  const current=override ?? album.artwork;
  if(!album.albumId) return null;
  const base=`/api/artwork/${album.albumId}`;
  async function perform(task:()=>Promise<void>) {
    if(busy) return;
    setBusy(true);setFeedback('');
    try {await task();} catch(error) {setFeedback(artworkMessage(error instanceof Error ? error.message : 'ARTWORK_PROVIDER_UNAVAILABLE'));}
    finally {setBusy(false);}
  }
  async function search() {
    setPreview(null);setCandidates([]);
    const result=await artworkPost<{candidates:ArtworkCandidate[]}>(`${base}/search`,{artist,title,provider});
    setCandidates(result.candidates);
    setFeedback(result.candidates.length ? 'Escolha um lançamento para visualizar a capa antes de confirmar.' : 'Nenhum lançamento encontrado. Tente ajustar artista ou título nesta busca.');
  }
  async function choose(action:'select'|'hide'|'automatic') {
    const result=await artworkPost<{artwork?:AlbumArtwork}>(`${base}/selection`,{action,...(action==='select' ? {groupId:preview!.candidate.id}:{})});
    setOverride(result.artwork ?? {status:action==='hide' ? 'hidden':'pending',selection:action==='hide' ? 'manual':'automatic',releaseGroupId:null,thumbnailUrl:null,imageUrl:null,checkedAt:new Date().toISOString(),nextAttemptAt:null});
    setPreview(null);setFeedback(action==='select' ? 'Capa confirmada. Sua escolha será preservada nas próximas sincronizações.' : action==='hide' ? 'Capa ocultada. A busca automática não substituirá esta escolha.' : 'Busca automática reativada. Use Buscar capas na página de Sincronização.');
    router.refresh();
  }
  return <section className={styles.card} aria-label="Capa do álbum">
    <div className={art.detail}><AlbumCover artwork={current} artist={album.artist} title={album.title} large /><div><h2>Capa do álbum</h2>
      <p>{current?.status==='found' ? current.selection==='manual' ? 'Capa escolhida por você.':'Correspondência automática por artista e título.' : current?.status==='ambiguous' ? 'Encontramos mais de uma possibilidade. Escolha o lançamento correto abaixo.' : current?.status==='hidden' ? 'Você optou por ocultar a capa deste álbum.' : 'Ainda não há uma capa disponível para este álbum.'}</p>
      <ArtworkAttribution artwork={current} />
      {current?.status==='found' && current.provider!=='itunes' && current.releaseGroupId && <p>Fonte: MusicBrainz / Cover Art Archive · <a href={`https://musicbrainz.org/release-group/${current.releaseGroupId}`} target="_blank" rel="noreferrer">Ver lançamento</a></p>}
    </div></div>
    <details className={art.controls} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Buscar ou corrigir capa</summary><p>Os campos abaixo servem apenas para identificar a capa. A avaliação e os dados da planilha permanecem preservados.</p>
      <label className={art.provider}>Fonte da busca<select aria-label="Fonte da busca" value={provider} disabled={busy} onChange={e=>{setProvider(e.target.value as ArtworkSource);setCandidates([]);setPreview(null);}}><option value="musicbrainz">MusicBrainz / Cover Art Archive</option><option value="itunes">iTunes</option></select></label>
      <form onSubmit={e=>{e.preventDefault();void perform(search);}}><div className={art.fields}>
        <label>Artista para buscar a capa<input value={artist} maxLength={200} required onChange={e=>setArtist(e.target.value)} /></label>
        <label>Álbum para buscar a capa<input value={title} maxLength={200} required onChange={e=>setTitle(e.target.value)} /></label>
      </div><button className={styles.action} type="submit" disabled={busy}>Pesquisar capas</button></form>
      <ul className={art.candidates}>{candidates.map(c=><li key={c.id}><button type="button" disabled={busy} onClick={()=>void perform(async ()=>{setPreview(null);setPreview(await artworkPost<Preview>(`${base}/selection`,{action:'preview',groupId:c.id}));})}>
        <strong>{c.artist}</strong><span>{c.title}{c.year ? ` · ${c.year}`:''}</span><span>Visualizar capa</span>
      </button></li>)}</ul>
      {preview && <div className={art.preview}><h3>Confira antes de confirmar</h3><AlbumCover artwork={preview.artwork} artist={preview.candidate.artist} title={preview.candidate.title} large /><p>{preview.candidate.artist} · {preview.candidate.title}</p><ArtworkAttribution artwork={preview.artwork} /><button className={styles.action} type="button" disabled={busy} onClick={()=>void perform(()=>choose('select'))}>Confirmar esta capa</button></div>}
      <div className={styles.actions}><button className={styles.action} type="button" disabled={busy} onClick={()=>void perform(()=>choose('hide'))}>Ocultar capa</button><button className={styles.action} type="button" disabled={busy} onClick={()=>void perform(()=>choose('automatic'))}>Usar busca automática</button></div>
    </details>
    {busy && <p role="status">Consultando capas…</p>}{feedback && <p role="status">{feedback}</p>}
  </section>;
}
