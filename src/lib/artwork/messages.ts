export function artworkMessage(code: string) {
  const [category,provider,reason]=code.split(':');
  const label=provider==='ITUNES' ? 'iTunes' : provider==='MUSICBRAINZ' ? 'MusicBrainz' : provider==='COVER_ART_ARCHIVE' ? 'Cover Art Archive' : provider==='INTERNET_ARCHIVE' ? 'Internet Archive' : null;
  if(label && ['ARTWORK_PROVIDER_UNAVAILABLE','ARTWORK_PROVIDER_INVALID'].includes(category)) {
    const suffix=' O progresso salvo permanece preservado.';
    if(reason==='TIMEOUT') return `${label} não respondeu a tempo.${suffix}`;
    if(reason==='DNS') return `Não foi possível localizar ${label} na rede.${suffix}`;
    if(reason==='TLS') return `Não foi possível verificar a conexão segura com ${label}.${suffix}`;
    if(reason==='NETWORK') return `A conexão com ${label} falhou.${suffix}`;
    if(reason==='HTTP_429') return `${label} limitou as consultas (HTTP 429). Aguarde antes de retomar.${suffix}`;
    if(/^HTTP_[45][0-9]{2}$/.test(reason ?? '')) return `${label} respondeu com erro HTTP ${reason.slice(5)}.${suffix}`;
    if(['INVALID_RESPONSE','BODY_TOO_LARGE','REDIRECT_REJECTED'].includes(reason)) return `${label} retornou uma resposta que o aplicativo não pôde utilizar.${suffix}`;
  }
  if(code==='ARTWORK_BUSY' || code==='ARTWORK_LEASE_LOST') return 'Outra busca de capas está em andamento. Tente novamente em instantes.';
  if(code==='ARTWORK_NOT_FOUND') return 'Este lançamento não tem uma capa frontal disponível. Tente outro candidato.';
  if(code==='ARTWORK_RATE_LIMIT' || code==='ARTWORK_BUDGET') return 'A busca foi pausada para respeitar o limite do serviço. Retome em alguns instantes.';
  if(code==='ARTWORK_ALBUM_NOT_FOUND') return 'Este álbum não está disponível na fonte configurada.';
  if(code==='ARTWORK_STORAGE_UNAVAILABLE') return 'A busca de capas ainda precisa da configuração de armazenamento.';
  if(code==='ARTWORK_STORAGE_UPGRADE_REQUIRED') return 'As capas salvas estão preservadas. A busca com iTunes precisa da migração 0007 no banco.';
  if(category==='ARTWORK_COOLDOWN') return 'Este serviço está aguardando o intervalo para uma nova tentativa.';
  if(code==='UNAUTHENTICATED' || code==='FORBIDDEN') return 'Sua sessão não permite esta operação. Entre novamente no Oráculo.';
  if(code==='ARTWORK_INVALID_REQUEST') return 'Confira os campos da busca e tente novamente.';
  return 'O serviço de capas está indisponível neste momento. O progresso salvo permanece preservado.';
}
export class ArtworkRequestError extends Error {
  constructor(code:string,public readonly retryAfterMs=0) {super(code);}
}
export async function artworkPost<T>(url:string,body:Record<string,unknown>,signal?:AbortSignal):Promise<T> {
  const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const result=await response.json();
  if(!response.ok) throw new ArtworkRequestError(typeof result.error==='string' ? result.error : 'ARTWORK_PROVIDER_UNAVAILABLE',
    Number.isFinite(result.retryAfterMs) && result.retryAfterMs>0 ? result.retryAfterMs : 0);
  return result as T;
}
