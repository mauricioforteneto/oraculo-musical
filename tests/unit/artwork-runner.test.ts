import {describe,it,expect,vi} from 'vitest';
import {runArtworkSearch,waitForArtwork} from '../../src/lib/artwork/runner';
import {ArtworkRequestError,artworkPost} from '../../src/lib/artwork/messages';
import type {ArtworkBatch} from '../../src/lib/artwork/types';
const completed:ArtworkBatch={processed:1,remaining:0,paused:false,summary:{ready:true,total:1,found:1,missing:0,ambiguous:0,error:0,hidden:0,pending:0,due:0}};
function fixture(responses:(ArtworkBatch|Error)[],budgetMs=600000) {
  let clock=100000,stop=false;
  const request=vi.fn(async()=>{const result=responses.shift();if(result instanceof Error) throw result;if(!result) throw new Error('Unexpected request');return result;});
  const wait=vi.fn(async(ms:number)=>{clock+=ms;});
  const update=vi.fn(),feedback=vi.fn();
  return {request,wait,update,feedback,stop:()=>{stop=true;},run:()=>runArtworkSearch({request,wait,update,feedback,now:()=>clock,stopped:()=>stop,budgetMs})};
}
describe('retomada automática das capas',()=>{
  it('aguarda a data do servidor e retoma sem clique',async()=>{
    const f=fixture([{...completed,summary:{...completed.summary,found:0,error:1},nextRetryAt:new Date(130000).toISOString()},completed]);
    await f.run();expect(f.wait).toHaveBeenCalledWith(30100);expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.feedback).toHaveBeenLastCalledWith(expect.stringContaining('Busca concluída'));
  });
  it('respeita Retry-After e aumenta a espera de falhas consecutivas',async()=>{
    const f=fixture([new ArtworkRequestError('ARTWORK_BUSY',25000),new TypeError('network'),completed]);
    await f.run();expect(f.wait.mock.calls.map(([ms])=>ms)).toEqual([25000,10000]);expect(f.update).toHaveBeenCalledOnce();
  });
  it('para após o lote atual sem fazer o próximo pedido',async()=>{
    const f=fixture([{...completed,remaining:3}]);
    f.update.mockImplementation(()=>f.stop());await f.run();expect(f.request).toHaveBeenCalledOnce();expect(f.wait).not.toHaveBeenCalled();
  });
  it('permite parar durante a espera e limita a recuperação automática',async()=>{
    const f=fixture([{...completed,nextRetryAt:new Date(130000).toISOString()}]);
    f.wait.mockImplementation(async()=>{f.stop();throw new Error('stopped');});
    await f.run();expect(f.request).toHaveBeenCalledOnce();expect(f.feedback).toHaveBeenLastCalledWith(expect.stringContaining('Busca pausada'));
    const bounded=fixture([{...completed,nextRetryAt:new Date(900000).toISOString()}],600000);
    await bounded.run();expect(bounded.wait).not.toHaveBeenCalled();expect(bounded.feedback).toHaveBeenLastCalledWith(expect.stringContaining('retome mais tarde'));
  });
  it('não repete erros de autorização ou de migração',async()=>{
    for(const code of ['UNAUTHENTICATED','FORBIDDEN','ARTWORK_STORAGE_UPGRADE_REQUIRED']) {
      const f=fixture([new ArtworkRequestError(code)]);await expect(f.run()).rejects.toThrow(code);expect(f.wait).not.toHaveBeenCalled();
    }
  });
  it('evita repetição contínua quando o lote não avança',async()=>{
    const f=fixture([{...completed,processed:0,remaining:2},completed]);await f.run();expect(f.wait).toHaveBeenCalledWith(5000);
  });
  it('cancela a espera sem deixar um timer ativo',async()=>{
    vi.useFakeTimers();
    try {
      const controller=new AbortController();const waiting=waitForArtwork(30000,controller.signal);
      controller.abort();await expect(waiting).rejects.toBeDefined();expect(vi.getTimerCount()).toBe(0);
    } finally {vi.useRealTimers();}
  });
  it('carrega o intervalo de recuperação da resposta HTTP',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'ARTWORK_BUSY',retryAfterMs:25000},{status:409})));
    try {await expect(artworkPost('/synthetic',{})).rejects.toMatchObject({message:'ARTWORK_BUSY',retryAfterMs:25000});}
    finally {vi.unstubAllGlobals();}
  });
});
