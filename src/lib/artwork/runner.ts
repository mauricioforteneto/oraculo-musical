import type { ArtworkBatch } from './types';
import { ArtworkRequestError } from './messages';

type RunnerOptions={
  request:()=>Promise<ArtworkBatch>; update:(batch:ArtworkBatch)=>void; feedback:(message:string)=>void;
  stopped:()=>boolean; wait:(ms:number)=>Promise<void>; now?:()=>number; budgetMs?:number;
};
export async function runArtworkSearch(options:RunnerOptions) {
  const now=options.now ?? Date.now;
  const deadline=now()+(options.budgetMs ?? 10*60_000);
  let failures=0;
  const stopped=()=>{options.feedback('Busca pausada. O progresso foi salvo; você pode retomar depois.');};
  async function wait(ms:number) {
    if(now()+ms>deadline) {
      options.feedback('As tentativas automáticas desta busca terminaram. O progresso foi salvo; retome mais tarde para tentar as falhas restantes.');
      return false;
    }
    options.feedback(`Aguardando o serviço. Nova tentativa automática às ${new Date(now()+ms).toLocaleTimeString('pt-BR')}. Você pode parar a busca.`);
    try {await options.wait(ms);} catch(error) {if(!options.stopped()) throw error;}
    if(options.stopped()) {stopped();return false;}
    return true;
  }
  for(;;) {
    if(options.stopped()) {stopped();return;}
    if(now()>=deadline) {options.feedback('O progresso foi salvo. Retome a busca para continuar.');return;}
    let result:ArtworkBatch;
    try {result=await options.request();failures=0;}
    catch(error) {
      if(options.stopped()) {stopped();return;}
      const recoverable=error instanceof TypeError || (error instanceof ArtworkRequestError &&
        /^(ARTWORK_BUSY|ARTWORK_LEASE_LOST|ARTWORK_RATE_LIMIT|ARTWORK_BUDGET|ARTWORK_COOLDOWN|ARTWORK_PROVIDER_UNAVAILABLE)(:|$)/.test(error.message));
      if(!recoverable) throw error;
      const delay=Math.max(error instanceof ArtworkRequestError ? error.retryAfterMs : 0,Math.min(120_000,5000*2**Math.min(failures++,5)));
      if(!await wait(delay)) return;
      continue;
    }
    options.update(result);
    if(options.stopped()) {stopped();return;}
    if(result.remaining>0 && !result.paused && result.processed>0) {
      options.feedback(`${result.summary.found} de ${result.summary.total} álbuns com capa. Buscando o próximo lote…`);
      continue;
    }
    if(result.nextRetryAt || result.paused || (result.remaining>0 && result.processed===0)) {
      const retry=result.nextRetryAt ? Date.parse(result.nextRetryAt)-now()+100 : 5000;
      if(!await wait(Math.max(1000,Number.isFinite(retry) ? retry : 5000))) return;
      continue;
    }
    options.feedback('Busca concluída. Casos sem capa ou com correspondência duvidosa podem ser revisados no detalhe do álbum.');
    return;
  }
}

export function waitForArtwork(ms:number,signal:AbortSignal) {
  return new Promise<void>((resolve,reject)=>{
    if(signal.aborted) {reject(signal.reason);return;}
    const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
    signal.addEventListener('abort',cancel,{once:true});
  });
}
