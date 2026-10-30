import { requestSeason } from "@/lib/seasons/context";
import { artworkRequest, artworkBody } from '@/lib/artwork/http';
import { configuredArtworkService } from '@/lib/artwork/service';
import { ArtworkError } from '@/lib/artwork/types';
export const runtime='nodejs';
export async function POST(request: Request) {
  return artworkRequest(request,async ()=>{
    if(Object.keys(await artworkBody(request)).length) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
    return configuredArtworkService(requestSeason(request)).batch();
  });
}
