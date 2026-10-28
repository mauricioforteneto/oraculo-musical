import {beforeEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {syntheticAlbum} from '../fixtures/synthetic/top50';
import {matchesArtworkFilter} from '../../src/lib/artwork/review';
import type {AlbumArtwork} from '../../src/lib/artwork/types';
const state=vi.hoisted(()=>({query:''}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(state.query)}));
import {CatalogPage} from '../../src/components/catalog-page';
const artwork=(status:AlbumArtwork['status']):AlbumArtwork=>({status,selection:'automatic',releaseGroupId:null,thumbnailUrl:null,imageUrl:null,checkedAt:'',nextAttemptAt:null});
const albums=[
  syntheticAlbum(1,{artist:'Revisar agora',artwork:artwork('ambiguous')}),
  syntheticAlbum(2,{artist:'Ausente para revisar',isPresent:false,artwork:artwork('ambiguous')}),
  syntheticAlbum(3,{artist:'Sem imagem',artwork:artwork('missing')}),
  syntheticAlbum(4,{artist:'Erro temporário',artwork:artwork('error')}),
  syntheticAlbum(5,{artist:'Já confirmado',artwork:{...artwork('found'),selection:'manual'}}),
  syntheticAlbum(6,{artist:'Ainda não buscado'}),
].map((a,i)=>({...a,albumId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}));
beforeEach(()=>{state.query='';});
describe('fila de revisão das capas',()=>{
  it('separa ambíguos, sem capa e falhas sem incluir ausentes ou pendências automáticas',()=>{
    expect(albums.filter(a=>matchesArtworkFilter(a,'revisar')).map(a=>a.artist)).toEqual(['Revisar agora']);
    expect(albums.filter(a=>matchesArtworkFilter(a,'sem-capa')).map(a=>a.artist)).toEqual(['Sem imagem']);
    expect(albums.filter(a=>matchesArtworkFilter(a,'falhas')).map(a=>a.artist)).toEqual(['Erro temporário']);
    expect(albums.filter(a=>matchesArtworkFilter(a))).toHaveLength(6);
  });
  it('mostra contagens e links que preservam o contexto da revisão',()=>{
    state.query='capas=revisar';
    const html=renderToStaticMarkup(<CatalogPage albums={albums} />);
    expect(html).toContain('Capas para revisar');expect(html).toContain('Para revisar (1)');
    expect(html).toContain('Sem capa encontrada (1)');expect(html).toContain('Com falha (1)');
    expect(html).toContain('Revisar agora');expect(html).not.toContain('Ausente para revisar');expect(html).not.toContain('Já confirmado');
    expect(html).toContain('/albuns/00000000-0000-4000-8000-000000000001?capas=revisar');
  });
  it('combina busca e nota e mostra vazio sem presumir ausência de pendências',()=>{
    state.query='capas=revisar&q=inexistente&nota=90';
    const html=renderToStaticMarkup(<CatalogPage albums={albums} />);
    expect(html).toContain('Nenhum álbum nesta situação corresponde aos filtros atuais');expect(html).toContain('Para revisar (1)');
  });
});
