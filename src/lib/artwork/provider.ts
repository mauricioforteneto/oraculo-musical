import 'server-only';
import { ArtworkError, artworkUrl, appleAlbumUrl, isUuid, isArtworkId, type ArtworkCandidate, type ArtworkDiagnostic, type ArtworkEndpoint } from './types';
export type ProviderDependencies = {
  fetch: typeof fetch; reserve: (endpoint: ArtworkEndpoint,maxWaitMs:number) => Promise<number>;
  defer: (milliseconds: number,endpoint: ArtworkEndpoint,failed?:boolean) => Promise<void>;
  succeeded?: (endpoint: ArtworkEndpoint)=>Promise<void>;
  now: () => number; sleep: (milliseconds: number) => Promise<void>; deadline: number;
};
const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en');
export function exactCandidate(candidates: ArtworkCandidate[], artist: string, title: string) {
  const exact = candidates.filter(c => normalize(c.artist) === normalize(artist) && normalize(c.title) === normalize(title));
  return exact.length === 1 ? exact[0] : null;
}
type Json = Record<string, unknown>;
function object(value: unknown): Json { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}; }
function candidate(value: unknown): ArtworkCandidate | null {
  const row=object(value); const credits=row['artist-credit'];
  if (typeof row.id !== 'string' || !isUuid(row.id) || typeof row.title !== 'string' || !Array.isArray(credits)) return null;
  const artist=credits.map(c => { const credit=object(c); return String(credit.name ?? object(credit.artist).name ?? '') + String(credit.joinphrase ?? ''); }).join('');
  if (!artist.trim()) return null;
  return {id:row.id,artist,title:row.title,year:typeof row['first-release-date'] === 'string' ? row['first-release-date'] : '',score:Number(row.score ?? 0)};
}
function retryDelay(response: Response, now: number) {
  const value=response.headers.get('retry-after');
  const delay=value && /^\d+$/.test(value) ? Number(value)*1000 : value ? Date.parse(value)-now : 2000;
  return Math.max(1100,Number.isFinite(delay) ? delay : 2000);
}
function providerFor(url: string): ArtworkDiagnostic['provider'] {
  const host=new URL(url).hostname;
  return host==='itunes.apple.com' ? 'ITUNES' : host==='musicbrainz.org' ? 'MUSICBRAINZ' : host==='coverartarchive.org' ? 'COVER_ART_ARCHIVE' : 'INTERNET_ARCHIVE';
}
function transportReason(error: unknown, signal: AbortSignal): ArtworkDiagnostic['reason'] {
  const row=object(error);
  if(signal.aborted || row.name==='AbortError' || row.name==='TimeoutError') return 'TIMEOUT';
  const code=String(object(row.cause).code ?? row.code ?? '');
  if(['ENOTFOUND','EAI_AGAIN'].includes(code)) return 'DNS';
  if(['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code)) return 'TLS';
  return 'NETWORK';
}
async function boundedJson(response: Response, provider: ArtworkDiagnostic['provider']) {
  const reader=response.body?.getReader();
  if (!reader) throw new ArtworkError('ARTWORK_PROVIDER_INVALID');
  const chunks: Uint8Array[]=[]; let length=0;
  try {
    for (;;) { const part=await reader.read(); if(part.done) break; length+=part.value.byteLength;
      if(length>512_000) throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider,reason:'BODY_TOO_LARGE'}); chunks.push(part.value); }
    return object(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch (error) { if(error instanceof SyntaxError) throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider,reason:'INVALID_RESPONSE'}); throw error; }
  finally { await reader.cancel().catch(()=>{}); }
}
export class ArtworkProvider {
  constructor(private readonly deps: ProviderDependencies) {}
  private async json(initial: string): Promise<Json | null> {
    let url=initial, redirects=0,retries=0;
    const endpoint=providerFor(initial) as ArtworkEndpoint;
    for (;;) {
      const delay=await this.deps.reserve(endpoint,Math.max(0,this.deps.deadline-this.deps.now()-100));
      if (this.deps.now()+delay+100>=this.deps.deadline) throw new ArtworkError('ARTWORK_COOLDOWN',delay,{provider:endpoint,reason:'COOLDOWN'});
      if(delay>0) await this.deps.sleep(delay);
      const remaining=this.deps.deadline-this.deps.now();
      const provider=providerFor(url);
      const signal=AbortSignal.timeout(Math.max(1,Math.min(8000,remaining)));
      try {
        const response=await this.deps.fetch(url,{redirect:'manual',cache:'no-store',signal,headers:{Accept:'application/json','User-Agent':'OraculoMusical/0.1 (+https://github.com/mauricioforteneto/oraculo-musical)'}});
        if ([301,302,303,307,308].includes(response.status)) {
          const location=response.headers.get('location'); await response.body?.cancel();
          if(!location || ++redirects>3) throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider,reason:'REDIRECT_REJECTED'});
          let next: URL;
          try {next=new URL(location,url);} catch {throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider,reason:'REDIRECT_REJECTED'});}
          const allowed=endpoint==='ITUNES'
            ? next.protocol==='https:' && next.hostname==='itunes.apple.com' && ['/search','/lookup'].includes(next.pathname)
            : endpoint==='MUSICBRAINZ'
              ? next.protocol==='https:' && next.hostname==='musicbrainz.org' && next.pathname.startsWith('/ws/2/')
              : next.hostname==='coverartarchive.org' || next.hostname==='archive.org' || next.hostname.endsWith('.archive.org') ? artworkUrl(next.href) : null;
          if(!allowed || next.username || next.password || next.port) throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider,reason:'REDIRECT_REJECTED'});
          next.protocol='https:'; url=next.href; continue;
        }
        if(response.status===404) { await response.body?.cancel(); await this.deps.succeeded?.(endpoint); return null; }
        if(response.status===429 || response.status>=500) {
          const wait=retryDelay(response,this.deps.now()); await response.body?.cancel(); await this.deps.defer(wait,endpoint);
          if (++retries<2 && this.deps.now()+wait+200<this.deps.deadline) continue;
          throw new ArtworkError('ARTWORK_PROVIDER_UNAVAILABLE',wait,{provider,reason:'HTTP',httpStatus:response.status});
        }
        if(!response.ok) { await response.body?.cancel(); throw new ArtworkError('ARTWORK_PROVIDER_UNAVAILABLE',0,{provider,reason:'HTTP',httpStatus:response.status}); }
        const result=await boundedJson(response,provider);
        await this.deps.succeeded?.(endpoint);
        return result;
      } catch(error) {
        if(error instanceof ArtworkError) {
          if(error.code.startsWith('ARTWORK_PROVIDER_')) await this.deps.defer(error.retryAfterMs,endpoint,true);
          if(error.code==='ARTWORK_PROVIDER_INVALID' && !error.diagnostic) throw new ArtworkError(error.code,error.retryAfterMs,{provider,reason:'INVALID_RESPONSE'});
          throw error;
        }
        await this.deps.defer(0,endpoint,true);
        throw new ArtworkError('ARTWORK_PROVIDER_UNAVAILABLE',0,{provider,reason:transportReason(error,signal)});
      }
    }
  }
  async search(artist: string,title: string) {
    const quote=(v: string)=>'"'+v.replace(/[\\"]/g,'\\$&')+'"';
    const params=new URLSearchParams({query:`releasegroup:${quote(title)} AND artist:${quote(artist)}`,fmt:'json',limit:'20'});
    const result=await this.json(`https://musicbrainz.org/ws/2/release-group/?${params}`);
    const rows=result?.['release-groups'];
    if(!Array.isArray(rows)) { if(result===null) return {candidates:[],complete:true}; throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider:'MUSICBRAINZ',reason:'INVALID_RESPONSE'}); }
    const candidates=rows.map(candidate).filter((v): v is ArtworkCandidate=>v!==null);
    const unique=[...new Map(candidates.map(c=>[c.id,c])).values()];
    // Never auto-select a result from a truncated search response.
    const count=Number(result?.count);
    return {candidates:unique,complete:Number.isSafeInteger(count) && count>=unique.length && count<=20};
  }
  async group(id: string) {
    if(!isUuid(id)) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    const result=await this.json(`https://musicbrainz.org/ws/2/release-group/${id}?inc=artists&fmt=json`);
    const found=candidate(result);
    if(!found) throw new ArtworkError('ARTWORK_NOT_FOUND');
    if(found.id.toLowerCase()!==id.toLowerCase()) throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider:'MUSICBRAINZ',reason:'INVALID_RESPONSE'});
    return found;
  }
  async cover(id: string) {
    const result=await this.json(`https://coverartarchive.org/release-group/${id}`);
    if(result===null) return null;
    if(!Array.isArray(result.images)) throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider:'COVER_ART_ARCHIVE',reason:'INVALID_RESPONSE'});
    for(const value of result.images) {
      const image=object(value); if(image.front!==true || image.approved!==true) continue;
      const thumbnails=object(image.thumbnails);
      const thumbnailUrl=artworkUrl(thumbnails['250'] ?? thumbnails.small);
      const imageUrl=artworkUrl(thumbnails['500'] ?? thumbnails.large ?? image.image);
      if(thumbnailUrl && imageUrl) return {thumbnailUrl,imageUrl};
    }
    return null;
  }
  async itunesSearch(artist: string,title: string) {
    const params=new URLSearchParams({term:`${artist} ${title}`,entity:'album',media:'music',country:'BR',limit:'20'});
    const result=await this.json(`https://itunes.apple.com/search?${params}`);
    return this.itunesResults(result);
  }
  async itunesAlbum(id: string) {
    if(!/^itunes:[1-9][0-9]{0,14}$/.test(id)) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    const params=new URLSearchParams({id:id.slice(7),entity:'album',country:'BR'});
    const result=this.itunesResults(await this.json(`https://itunes.apple.com/lookup?${params}`));
    const album=result.candidates.find(c=>c.id===id);
    if(!album) throw new ArtworkError('ARTWORK_NOT_FOUND');
    return album;
  }
  private itunesResults(result: Json | null) {
    if(!result || !Array.isArray(result.results) || !Number.isSafeInteger(result.resultCount) || result.resultCount!==result.results.length)
      throw new ArtworkError('ARTWORK_PROVIDER_INVALID',0,{provider:'ITUNES',reason:'INVALID_RESPONSE'});
    const candidates=result.results.flatMap(value=>{
      const row=object(value);
      if(row.wrapperType!=='collection' || row.collectionType!=='Album' || !Number.isSafeInteger(row.collectionId) || !isArtworkId(`itunes:${row.collectionId}`) || typeof row.artistName!=='string' || !row.artistName.trim() || typeof row.collectionName!=='string' || !row.collectionName.trim()) return [];
      const thumbnailUrl=artworkUrl(row.artworkUrl100);
      const providerUrl=appleAlbumUrl(row.collectionViewUrl);
      if(!thumbnailUrl || !/^https:\/\/is[1-9][0-9]*-ssl\.mzstatic\.com\//.test(thumbnailUrl) || !providerUrl) return [];
      return [{id:`itunes:${row.collectionId}`,provider:'itunes' as const,artist:row.artistName,title:row.collectionName,
        year:typeof row.releaseDate==='string' ? row.releaseDate.slice(0,4) : '',score:0,
        artwork:{thumbnailUrl,imageUrl:thumbnailUrl,providerUrl,itunesCollectionId:String(row.collectionId),provider:'itunes' as const}}];
    });
    return {candidates:[...new Map(candidates.map(c=>[c.id,c])).values()],complete:Number(result.resultCount)<20};
  }
}
