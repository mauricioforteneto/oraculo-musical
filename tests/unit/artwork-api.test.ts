import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const deps=vi.hoisted(()=>({configured:vi.fn(),user:vi.fn(),factory:vi.fn(),batch:vi.fn(),search:vi.fn(),selection:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth',()=>({authConfigured:deps.configured,authClient:async()=>({auth:{getUser:deps.user}})}));
vi.mock('@/lib/artwork/service',()=>({configuredArtworkService:deps.factory}));
import {POST as batch} from '../../src/app/api/artwork/batch/route';
import {POST as search} from '../../src/app/api/artwork/[id]/search/route';
import {POST as selection} from '../../src/app/api/artwork/[id]/selection/route';
import {ArtworkError} from '../../src/lib/artwork/types';
const id='00000000-0000-4000-8000-000000000001';
const request=(body:unknown={},origin='https://oraculo.example')=>new Request('https://oraculo.example/api/artwork',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv('APP_ORIGIN','https://oraculo.example');vi.stubEnv('OWNER_USER_ID','owner');
  deps.configured.mockReturnValue(true);deps.user.mockResolvedValue({data:{user:{id:'owner'}},error:null});
  deps.factory.mockReturnValue({batch:deps.batch,search:deps.search,selection:deps.selection});
  deps.batch.mockResolvedValue({processed:1});deps.search.mockResolvedValue({candidates:[]});deps.selection.mockResolvedValue({status:'hidden'});
});
afterEach(()=>vi.unstubAllEnvs());
describe('endpoints privados de capas',()=>{
  for(const [name,call] of [['lote',(r:Request)=>batch(r)],['pesquisa',(r:Request)=>search(r,{params:Promise.resolve({id})})],['seleção',(r:Request)=>selection(r,{params:Promise.resolve({id})})]] as const) {
    it(`rejeita origem e sessão antes do serviço: ${name}`,async()=>{
      expect((await call(request({},'https://foreign.example'))).status).toBe(403);expect(deps.user).not.toHaveBeenCalled();
      deps.user.mockResolvedValue({data:{user:null},error:null});expect((await call(request())).status).toBe(401);
      deps.user.mockResolvedValue({data:{user:{id:'other'}},error:null});expect((await call(request())).status).toBe(403);
      expect(deps.factory).not.toHaveBeenCalled();
    });
  }
  it('encaminha apenas identificação e ator autenticado, sem aceitar URLs ou fonte',async()=>{
    expect((await batch(request({folderId:'foreign'}))).status).toBe(400);
    expect((await search(request({url:'https://foreign.example'}),{params:Promise.resolve({id})})).status).toBe(400);
    expect((await selection(request({action:'select',groupId:id,url:'https://foreign.example'}),{params:Promise.resolve({id})})).status).toBe(400);
    expect((await selection(request({action:['hide']}),{params:Promise.resolve({id})})).status).toBe(400);
    const response=await selection(request({action:'select',groupId:id}),{params:Promise.resolve({id})});
    expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
    expect(deps.selection).toHaveBeenCalledWith(id,'select',id,'owner');
    await search(request({artist:'Outro crédito',title:'Outro título'}),{params:Promise.resolve({id})});
    expect(deps.search).toHaveBeenCalledWith(id,'Outro crédito','Outro título',undefined);
  });
  it('aceita apenas namespaces conhecidos e o provedor explícito da busca',async()=>{
    const response=await selection(request({action:'select',groupId:'itunes:123'}),{params:Promise.resolve({id})});
    expect(response.status).toBe(200);expect(deps.selection).toHaveBeenCalledWith(id,'select','itunes:123','owner');
    expect((await selection(request({action:'select',groupId:'itunes:https://evil.example'}),{params:Promise.resolve({id})})).status).toBe(400);
    await search(request({provider:'itunes',artist:'Banda',title:'Disco'}),{params:Promise.resolve({id})});
    expect(deps.search).toHaveBeenCalledWith(id,'Banda','Disco','itunes');
    expect((await search(request({provider:'other'}),{params:Promise.resolve({id})})).status).toBe(400);
  });
  it('rejeita corpo excessivo e UUID inválido',async()=>{
    expect((await search(request({artist:'a'.repeat(2050)}),{params:Promise.resolve({id})})).status).toBe(400);
    expect((await search(request(),{params:Promise.resolve({id:'invalid'})})).status).toBe(404);
    expect(deps.factory).not.toHaveBeenCalled();
  });
  it('retorna erro acionável sem expor exceção interna',async()=>{
    deps.batch.mockRejectedValue(new Error('secret database url'));
    const response=await batch(request());expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret');
    deps.batch.mockRejectedValue(new ArtworkError('ARTWORK_PROVIDER_UNAVAILABLE',0,{provider:'COVER_ART_ARCHIVE',reason:'HTTP',httpStatus:403}));
    const detailed=await batch(request());expect(detailed.status).toBe(502);
    expect(await detailed.json()).toEqual({error:'ARTWORK_PROVIDER_UNAVAILABLE:COVER_ART_ARCHIVE:HTTP_403'});
    deps.batch.mockRejectedValue(new ArtworkError('ARTWORK_BUSY'));expect((await batch(request())).status).toBe(409);
    deps.search.mockRejectedValue(new ArtworkError('ARTWORK_ALBUM_NOT_FOUND'));expect((await search(request(),{params:Promise.resolve({id})})).status).toBe(404);
  });
});
