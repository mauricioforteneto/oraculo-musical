import type { AlbumRecord } from '@/lib/catalog/types';
export type ArtworkFilter = 'revisar' | 'sem-capa' | 'falhas';
export const ARTWORK_FILTERS: {id:ArtworkFilter;label:string;title:string;description:string}[] = [
  {id:'revisar',label:'Para revisar',title:'Capas para revisar',description:'A busca encontrou possibilidades sem uma correspondência segura. Abra um álbum para pesquisar, visualizar e confirmar a capa correta.'},
  {id:'sem-capa',label:'Sem capa encontrada',title:'Álbuns sem capa encontrada',description:'A busca não encontrou uma capa disponível. Você pode ajustar os termos da pesquisa no detalhe de cada álbum.'},
  {id:'falhas',label:'Com falha',title:'Capas com falha na busca',description:'A consulta falhou. Abra o álbum para pesquisar manualmente ou retome a busca em Sincronização quando uma nova tentativa estiver disponível.'},
];
export function matchesArtworkFilter(album:AlbumRecord,filter?:ArtworkFilter) {
  if(!filter) return true;
  if(album.isPresent===false) return false;
  return album.artwork?.status === (filter==='revisar' ? 'ambiguous' : filter==='sem-capa' ? 'missing':'error');
}
