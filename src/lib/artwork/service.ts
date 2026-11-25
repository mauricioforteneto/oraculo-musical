import { seasonContext, type SeasonContext } from "@/lib/seasons/context";
import 'server-only';
import { databasePool } from '@/lib/db/pool';
import { ArtworkStore, readArtwork, type ArtworkAlbum } from './database';
import { ArtworkProvider, exactCandidate } from './provider';
import { ArtworkError, artworkErrorCode, artworkDue, summaryFor, type AlbumArtwork, type ArtworkBatch, type ArtworkSource } from './types';

type ArtworkWrite=Parameters<ArtworkStore['write']>[3];
const externalError=(error:unknown):error is ArtworkError=>error instanceof ArtworkError &&
  (error.code.startsWith('ARTWORK_PROVIDER_') || error.code==='ARTWORK_COOLDOWN' || error.code==='ARTWORK_BUDGET');
export class ArtworkService {
  constructor(private readonly store: ArtworkStore, private readonly fetcher: typeof fetch = fetch, private readonly season?: SeasonContext) {}
  private async context() {
    const context=this.season ?? seasonContext();
    const season=context.year;
    const folder=context.folderId;
    if(!Number.isInteger(season) || !folder) throw new ArtworkError('SOURCE_NOT_CONFIGURED');
    const source=await this.store.source(season,folder);
    return {source,albums:await this.store.albums(source)};
  }
  private async session<T>(callback: (provider: ArtworkProvider,token: string,deadline: number)=>Promise<T>) {
    const token=await this.store.acquire();
    const deadline=Date.now()+20_000;
    const provider=new ArtworkProvider({fetch:this.fetcher,deadline,now:Date.now,
      sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),reserve:(endpoint,maxWait)=>this.store.reserveRequest(token,endpoint,maxWait),
      defer:(ms,endpoint,failed)=>this.store.defer(token,ms,endpoint,failed),succeeded:endpoint=>this.store.succeeded(token,endpoint)});
    try { return await callback(provider,token,deadline); }
    finally { await this.store.release(token); }
  }
  private async records(source: string) {
    const result=await readArtwork(this.store.query,source);
    if(!result.ready) throw new ArtworkError('ARTWORK_STORAGE_UNAVAILABLE');
    return result.records;
  }
  private async resolve(provider:ArtworkProvider,album:ArtworkAlbum,previous?:AlbumArtwork):Promise<ArtworkWrite> {
    let primaryError:ArtworkError|undefined;
    let inheritedErrorCode:string|undefined;
    // Legacy negatives get their first Apple search immediately, without repeating MusicBrainz.
    const fallbackOnly=previous && ['missing','error'].includes(previous.status) && !previous.fallbackCheckedAt;
    if(!fallbackOnly) {
      try {
        const search=await provider.search(album.artist,album.title);
        const match=search.complete ? exactCandidate(search.candidates,album.artist,album.title) : null;
        if(!match && search.candidates.length) return {status:'ambiguous'};
        if(match) {
          const cover=await provider.cover(match.id);
          if(cover) return {status:'found',groupId:match.id,...cover};
        }
      } catch(error) {if(!externalError(error)) throw error;primaryError=error;}
    } else if(previous.status==='error') {
      primaryError=new ArtworkError(previous.errorCode?.split(':')[0] ?? 'ARTWORK_PROVIDER_UNAVAILABLE');
      inheritedErrorCode=previous.errorCode ?? undefined;
    }
    const fallbackCheckedAt=new Date().toISOString();
    try {
      const search=await provider.itunesSearch(album.artist,album.title);
      const match=search.complete ? exactCandidate(search.candidates,album.artist,album.title) : null;
      if(match) {
        const found=search.candidates.find(c=>c.id===match.id)!;
        return {status:'found',...found.artwork,fallbackCheckedAt};
      }
      if(search.candidates.length) return {status:'ambiguous',provider:'itunes',fallbackCheckedAt};
      if(!primaryError) return {status:'missing',fallbackCheckedAt,nextAttemptAt:new Date(Date.now()+7*86400_000).toISOString()};
    } catch(error) {if(!externalError(error)) throw error;primaryError=error;inheritedErrorCode=undefined;}
    const limits=await this.store.retryAt();
    const target=primaryError?.diagnostic?.provider ?? inheritedErrorCode?.split(':')[1];
    const endpoint=target==='INTERNET_ARCHIVE' ? 'COVER_ART_ARCHIVE' : target ?? 'MUSICBRAINZ';
    const retry=limits.get(endpoint);
    return {status:'error',fallbackCheckedAt,errorCode:inheritedErrorCode ?? (primaryError ? artworkErrorCode(primaryError) : 'ARTWORK_PROVIDER_UNAVAILABLE'),
      nextAttemptAt:new Date(Math.max(Date.now()+30_000,Number.isFinite(retry) ? retry! : 0)).toISOString()};
  }
  async batch(): Promise<ArtworkBatch> {
    const {source,albums}=await this.context();
    return this.session(async (provider,token,deadline)=>{
      const records=await this.records(source);
      const pending=albums.filter(a=>a.isPresent && artworkDue(records.get(a.id))).slice(0,5);
      let processed=0;
      for(const album of pending) {
        if(Date.now()+200>=deadline) break;
        await this.store.write(source,album.id,token,await this.resolve(provider,album,records.get(album.id)));
        processed++;
      }
      const updated=await this.records(source);
      const summary=summaryFor(albums.map(a=>({albumId:a.id,isPresent:a.isPresent})),updated,true);
      const retries=albums.filter(a=>a.isPresent).map(a=>updated.get(a.id)).filter(a=>a?.selection==='automatic' && a.status==='error')
        .map(a=>Date.parse(a!.nextAttemptAt ?? '')).filter(Number.isFinite);
      const nextRetryAt=retries.length ? new Date(Math.max(Date.now()+1000,Math.min(...retries))).toISOString() : undefined;
      return {processed,remaining:summary.due,summary,paused:false,...(nextRetryAt ? {nextRetryAt}:{})};
    });
  }
  private async album(id: string) {
    const context=await this.context();
    const album=context.albums.find(a=>a.id===id);
    if(!album) throw new ArtworkError('ARTWORK_ALBUM_NOT_FOUND');
    return {...context,album};
  }
  async search(id: string,artist?: string,title?: string,source:ArtworkSource='musicbrainz') {
    const context=await this.album(id);
    return this.session(async provider=>{
      const result=source==='itunes' ? await provider.itunesSearch(artist ?? context.album.artist,title ?? context.album.title)
        : await provider.search(artist ?? context.album.artist,title ?? context.album.title);
      return {candidates:result.candidates.slice(0,5)};
    });
  }
  async selection(id: string,action: 'preview'|'select'|'hide'|'automatic',groupId: string | undefined,userId: string) {
    const {source,album}=await this.album(id);
    return this.session(async (provider,token)=>{
      if(action==='hide' || action==='automatic') {
        await this.store.write(source,album.id,token,{status:action==='hide' ? 'hidden':'pending',manual:action==='hide',userId});
        return {status:action==='hide' ? 'hidden':'pending'};
      }
      if(!groupId) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
      const apple=groupId.startsWith('itunes:') ? await provider.itunesAlbum(groupId) : null;
      const candidate=apple ?? await provider.group(groupId);
      const cover=apple?.artwork ?? await provider.cover(groupId);
      if(!cover) throw new ArtworkError('ARTWORK_NOT_FOUND');
      const association=apple ? apple.artwork : {groupId,...cover};
      if(action==='select') await this.store.write(source,album.id,token,{status:'found',manual:true,...association,userId});
      return {candidate,artwork:{status:'found' as const,selection:'manual' as const,releaseGroupId:apple ? null : groupId,
        ...cover,checkedAt:new Date().toISOString(),nextAttemptAt:null}};
    });
  }
}
export function configuredArtworkService(context?: SeasonContext) {
  const pool=databasePool('sync');
  return new ArtworkService(new ArtworkStore((sql,params)=>pool.query(sql,params)), fetch, context);
}
