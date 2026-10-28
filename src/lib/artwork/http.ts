import 'server-only';
import { authClient, authConfigured } from '@/lib/auth';
import { sameOrigin, ownerAccess } from '@/lib/access';
import { ArtworkError } from './types';
const headers={'Cache-Control':'private, no-store, max-age=0'};
export async function artworkRequest(request: Request,handler: (userId: string)=>Promise<unknown>) {
  if(!sameOrigin(request.headers.get('origin'),process.env.APP_ORIGIN)) return Response.json({error:'ORIGIN_REJECTED'},{status:403,headers});
  if(!authConfigured()) return Response.json({error:'UNAUTHENTICATED'},{status:401,headers});
  const client=await authClient();
  const {data,error}=await client.auth.getUser();
  const access=ownerAccess(process.env.OWNER_USER_ID,error ? undefined : data.user?.id);
  if(access!=='allowed') return Response.json({error:access==='forbidden' ? 'FORBIDDEN':'UNAUTHENTICATED'},{status:access==='forbidden' ? 403:401,headers});
  try { return Response.json(await handler(data.user!.id),{headers}); }
  catch(cause) {
    const code=cause instanceof ArtworkError ? cause.code : 'ARTWORK_STORAGE_UNAVAILABLE';
    const status=code==='ARTWORK_ALBUM_NOT_FOUND' ? 404 : code==='ARTWORK_BUSY' || code==='ARTWORK_LEASE_LOST' ? 409
      : code==='ARTWORK_INVALID_REQUEST' ? 400 : code==='ARTWORK_NOT_FOUND' ? 422 : code.startsWith('ARTWORK_PROVIDER_') ? 502 : 503;
    return Response.json({error:code},{status,headers});
  }
}
export async function artworkBody(request: Request): Promise<Record<string,unknown>> {
  // No arbitrary URLs, folder IDs or large payloads are accepted by these routes.
  if(Number(request.headers.get('content-length') ?? 0)>2048) throw new ArtworkError('ARTWORK_INVALID_REQUEST');
  const reader=request.body?.getReader();
  if(!reader) return {};
  let length=0; const chunks: Uint8Array[]=[];
  try {
    for(;;) {const chunk=await reader.read(); if(chunk.done) break; length+=chunk.value.byteLength;
      if(length>2048) throw new ArtworkError('ARTWORK_INVALID_REQUEST'); chunks.push(chunk.value);}
    if(!length) return {};
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('invalid');
    return value;
  } catch { throw new ArtworkError('ARTWORK_INVALID_REQUEST'); }
  finally { await reader.cancel().catch(()=>{}); }
}
