export type ArtworkStatus = 'pending' | 'found' | 'missing' | 'ambiguous' | 'error' | 'hidden';
export type AlbumArtwork = {
  status: ArtworkStatus;
  selection: 'automatic' | 'manual';
  releaseGroupId: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  checkedAt: string;
  nextAttemptAt: string | null;
  errorCode?: string | null;
  provider?: 'musicbrainz' | 'itunes';
  itunesCollectionId?: string | null;
  providerUrl?: string | null;
  fallbackCheckedAt?: string | null;
};
export type ArtworkSummary = {
  ready: boolean; total: number; found: number; missing: number; ambiguous: number;
  error: number; hidden: number; pending: number; due: number;
};
export type ArtworkSource = 'musicbrainz' | 'itunes';
export type ArtworkEndpoint = 'MUSICBRAINZ' | 'COVER_ART_ARCHIVE' | 'ITUNES';
export type ArtworkCandidate = { id: string; artist: string; title: string; year: string; score: number; provider?: ArtworkSource };
export type ArtworkBatch = { processed: number; remaining: number; summary: ArtworkSummary; paused: boolean; error?: string; nextRetryAt?: string };
export type ArtworkDiagnostic = {
  provider: ArtworkEndpoint | 'INTERNET_ARCHIVE';
  reason: 'HTTP' | 'TIMEOUT' | 'NETWORK' | 'DNS' | 'TLS' | 'INVALID_RESPONSE' | 'BODY_TOO_LARGE' | 'REDIRECT_REJECTED' | 'COOLDOWN';
  httpStatus?: number;
};
export class ArtworkError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs = 0, public readonly diagnostic?: ArtworkDiagnostic) { super(code); }
}
export function artworkErrorCode(error: ArtworkError) {
  const detail=error.diagnostic;
  return detail ? `${error.code}:${detail.provider}:${detail.reason}${detail.reason==='HTTP' ? `_${detail.httpStatus}` : ''}` : error.code;
}
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isArtworkId = (value: string) => isUuid(value) || /^itunes:[1-9][0-9]{0,14}$/.test(value);
export function appleAlbumUrl(value: unknown): string | null {
  if(typeof value!=='string') return null;
  try {
    const url=new URL(value);
    if(url.protocol!=='https:' || !['music.apple.com','itunes.apple.com'].includes(url.hostname) || url.username || url.password || url.port || !/^\/(?:[a-z]{2}\/)?album\//.test(url.pathname)) return null;
    url.hostname='music.apple.com';url.search='';url.hash='';return url.href;
  } catch {return null;}
}
export function artworkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const apple=/^is[1-9][0-9]*-ssl\.mzstatic\.com$/.test(url.hostname) && url.pathname.startsWith('/image/');
    if (!apple && url.hostname !== 'coverartarchive.org' && url.hostname !== 'archive.org' && !url.hostname.endsWith('.archive.org')) return null;
    url.protocol = 'https:';
    return url.href;
  } catch { return null; }
}
export function summaryFor(albums: { albumId?: string; isPresent?: boolean }[], records: Map<string, AlbumArtwork>, ready: boolean, now = Date.now()): ArtworkSummary {
  const result: ArtworkSummary = {ready,total:0,found:0,missing:0,ambiguous:0,error:0,hidden:0,pending:0,due:0};
  for (const album of albums.filter(a => a.isPresent !== false)) {
    result.total++;
    const record = album.albumId ? records.get(album.albumId) : undefined;
    result[record?.status ?? 'pending']++;
    if (artworkDue(record,now)) result.due++;
  }
  return result;
}
export function artworkDue(record: AlbumArtwork | undefined,now=Date.now()) {
  return !record || (record.selection==='automatic' && (record.status==='pending' || (['missing','error'].includes(record.status) &&
    (!record.fallbackCheckedAt || (record.nextAttemptAt!==null && Date.parse(record.nextAttemptAt)<=now)))));
}
