import type { LocalSourcePreview } from '../../../src/lib/catalog/types';
import type { IssueCompetition } from '../../../src/lib/issues/report';
import { albumIdentity } from '../../../src/lib/competition/rules';
import { projectTop50 } from '../../../src/lib/competition/top50';
import { syntheticAlbum, syntheticField, syntheticFirstResults } from './top50';
export function syntheticIssues(version='100',corrected=false) {
  const field=syntheticField();
  const albums=field.albums.map((album,i)=>({...album,albumId:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,
    provenance:{version,fileName:`synthetic-v${version}.xlsx`,sourceLocator:`Albuns 2026!${album.sourceRow}`}}));
  const conflict={...syntheticAlbum(50,{artist:'Artista da Repescagem',title:'Disco com participação em conferência',originalScore:78,playoffSeed:null,
    repescagem:'Eliminado — Etapa 1',repescagemNote:corrected ? 'Participação confirmada na Etapa 1.':'Fora da pós-temporada; avaliação após o fechamento.'}),
    albumId:'00000000-0000-4000-8000-000000000050',provenance:{version,fileName:`synthetic-v${version}.xlsx`,sourceLocator:'Albuns 2026!52'}};
  const records=[...albums,conflict];
  if(!corrected) albums[0].top50Bonus=99;
  const results=syntheticFirstResults().map(r=>({...r,sourceSheet:'Resultados Playoffs'}));
  if(!corrected) results[0].winner='';
  const source:LocalSourcePreview={version,fileName:`synthetic-v${version}.xlsx`,referenceDate:'2026-10-01',publishedAt:'2026-10-27T22:00:00Z',summary:{},albums:records,backlog:[],playoffResults:results,
    publicationIssues:corrected ? []:[{code:'EXCEL_ERROR_VALUE',severity:'warning',sourceLocator:'Albuns 2026!C3',message:'A planilha contém um valor de erro do Excel.'}],
    lastAttempt:corrected ? {status:'succeeded',startedAt:'2026-10-27T22:00:00Z',finishedAt:'2026-10-27T22:01:00Z',version,fileName:`synthetic-v${version}.xlsx`,errorCode:null,counts:{},issues:[]}
      : {status:'failed',startedAt:'2026-10-27T23:00:00Z',finishedAt:'2026-10-27T23:01:00Z',version:'101',fileName:'synthetic-v101-rejected.xlsx',errorCode:'WORKBOOK_INVALID',counts:{},
        issues:[{code:'DUPLICATE_IDENTITY',severity:'error',sourceLocator:'Albuns 2026!3',message:'Identidade repetida na versão recusada.'}]}};
  const competition:IssueCompetition={active:{id:'synthetic',fileName:'synthetic-v82.xlsx',fileVersion:'82',sha256:'a'.repeat(64),frozenAt:'2026-10-01T03:00:00Z',frozenBy:'synthetic',
    participants:field.participants,correctionReason:null,bracket:field.bracket},projection:projectTop50(records,field.participants,results,records.map(a=>albumIdentity(a)))};
  return {source,competition};
}
