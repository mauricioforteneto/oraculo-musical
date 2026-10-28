import { describe,expect,it,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { ArtworkProvider,exactCandidate } from '../../src/lib/artwork/provider';
import { artworkUrl,summaryFor,artworkErrorCode,type ArtworkError,type AlbumArtwork } from '../../src/lib/artwork/types';
const id='00000000-0000-4000-8000-000000000001';
const row={id,title:'Disco',score:100,'artist-credit':[{name:'Banda',joinphrase:''}]};
const candidate={id,title:'Disco',artist:'Banda',year:'',score:100};
function fixture(responses: Response[]) {
  let now=1000,wait=0;
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async ()=>{const response=responses.shift();if(!response) throw new Error('No synthetic response');return response;});
  const reserve=vi.fn(async ()=>{const value=wait;wait=0;return value;});
  const defer=vi.fn(async(ms:number)=>{wait=ms;});
  const provider=new ArtworkProvider({fetch:fetcher,reserve,defer,now:()=>now,sleep:async ms=>{now+=ms;},deadline:21000});
  return {provider,fetcher,reserve,defer};
}
const cover=()=>Response.json({images:[{front:true,approved:true,image:'http://archive.org/download/synthetic/original.jpg',thumbnails:{250:'http://archive.org/download/synthetic/250.jpg',500:'http://archive.org/download/synthetic/500.jpg'}}]});
describe('provedores de capas',()=>{
  it('normaliza caixa, espaços e Unicode sem remover edições ou colaborações',()=>{
    expect(exactCandidate([{...candidate,artist:'Bjo\u0308rk'}],'Björk',' disco ')).toBeDefined();
    expect(exactCandidate([candidate],'Banda','Disco (Deluxe)')).toBeNull();
    expect(exactCandidate([candidate],'Banda & Outra Banda','Disco')).toBeNull();
    expect(exactCandidate([candidate,{...candidate,id:id.replace(/1$/,'2')}],'Banda','Disco')).toBeNull();
  });
  it('consulta a API com termos escapados, identificação e limite explícito',async()=>{
    const f=fixture([Response.json({count:1,'release-groups':[row]})]);
    expect(await f.provider.search('Banda "A"','Disco\\Live')).toEqual({candidates:[candidate],complete:true});
    const [url,options]=f.fetcher.mock.calls[0];
    const query=new URL(String(url)).searchParams;
    expect(query.get('query')).toBe('releasegroup:"Disco\\\\Live" AND artist:"Banda \\"A\\""');
    expect(query.get('limit')).toBe('20');expect(options?.headers).toMatchObject({'User-Agent':expect.stringContaining('OraculoMusical')});
  });
  it('sinaliza pesquisa truncada e evita deduplicação indevida de grupos distintos',async()=>{
    const f=fixture([Response.json({count:21,'release-groups':[row,row,{...row,id:id.replace(/1$/,'2')}]})]);
    const result=await f.provider.search('Banda','Disco');
    expect(result.complete).toBe(false);expect(result.candidates).toHaveLength(2);
  });
  it('usa artistas na consulta do grupo e miniaturas frontais aprovadas em HTTPS',async()=>{
    const f=fixture([Response.json(row),cover()]);
    expect((await f.provider.group(id)).artist).toBe('Banda');
    expect(String(f.fetcher.mock.calls[0][0])).toContain('inc=artists');
    expect(await f.provider.cover(id)).toEqual({thumbnailUrl:'https://archive.org/download/synthetic/250.jpg',imageUrl:'https://archive.org/download/synthetic/500.jpg'});
  });
  it('distingue inexistência de imagem e rejeita payload inválido',async()=>{
    const f=fixture([new Response(null,{status:404}),Response.json({images:[{front:false,approved:true}]}),Response.json({unexpected:true})]);
    expect(await f.provider.cover(id)).toBeNull();expect(await f.provider.cover(id)).toBeNull();
    await expect(f.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_INVALID'});
  });
  it('segue redirecionamento apenas para hosts dos provedores',async()=>{
    const f=fixture([new Response(null,{status:307,headers:{location:'http://archive.org/download/synthetic/index.json'}}),cover()]);
    expect(await f.provider.cover(id)).not.toBeNull();
    expect(String(f.fetcher.mock.calls[1][0])).toMatch(/^https:\/\/archive.org\//);
    const blocked=fixture([new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})]);
    await expect(blocked.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_INVALID'});
    expect(blocked.fetcher).toHaveBeenCalledOnce();
  });
  it('respeita Retry-After sem repetir indefinidamente',async()=>{
    const f=fixture([new Response(null,{status:429,headers:{'retry-after':'2'}}),cover()]);
    expect(await f.provider.cover(id)).not.toBeNull();expect(f.defer).toHaveBeenCalledWith(2000,'COVER_ART_ARCHIVE');expect(f.fetcher).toHaveBeenCalledTimes(2);
    const exhausted=fixture([new Response(null,{status:503}),new Response(null,{status:503})]);
    await expect(exhausted.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_UNAVAILABLE'});
    expect(exhausted.fetcher).toHaveBeenCalledTimes(2);
  });
  it('não espera além do orçamento nem baixa JSON excessivo',async()=>{
    const delayed=fixture([new Response(null,{status:429,headers:{'retry-after':'3600'}})]);
    await expect(delayed.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_UNAVAILABLE',retryAfterMs:3600000});
    expect(delayed.fetcher).toHaveBeenCalledOnce();
    const large=fixture([Response.json({extra:'x'.repeat(512001)})]);
    await expect(large.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_INVALID'});
    const budget=fixture([]);budget.reserve.mockResolvedValue(30000);
    await expect(budget.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_COOLDOWN'});expect(budget.fetcher).not.toHaveBeenCalled();
  });
});
describe('cache e URLs de capas',()=>{
  it('não aceita credenciais, portas, protocolos ou hosts externos nas imagens',()=>{
    for(const url of ['javascript:alert(1)','https://archive.org.evil.example/a','https://user@archive.org/a','https://archive.org:444/a','http://localhost/a']) expect(artworkUrl(url)).toBeNull();
    expect(artworkUrl('http://coverartarchive.org/release/id/front-250')).toBe('https://coverartarchive.org/release/id/front-250');
  });
  it('preserva escolhas manuais e negativos recentes; reprocessa apenas pendências vencidas',()=>{
    const now=Date.now();
    const record=(status:AlbumArtwork['status'],extra:Partial<AlbumArtwork>={}):AlbumArtwork=>({status,selection:'automatic',releaseGroupId:null,thumbnailUrl:null,imageUrl:null,checkedAt:'',nextAttemptAt:null,...extra});
    const records=new Map([
      ['found',record('found')],['hidden',record('hidden',{selection:'manual'})],['ambiguous',record('ambiguous')],
      ['missing',record('missing',{fallbackCheckedAt:new Date(now).toISOString(),nextAttemptAt:new Date(now+1000).toISOString()})],['retry',record('error',{nextAttemptAt:new Date(now-1000).toISOString()})],
      ['absent',record('pending')],
    ]);
    const albums=[...records.keys(),'new'].map(albumId=>({albumId,isPresent:albumId!=='absent'}));
    expect(summaryFor(albums,records,true,now)).toEqual({ready:true,total:6,found:1,hidden:1,ambiguous:1,missing:1,error:1,pending:1,due:2});
  });
});


describe('diagnóstico das falhas externas',()=>{
  it('preserva o serviço e o status HTTP sem alterar a classificação do erro',async()=>{
    const f=fixture([new Response(null,{status:429,headers:{'retry-after':'3600'}})]);
    try {await f.provider.search('Banda','Disco');expect.unreachable();}
    catch(error) {
      expect(error).toMatchObject({code:'ARTWORK_PROVIDER_UNAVAILABLE',diagnostic:{provider:'MUSICBRAINZ',reason:'HTTP',httpStatus:429}});
      expect(artworkErrorCode(error as ArtworkError)).toBe('ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:HTTP_429');
    }
  });
  for(const [reason,cause] of [
    ['TIMEOUT',new DOMException('sensitive timeout detail','TimeoutError')],
    ['DNS',new TypeError('sensitive network detail',{cause:{code:'ENOTFOUND'}})],
    ['TLS',new TypeError('sensitive certificate detail',{cause:{code:'CERT_HAS_EXPIRED'}})],
    ['NETWORK',new TypeError('sensitive url detail')],
  ] as const) {
    it(`distingue ${reason} sem expor a exceção original`,async()=>{
      const f=fixture([]);f.fetcher.mockRejectedValue(cause);
      try {await f.provider.cover(id);expect.unreachable();}
      catch(error) {
        expect(error).toMatchObject({code:'ARTWORK_PROVIDER_UNAVAILABLE',diagnostic:{provider:'COVER_ART_ARCHIVE',reason}});
        expect(artworkErrorCode(error as ArtworkError)).not.toContain('sensitive');
      }
    });
  }
  it('identifica Internet Archive após redirecionamento',async()=>{
    const f=fixture([new Response(null,{status:307,headers:{location:'https://archive.org/download/synthetic/index.json'}}),new Response(null,{status:503,headers:{'retry-after':'3600'}})]);
    await expect(f.provider.cover(id)).rejects.toMatchObject({diagnostic:{provider:'INTERNET_ARCHIVE',reason:'HTTP',httpStatus:503}});
  });
  it('preserva timeout durante o download do JSON e distingue JSON inválido',async()=>{
    const body=new ReadableStream({start(controller){controller.error(new DOMException('private body failure','AbortError'));}});
    const f=fixture([new Response(body),new Response('invalid json')]);
    await expect(f.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_UNAVAILABLE',diagnostic:{reason:'TIMEOUT'}});
    await expect(f.provider.cover(id)).rejects.toMatchObject({code:'ARTWORK_PROVIDER_INVALID',diagnostic:{reason:'INVALID_RESPONSE'}});
  });
});
