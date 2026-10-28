export type ArtworkStatus = 'pending' | 'found' | 'missing' | 'ambiguous' | 'error' | 'hidden';
export type AlbumArtwork = {
  status: ArtworkStatus;
  selection: 'automatic' | 'manual';
  releaseGroupId: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  checkedAt: string;
  nextAttemptAt: string | null;
};
export type ArtworkSummary = {
  ready: boolean; total: number; found: number; missing: number; ambiguous: number;
  error: number; hidden: number; pending: number; due: number;
};
export type ArtworkCandidate = { id: string; artist: string; title: string; year: string; score: number };
export type ArtworkBatch = { processed: number; remaining: number; summary: ArtworkSummary; paused: boolean; error?: string };
export class ArtworkError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs = 0) { super(code); }
}
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function artworkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (url.hostname !== 'coverartarchive.org' && url.hostname !== 'archive.org' && !url.hostname.endsWith('.archive.org')) return null;
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
    if (!record || (record.selection === 'automatic' && (record.status === 'pending' || (['missing','error'].includes(record.status) && record.nextAttemptAt !== null && Date.parse(record.nextAttemptAt) <= now)))) result.due++;
  }
  return result;
}
