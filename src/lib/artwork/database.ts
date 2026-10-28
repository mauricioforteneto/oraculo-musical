import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AlbumArtwork, ArtworkStatus } from './types';
import { ArtworkError } from './types';
export type ArtworkQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
const provider = 'musicbrainz-coverartarchive';
export const ARTWORK_JSON = `jsonb_build_object('status',a.status,'selection',a.selection,'releaseGroupId',a.release_group_id,
  'thumbnailUrl',a.thumbnail_url,'imageUrl',a.image_url,'checkedAt',a.checked_at::text,'nextAttemptAt',a.next_attempt_at::text)`;
export async function readArtwork(query: ArtworkQuery, sourceId: string) {
  try {
    const result = await query(`SELECT a.album_id, ${ARTWORK_JSON} AS artwork FROM oraculo.album_artwork a WHERE a.source_id=$1`, [sourceId]);
    return {ready:true,records:new Map(result.rows.map(r => [String(r.album_id),r.artwork as AlbumArtwork]))};
  } catch (error) {
    // Allows a staged deployment to keep serving the catalog before migration 0006.
    if ((error as {code?: string}).code === '42P01') return {ready:false,records:new Map<string,AlbumArtwork>()};
    throw error;
  }
}
export type ArtworkAlbum = { id: string; artist: string; title: string; isPresent: boolean };
export class ArtworkStore {
  constructor(public readonly query: ArtworkQuery) {}
  async source(season: number, folder: string) {
    const result = await this.query('SELECT id FROM oraculo.sources WHERE season=$1 AND folder_id=$2',[season,folder]);
    if (result.rows.length !== 1) throw new ArtworkError('SOURCE_NOT_CONFIGURED');
    return String(result.rows[0].id);
  }
  async albums(source: string): Promise<ArtworkAlbum[]> {
    const result = await this.query(`SELECT st.album_id AS id,st.record->>'artist' AS artist,st.record->>'title' AS title,st.is_present AS "isPresent"
      FROM oraculo.source_album_state st WHERE st.source_id=$1 ORDER BY st.album_id`,[source]);
    return result.rows as ArtworkAlbum[];
  }
  async acquire() {
    const token = randomUUID();
    const result = await this.query(`UPDATE oraculo.artwork_provider_gate SET token=$1,expires_at=clock_timestamp()+interval '25 seconds'
      WHERE provider=$2 AND expires_at <= clock_timestamp() RETURNING token`,[token,provider]);
    if (!result.rows.length) throw new ArtworkError('ARTWORK_BUSY');
    return token;
  }
  async release(token: string) {
    await this.query(`UPDATE oraculo.artwork_provider_gate SET token=NULL,expires_at='-infinity' WHERE provider=$1 AND token=$2`,[provider,token]);
  }
  async reserveRequest(token: string) {
    const result = await this.query(`UPDATE oraculo.artwork_provider_gate
      SET next_request_at=greatest(clock_timestamp(),next_request_at)+interval '1100 milliseconds'
      WHERE provider=$1 AND token=$2 AND expires_at>clock_timestamp()
      RETURNING greatest(0,extract(epoch FROM (next_request_at-interval '1100 milliseconds'-clock_timestamp()))*1000) AS wait`,[provider,token]);
    if (!result.rows.length) throw new ArtworkError('ARTWORK_LEASE_LOST');
    return Math.ceil(Number(result.rows[0].wait));
  }
  async defer(token: string, milliseconds: number) {
    await this.query(`UPDATE oraculo.artwork_provider_gate SET next_request_at=greatest(next_request_at,clock_timestamp()+$3*interval '1 millisecond')
      WHERE provider=$1 AND token=$2`,[provider,token,milliseconds]);
  }
  async write(source: string, album: string, token: string, value: {
    status: ArtworkStatus; manual?: boolean; groupId?: string; thumbnailUrl?: string; imageUrl?: string; nextAttemptAt?: string; userId?: string; errorCode?: string;
  }) {
    const result = await this.query(`INSERT INTO oraculo.album_artwork(source_id,album_id,status,selection,release_group_id,thumbnail_url,image_url,next_attempt_at,selected_by,error_code)
      SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE EXISTS
        (SELECT 1 FROM oraculo.artwork_provider_gate WHERE provider=$11 AND token=$12 AND expires_at>clock_timestamp())
      ON CONFLICT(source_id,album_id) DO UPDATE SET status=EXCLUDED.status,selection=EXCLUDED.selection,release_group_id=EXCLUDED.release_group_id,
        thumbnail_url=EXCLUDED.thumbnail_url,image_url=EXCLUDED.image_url,next_attempt_at=EXCLUDED.next_attempt_at,
        selected_by=EXCLUDED.selected_by,error_code=EXCLUDED.error_code,checked_at=clock_timestamp() RETURNING album_id`,
    [source,album,value.status,value.manual ? 'manual':'automatic',value.groupId ?? null,value.thumbnailUrl ?? null,value.imageUrl ?? null,value.nextAttemptAt ?? null,value.userId ?? null,value.errorCode ?? null,provider,token]);
    if (!result.rows.length) throw new ArtworkError('ARTWORK_LEASE_LOST');
  }
}
