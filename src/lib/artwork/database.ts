import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AlbumArtwork, ArtworkStatus, ArtworkEndpoint } from './types';
import { ArtworkError } from './types';
export type ArtworkQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
const provider = 'musicbrainz-coverartarchive';
export const ARTWORK_JSON = `jsonb_build_object('status',a.status,'selection',a.selection,'releaseGroupId',a.release_group_id,
  'thumbnailUrl',a.thumbnail_url,'imageUrl',a.image_url,'checkedAt',a.checked_at::text,'nextAttemptAt',a.next_attempt_at::text,'errorCode',a.error_code,
  'provider',coalesce(to_jsonb(a)->>'provider','musicbrainz'),'itunesCollectionId',to_jsonb(a)->>'itunes_collection_id',
  'providerUrl',to_jsonb(a)->>'provider_url','fallbackCheckedAt',to_jsonb(a)->>'fallback_checked_at')`;
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
    const schema=await this.query("SELECT to_regclass('oraculo.artwork_provider_limits') IS NOT NULL AS ready");
    if(!schema.rows[0]?.ready) throw new ArtworkError('ARTWORK_STORAGE_UPGRADE_REQUIRED');
    const token = randomUUID();
    const result = await this.query(`UPDATE oraculo.artwork_provider_gate SET token=$1,expires_at=clock_timestamp()+interval '25 seconds'
      WHERE provider=$2 AND expires_at <= clock_timestamp() RETURNING token`,[token,provider]);
    if (!result.rows.length) throw new ArtworkError('ARTWORK_BUSY');
    return token;
  }
  async release(token: string) {
    await this.query(`UPDATE oraculo.artwork_provider_gate SET token=NULL,expires_at='-infinity' WHERE provider=$1 AND token=$2`,[provider,token]);
  }
  async reserveRequest(token: string, endpoint: ArtworkEndpoint='MUSICBRAINZ',maxWaitMs=20_000) {
    const interval=endpoint==='ITUNES' ? 3100 : 1100;
    const result = await this.query(`WITH slot AS (SELECT provider,next_request_at,clock_timestamp() AS requested_at FROM oraculo.artwork_provider_limits WHERE provider=$3)
      UPDATE oraculo.artwork_provider_limits l SET next_request_at=CASE WHEN slot.next_request_at <= slot.requested_at+$5*interval '1 millisecond'
        THEN greatest(slot.requested_at,slot.next_request_at)+$4*interval '1 millisecond' ELSE slot.next_request_at END
      FROM slot WHERE l.provider=slot.provider AND EXISTS (SELECT 1 FROM oraculo.artwork_provider_gate WHERE provider=$1 AND token=$2 AND expires_at>clock_timestamp())
      RETURNING greatest(0,extract(epoch FROM (slot.next_request_at-slot.requested_at))*1000) AS wait`,[provider,token,endpoint,interval,maxWaitMs]);
    if (!result.rows.length) throw new ArtworkError('ARTWORK_LEASE_LOST');
    return Math.ceil(Number(result.rows[0].wait));
  }
  async defer(token: string, milliseconds: number,endpoint: ArtworkEndpoint='MUSICBRAINZ',failed=false) {
    const result=await this.query(`UPDATE oraculo.artwork_provider_limits SET
      next_request_at=greatest(next_request_at,clock_timestamp()+greatest($3,CASE WHEN $5 THEN least(1800000,30000*power(2,least(failures,6))) ELSE 0 END)*interval '1 millisecond'),
      failures=CASE WHEN $5 THEN least(failures+1,100) ELSE failures END
      WHERE provider=$4 AND EXISTS (SELECT 1 FROM oraculo.artwork_provider_gate WHERE provider=$1 AND token=$2 AND expires_at>clock_timestamp())
      RETURNING provider`,[provider,token,milliseconds,endpoint,failed]);
    if(!result.rows.length) throw new ArtworkError('ARTWORK_LEASE_LOST');
  }
  async succeeded(token: string,endpoint: ArtworkEndpoint) {
    await this.query(`UPDATE oraculo.artwork_provider_limits SET failures=0 WHERE provider=$3 AND EXISTS
      (SELECT 1 FROM oraculo.artwork_provider_gate WHERE provider=$1 AND token=$2 AND expires_at>clock_timestamp())`,[provider,token,endpoint]);
  }
  async retryAt() {
    const result=await this.query(`SELECT provider,next_request_at::text AS retry_at FROM oraculo.artwork_provider_limits`);
    return new Map(result.rows.map(row=>[String(row.provider),Date.parse(String(row.retry_at))]));
  }
  async write(source: string, album: string, token: string, value: {
    status: ArtworkStatus; manual?: boolean; groupId?: string; thumbnailUrl?: string; imageUrl?: string; nextAttemptAt?: string; userId?: string; errorCode?: string;
    provider?: 'musicbrainz'|'itunes'; itunesCollectionId?: string; providerUrl?: string; fallbackCheckedAt?: string;
  }) {
    const result = await this.query(`INSERT INTO oraculo.album_artwork(source_id,album_id,status,selection,release_group_id,thumbnail_url,image_url,next_attempt_at,selected_by,error_code,provider,itunes_collection_id,provider_url,fallback_checked_at)
      SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$13,$14,$15,$16 WHERE EXISTS
        (SELECT 1 FROM oraculo.artwork_provider_gate WHERE provider=$11 AND token=$12 AND expires_at>clock_timestamp())
      ON CONFLICT(source_id,album_id) DO UPDATE SET status=EXCLUDED.status,selection=EXCLUDED.selection,release_group_id=EXCLUDED.release_group_id,
        thumbnail_url=EXCLUDED.thumbnail_url,image_url=EXCLUDED.image_url,next_attempt_at=EXCLUDED.next_attempt_at,
        selected_by=EXCLUDED.selected_by,error_code=EXCLUDED.error_code,checked_at=clock_timestamp(),provider=EXCLUDED.provider,
        itunes_collection_id=EXCLUDED.itunes_collection_id,provider_url=EXCLUDED.provider_url,fallback_checked_at=EXCLUDED.fallback_checked_at RETURNING album_id`,
    [source,album,value.status,value.manual ? 'manual':'automatic',value.groupId ?? null,value.thumbnailUrl ?? null,value.imageUrl ?? null,value.nextAttemptAt ?? null,value.userId ?? null,value.errorCode ?? null,provider,token,value.provider ?? 'musicbrainz',value.itunesCollectionId ?? null,value.providerUrl ?? null,value.fallbackCheckedAt ?? null]);
    if (!result.rows.length) throw new ArtworkError('ARTWORK_LEASE_LOST');
  }
}
