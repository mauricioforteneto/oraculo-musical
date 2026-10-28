"use client";
import { useState } from 'react';
import Image from 'next/image';
import { Disc3 } from 'lucide-react';
import { artworkUrl, type AlbumArtwork } from '@/lib/artwork/types';
import styles from './artwork.module.css';
export function AlbumCover({artwork,artist,title,large=false}: {artwork?:AlbumArtwork;artist:string;title:string;large?:boolean}) {
  const [failed,setFailed]=useState<string|null>(null);
  const src=artwork?.status==='found' ? artworkUrl(large ? artwork.imageUrl : artwork.thumbnailUrl) : null;
  return <span className={`${styles.cover} ${large ? styles.large : styles.small}`}>
    {src && src!==failed ? <Image unoptimized src={src} alt={`Capa de ${title}, de ${artist}`} width={large ? 500:250} height={large ? 500:250} loading="lazy" onError={()=>setFailed(src)} />
      : <Disc3 size={large ? 72:26} strokeWidth={1.2} role="img" aria-label="Capa indisponível" />}
  </span>;
}
