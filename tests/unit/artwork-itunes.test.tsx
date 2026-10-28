import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('server-only',()=>({}));
import {ArtworkProvider,exactCandidate} from '../../src/lib/artwork/provider';
import {appleAlbumUrl,artworkUrl,summaryFor,isArtworkId,type AlbumArtwork} from '../../src/lib/artwork/types';
import {ArtworkAttribution} from '../../src/components/artwork-attribution';
const row={wrapperType:'collection',collectionType:'Album',collectionId:123,artistName:'Banda',collectionName:'Disco',releaseDate:'2026-01-01',artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/Music/synthetic/100x100bb.jpg',collectionViewUrl:'https://music.apple.com/br/album/disco/123?uo=4'};
function fixture(responses:Response[]) {
  const fetcher=vi.fn<typeof fetch>(async()=>responses.shift()!);
  const reserve=vi.fn(async()=>0),defer=vi.fn(async()=>{});
  return {fetcher,reserve,defer,provider:new ArtworkProvider({fetch:fetcher,reserve,defer,now:()=>1000,sleep:async()=>{},deadline:21000})};
}
describe('capas alternativas do iTunes',()=>{
  it('pesquisa álbuns e reutiliza a URL fornecida sem ampliar artificialmente a imagem',async()=>{
    const f=fixture([Response.json({resultCount:1,results:[row]})]);
    const result=await f.provider.itunesSearch('Banda','Disco');
    expect(result.complete).toBe(true);expect(exactCandidate(result.candidates,'Banda','Disco')?.id).toBe('itunes:123');
    expect(result.candidates[0].artwork).toMatchObject({provider:'itunes',itunesCollectionId:'123',imageUrl:row.artworkUrl100,providerUrl:'https://music.apple.com/br/album/disco/123'});
    const url=new URL(String(f.fetcher.mock.calls[0][0]));expect(url.hostname).toBe('itunes.apple.com');expect(url.searchParams.get('entity')).toBe('album');expect(url.searchParams.get('country')).toBe('BR');
    expect(f.reserve).toHaveBeenCalledWith('ITUNES',expect.any(Number));
  });
  it('não escolhe automaticamente resultados truncados, edições diferentes ou homônimos',async()=>{
    const f=fixture([Response.json({resultCount:20,results:Array.from({length:20},(_,i)=>({...row,collectionId:i+1}))})]);
    const result=await f.provider.itunesSearch('Banda','Disco');expect(result.complete).toBe(false);expect(exactCandidate(result.candidates,'Banda','Disco')).toBeNull();
    expect(exactCandidate(result.candidates,'Banda','Disco (Deluxe)')).toBeNull();
  });
  it('consulta novamente o identificador ao visualizar e rejeita IDs incompatíveis',async()=>{
    const f=fixture([Response.json({resultCount:1,results:[row]})]);expect((await f.provider.itunesAlbum('itunes:123')).id).toBe('itunes:123');
    await expect(f.provider.itunesAlbum('itunes:001')).rejects.toMatchObject({code:'ARTWORK_INVALID_REQUEST'});
    const wrong=fixture([Response.json({resultCount:1,results:[{...row,collectionId:124}]})]);await expect(wrong.provider.itunesAlbum('itunes:123')).rejects.toMatchObject({code:'ARTWORK_NOT_FOUND'});
    expect(isArtworkId('itunes:123')).toBe(true);expect(isArtworkId('https://evil.example')).toBe(false);
  });
  it('rejeita imagens externas, URLs de loja falsas e respostas malformadas',async()=>{
    const f=fixture([Response.json({resultCount:1,results:[{...row,artworkUrl100:'https://evil.example/cover.jpg'}]}),Response.json({results:[]})]);
    expect((await f.provider.itunesSearch('Banda','Disco')).candidates).toHaveLength(0);
    await expect(f.provider.itunesSearch('Banda','Disco')).rejects.toMatchObject({code:'ARTWORK_PROVIDER_INVALID',diagnostic:{provider:'ITUNES'}});
    for(const url of ['https://music.apple.com.evil.example/br/album/x/123','https://user@music.apple.com/br/album/x/123','https://music.apple.com:444/br/album/x/123','http://music.apple.com/br/album/x/123']) expect(appleAlbumUrl(url)).toBeNull();
    expect(artworkUrl('https://is1-ssl.mzstatic.com.evil.example/image/a')).toBeNull();
    expect(artworkUrl('https://is1-ssl.mzstatic.com/private')).toBeNull();
  });
  it('não permite redirecionar a API para o CDN de imagens ou outro serviço',async()=>{
    const f=fixture([new Response(null,{status:302,headers:{location:row.artworkUrl100}})]);
    await expect(f.provider.itunesSearch('Banda','Disco')).rejects.toMatchObject({code:'ARTWORK_PROVIDER_INVALID'});expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it('libera uma primeira tentativa alternativa para negativos antigos e preserva revisões/escolhas',()=>{
    const record=(status:AlbumArtwork['status'],extra:Partial<AlbumArtwork>={}):AlbumArtwork=>({status,selection:'automatic',releaseGroupId:null,thumbnailUrl:null,imageUrl:null,checkedAt:'',nextAttemptAt:'2099-01-01',...extra});
    const records=new Map([['missing',record('missing')],['error',record('error')],['review',record('ambiguous')],['found',record('found')],['manual',record('hidden',{selection:'manual'})],['checked',record('missing',{fallbackCheckedAt:'2026-10-01'})]]);
    expect(summaryFor([...records.keys()].map(albumId=>({albumId})),records,true).due).toBe(2);
  });
  it('mostra a origem e o link da Apple e omite links não validados',()=>{
    const artwork:AlbumArtwork={status:'found',provider:'itunes',selection:'automatic',releaseGroupId:null,thumbnailUrl:row.artworkUrl100,imageUrl:row.artworkUrl100,providerUrl:row.collectionViewUrl,checkedAt:'',nextAttemptAt:null};
    const html=renderToStaticMarkup(<ArtworkAttribution artwork={artwork}/>);expect(html).toContain('https://music.apple.com/br/album/disco/123');expect(html).toContain('Capa via iTunes');
    expect(renderToStaticMarkup(<ArtworkAttribution artwork={{...artwork,providerUrl:'https://evil.example'}}/>)).toBe('');
  });
});
