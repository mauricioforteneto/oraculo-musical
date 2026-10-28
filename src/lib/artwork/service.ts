import 'server-only';
import { databasePool } from '@/lib/db/pool';
import { ArtworkStore, readArtwork, type ArtworkAlbum } from './database';
import { ArtworkProvider, exactCandidate } from './provider';
import { ArtworkError, summaryFor, type ArtworkBatch } from './types';

export class ArtworkService {
  constructor(private readonly store: ArtworkStore, private readonly fetcher: typeof fetch = fetch) {}
  private async context() {
    const season=Number(process.env.SOURCE_SEASON ?? '2026');
    const folder=process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';
    if(!Number.isInteger(season) || !folder) throw new ArtworkError('SOURCE_NOT_CONFIGURED');
    const source=await this.store.source(season,folder);
    return {source,albums:await this.store.albums(source)};
  }
  private async session<T>(callback: (provider: ArtworkProvider,token: string,deadline: number)=>Promise<T>) {
    const token=await this.store.acquire();
    const deadline=Date.now()+20_000;
    const provider=new ArtworkProvider({fetch:this.fetcher,deadline,now:Date.now,
      sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),reserve:()=>this.store.reserveRequest(token),defer:ms=>this.store.defer(token,ms)});
    try { return await callback(provider,token,deadline); }
    finally { await this.store.release(token); }
  }
  private async records(source: string) {
    const result=await readArtwork(this.store.query,source);
    if(!result.ready) throw new ArtworkError('ARTWORK_STORAGE_UNAVAILABLE');
    return result.records;
  }
  async batch(): Promise<ArtworkBatch> {
    const {source,albums}=await this.context();
    return this.session(async (provider,token,deadline)=>{
      const records=await this.records(source);
      const due=(album: ArtworkAlbum)=>summaryFor([{albumId:album.id,isPresent:album.isPresent}],records,true).due>0;
      const pending=albums.filter(due).slice(0,5);
      let processed=0,paused=false,errorCode: string | undefined;
      for(const album of pending) {
        if(Date.now()+200>=deadline) break;
        try {
          const search=await provider.search(album.artist,album.title);
          const match=search.complete ? exactCandidate(search.candidates,album.artist,album.title) : null;
          if(!match) {
            const status=search.candidates.length ? 'ambiguous':'missing';
            await this.store.write(source,album.id,token,{status,nextAttemptAt:status==='missing' ? new Date(Date.now()+7*86400_000).toISOString() : undefined});
          } else {
            const cover=await provider.cover(match.id);
            await this.store.write(source,album.id,token,cover ? {status:'found',groupId:match.id,...cover} : {status:'missing',groupId:match.id,nextAttemptAt:new Date(Date.now()+7*86400_000).toISOString()});
          }
          processed++;
        } catch(error) {
          if(error instanceof ArtworkError && error.code==='ARTWORK_BUDGET') {
            if(processed===0) {paused=true;errorCode='ARTWORK_RATE_LIMIT';}
            break;
          }
          if(!(error instanceof ArtworkError) || !error.code.startsWith('ARTWORK_PROVIDER_')) throw error;
          await this.store.write(source,album.id,token,{status:'error',errorCode:error.code,nextAttemptAt:new Date(Date.now()+30*60_000).toISOString()});
          processed++; paused=true; errorCode=error.code; break;
        }
      }
      const updated=await this.records(source);
      const summary=summaryFor(albums.map(a=>({albumId:a.id,isPresent:a.isPresent})),updated,true);
      return {processed,remaining:summary.due,summary,paused,error:errorCode};
    });
  }
  private async album(id: string) {
    const context=await this.context();
    const album=context.albums.find(a=>a.id===id);
    if(!album) throw new ArtworkError('ARTWORK_ALBUM_NOT_FOUND');
    return {...context,album};
  }
  async search(id: string,artist?: string,title?: string) {
    const context=await this.album(id);
    return this.session(async provider=>{
      const result=await provider.search(artist ?? context.album.artist,title ?? context.album.title);
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
      const candidate=await provider.group(groupId);
      const cover=await provider.cover(groupId);
      if(!cover) throw new ArtworkError('ARTWORK_NOT_FOUND');
      if(action==='select') await this.store.write(source,album.id,token,{status:'found',manual:true,groupId,...cover,userId});
      return {candidate,artwork:{status:'found' as const,selection:'manual' as const,releaseGroupId:groupId,...cover,checkedAt:new Date().toISOString(),nextAttemptAt:null}};
    });
  }
}
export function configuredArtworkService() {
  const pool=databasePool('sync');
  return new ArtworkService(new ArtworkStore((sql,params)=>pool.query(sql,params)));
}
