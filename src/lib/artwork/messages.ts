export function artworkMessage(code: string) {
  if(code==='ARTWORK_BUSY' || code==='ARTWORK_LEASE_LOST') return 'Outra busca de capas está em andamento. Tente novamente em instantes.';
  if(code==='ARTWORK_NOT_FOUND') return 'Este lançamento não tem uma capa frontal disponível. Tente outro candidato.';
  if(code==='ARTWORK_RATE_LIMIT' || code==='ARTWORK_BUDGET') return 'A busca foi pausada para respeitar o limite do serviço. Retome em alguns instantes.';
  if(code==='ARTWORK_ALBUM_NOT_FOUND') return 'Este álbum não está disponível na fonte configurada.';
  if(code==='ARTWORK_STORAGE_UNAVAILABLE') return 'A busca de capas ainda precisa da configuração de armazenamento.';
  if(code==='UNAUTHENTICATED' || code==='FORBIDDEN') return 'Sua sessão não permite esta operação. Entre novamente no Oráculo.';
  if(code==='ARTWORK_INVALID_REQUEST') return 'Confira os campos da busca e tente novamente.';
  return 'O serviço de capas está indisponível neste momento. O progresso salvo permanece preservado.';
}
export async function artworkPost<T>(url:string,body:Record<string,unknown>,signal?:AbortSignal):Promise<T> {
  const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const result=await response.json();
  if(!response.ok) throw new Error(typeof result.error==='string' ? result.error : 'ARTWORK_PROVIDER_UNAVAILABLE');
  return result as T;
}
