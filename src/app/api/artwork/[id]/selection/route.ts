import { requestSeason } from "@/lib/seasons/context";
import { artworkRequest, artworkBody } from '@/lib/artwork/http';
import { configuredArtworkService } from '@/lib/artwork/service';
import { ArtworkError, isUuid, isArtworkId } from '@/lib/artwork/types';
export const runtime='nodejs';
export async function POST(request: Request,{params}: {params:Promise<{id:string}>}) {
  return artworkRequest(request,async userId=>{
    const {id}=await params; if(!isUuid(id)) throw new ArtworkError('ARTWORK_ALBUM_NOT_FOUND');
    const body=await artworkBody(request);
    const action=body.action;
    if(typeof action!=='string' || Object.keys(body).some(k=>!['action','groupId'].includes(k)) || !['preview','select','hide','automatic'].includes(String(action))) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    if((action==='preview' || action==='select') && (typeof body.groupId!=='string' || !isArtworkId(body.groupId))) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    if((action==='hide' || action==='automatic') && body.groupId!==undefined) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    return configuredArtworkService(requestSeason(request)).selection(id,action as 'preview'|'select'|'hide'|'automatic',body.groupId as string|undefined,userId);
  });
}
