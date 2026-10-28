import { artworkRequest, artworkBody } from '@/lib/artwork/http';
import { configuredArtworkService } from '@/lib/artwork/service';
import { ArtworkError, isUuid, type ArtworkSource } from '@/lib/artwork/types';
export const runtime='nodejs';
export async function POST(request: Request,{params}: {params:Promise<{id:string}>}) {
  return artworkRequest(request,async ()=>{
    const {id}=await params; if(!isUuid(id)) throw new ArtworkError('ARTWORK_ALBUM_NOT_FOUND');
    const body=await artworkBody(request);
    if(Object.keys(body).some(k=>!['artist','title','provider'].includes(k))) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    for(const value of Object.values(body)) if(typeof value!=='string' || !value.trim() || value.length>200) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    if(body.provider!==undefined && !['musicbrainz','itunes'].includes(String(body.provider))) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    return configuredArtworkService().search(id,body.artist as string|undefined,body.title as string|undefined,body.provider as ArtworkSource|undefined);
  });
}
