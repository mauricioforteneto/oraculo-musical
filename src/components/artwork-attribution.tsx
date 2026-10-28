import { appleAlbumUrl, type AlbumArtwork } from '@/lib/artwork/types';
import styles from './artwork.module.css';
export function ArtworkAttribution({artwork}: {artwork?:AlbumArtwork}) {
  const href=artwork?.status==='found' && artwork.provider==='itunes' ? appleAlbumUrl(artwork.providerUrl) : null;
  return href ? <a className={styles.attribution} href={href} target="_blank" rel="noreferrer">Ver álbum na Apple Music · Capa via iTunes</a> : null;
}
