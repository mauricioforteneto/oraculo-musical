import {beforeEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {buildIssueReport,evidenceText,issuePrompt,locatorParts} from '../../src/lib/issues/report';
import {filterIssues,issueFilters,issueQuery} from '../../src/lib/issues/filters';
import {syntheticIssues} from '../fixtures/synthetic/issues';
import {syntheticAlbum,syntheticField,syntheticFirstResults,syntheticAdvance} from '../fixtures/synthetic/top50';
import {projectTop50} from '../../src/lib/competition/top50';
import {albumIdentity} from '../../src/lib/competition/rules';
const state=vi.hoisted(()=>({query:''}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(state.query),usePathname:()=>'/pendencias'}));
import {PendingIssuesPage} from '../../src/components/pending-issues-page';
beforeEach(()=>{state.query='';});
describe('central de pendências',()=>{
  it('reúne conflitos, diferenças, resultados e importação com escopos e efeitos distintos',()=>{
    const {source,competition}=syntheticIssues();const before=structuredClone({source,competition});
    const report=buildIssueReport(source,competition);
    const conflict=report.items.find(i=>i.code==='TOP50_FACT_CONFLICT')!;
    expect(conflict.subjects[0].artist).toBe('Artista da Repescagem');expect(conflict.blocking).toBe(true);
    expect(conflict.action).toContain('Confirme se o álbum participou');
    expect(conflict.evidence[0]).toMatchObject({version:'100',locator:'Albuns 2026!52'});
    const warning=report.items.find(i=>i.code==='TOP50_SOURCE_DIFFERENCE')!;
    expect(warning.blocking).toBe(false);expect(warning.evidence.some(e=>e.version==='82')).toBe(true);
    const result=report.items.find(i=>i.code==='RESULT_MISSING_WINNER')!;
    expect(result.evidence).toEqual([{label:'Resultado publicado',version:'100',fileName:'synthetic-v100.xlsx',locator:'Resultados Playoffs!2'}]);
    expect(report.items.some(i=>i.category==='import' && i.scope==='publication')).toBe(true);
    expect(report.items.some(i=>i.category==='import' && i.scope==='attempt')).toBe(true);
    expect({source,competition}).toEqual(before);
  });
  it('não associa a linha da tentativa recusada ao álbum da publicação ativa',()=>{
    const {source,competition}=syntheticIssues();
    const report=buildIssueReport(source,competition);
    const rejected=report.items.find(i=>i.scope==='attempt')!;
    const published=report.items.find(i=>i.code==='EXCEL_ERROR_VALUE')!;
    expect(rejected.subjects).toEqual([]);expect(rejected.evidence[0]).toMatchObject({version:'101',fileName:'synthetic-v101-rejected.xlsx',locator:'Albuns 2026!3'});
    expect(published.subjects).toHaveLength(1);expect(published.subjects[0].artist).toBe(source.albums[0].artist);
    expect(published.evidence[0].version).toBe('100');
  });
  it('identifica todo o grupo no corte sem incluir empates em outras posições',()=>{
    const {source,competition}=syntheticIssues('100',true);
    const field=syntheticField();
    const outsiders=Array.from({length:27},(_,i)=>syntheticAlbum(i+100,{originalScore:80,playoffSeed:null}));
    const albums=[...field.albums,...outsiders];
    const projection=projectTop50(albums,field.participants,[],albums.map(a=>albumIdentity(a)))!;
    const report=buildIssueReport({...source,albums,playoffResults:[]},{...competition,projection});
    const tie=report.items.find(i=>i.code==='TOP50_CUT_TIE')!;
    expect(tie.subjects).toHaveLength(27);expect(tie.blocking).toBe(true);expect(tie.action).toContain('decisão explícita');
    expect(projection.cutTieKeys).toHaveLength(27);
    const internal=projectTop50([...field.albums,...outsiders.slice(0,2)],field.participants,[],null)!;
    expect(buildIssueReport({...source,albums:[...field.albums,...outsiders.slice(0,2)],playoffResults:[]},{...competition,projection:internal}).items.some(i=>i.code==='TOP50_CUT_TIE')).toBe(false);
  });
  it('não trata jogos futuros e resultados ausentes como erro',()=>{
    const {source,competition}=syntheticIssues('100',true);
    source.playoffResults=[];competition.projection=projectTop50(source.albums,competition.active!.participants,[],null);
    expect(buildIssueReport(source,competition).items).toEqual([]);
  });
  it('mantém todas as linhas de resultados duplicados e encontra resultados sem confronto',()=>{
    const {source,competition}=syntheticIssues('100',true);
    source.playoffResults=[...syntheticFirstResults(),{...syntheticFirstResults()[0],sourceRow:55},{...syntheticFirstResults()[1],gameId:'Jogo 99',sourceRow:70}];
    const report=buildIssueReport(source,competition);
    const duplicate=report.items.find(i=>i.code==='RESULT_DUPLICATE_RESULTS')!;
    expect(duplicate.evidence.map(e=>e.locator)).toEqual(['Playoffs!2','Playoffs!55']);
    expect(report.items.find(i=>i.code==='RESULT_NOT_ASSOCIATED')!.evidence[0].locator).toBe('Playoffs!70');
  });
  it('distingue resultado publicado antecipadamente de participantes incompatíveis',()=>{
    const {source,competition}=syntheticIssues('100',true);
    const later=syntheticAdvance(syntheticFirstResults(),'roundOf16').slice(8,9);
    source.playoffResults=later;
    let report=buildIssueReport(source,competition);
    expect(report.items.find(i=>i.code==='RESULT_WAITING_PARTICIPANTS')!.blocking).toBe(false);
    source.playoffResults=[...syntheticFirstResults(),{...later[0],artistA:'Artista incompatível'}];
    report=buildIssueReport(source,competition);
    expect(report.items.find(i=>i.code==='RESULT_INCOMPATIBLE_RESULT')!.blocking).toBe(true);
  });
  it('usa a última ocorrência de um ausente e não inventa versão quando ela falta',()=>{
    const {source,competition}=syntheticIssues('100',true);
    const absent=syntheticAlbum(60,{originalScore:82,playoffSeed:null,isPresent:false,provenance:{version:'97',fileName:'synthetic-v97.xlsx',sourceLocator:'Albuns 2026!62'}});
    source.albums.push(absent);competition.projection=projectTop50(source.albums,competition.active!.participants,source.playoffResults,null);
    const item=buildIssueReport(source,competition).items.find(i=>i.code==='TOP50_FACT_CONFLICT')!;
    expect(item.evidence[0]).toEqual({label:'Última ocorrência do álbum',version:'97',fileName:'synthetic-v97.xlsx',locator:'Albuns 2026!62'});
    delete absent.provenance;
    expect(buildIssueReport(source,competition).items.find(i=>i.code==='TOP50_FACT_CONFLICT')!.evidence[0].version).toBeNull();
  });
  it('recalcula e remove itens depois de uma nova publicação corrigida',()=>{
    const before=syntheticIssues();expect(buildIssueReport(before.source,before.competition).items.length).toBeGreaterThan(0);
    const after=syntheticIssues('102',true);expect(buildIssueReport(after.source,after.competition)).toMatchObject({version:'102',items:[]});
  });
  it('preserva erros de backlog que bloqueiam importação e omite seus avisos não bloqueantes',()=>{
    const {source,competition}=syntheticIssues('100',true);
    const warning={code:'SUMMARY_BACKLOG_COUNT_MISMATCH',severity:'warning' as const,sourceLocator:'Resumo',message:'Contagem de backlog divergente.'};
    const error={code:'BACKLOG_SHEET_MISSING',severity:'error' as const,sourceLocator:'Backlog',message:'Aba obrigatória ausente.'};
    source.publicationIssues=[warning,error,error];const items=buildIssueReport(source,competition).items;
    expect(items).toHaveLength(1);expect(items[0].blocking).toBe(true);
  });
  it('explica falha sem relatório e não apresenta a versão candidata como publicada',()=>{
    const {source,competition}=syntheticIssues('100',true);
    source.publicationIssues=undefined;
    source.lastAttempt={status:'failed',startedAt:'2026-10-27',finishedAt:'2026-10-27',version:'101',fileName:'rejected.xlsx',errorCode:'DRIVE_UNAVAILABLE',counts:{},issues:[]};
    const report=buildIssueReport(source,competition);
    expect(report.notices.join(' ')).toContain('Não há relatório');expect(report.items[0].code).toBe('DRIVE_UNAVAILABLE');
    expect(report.items[0].evidence[0].version).toBe('101');expect(report.version).toBe('100');
    expect(report.items[0].action).toContain('Verifique acesso');
  });
  it('gera uma orientação copiável que preserva originais, regras e proveniência',()=>{
    const {source,competition}=syntheticIssues();const report=buildIssueReport(source,competition);
    const prompt=issuePrompt(report.items,report.version);
    expect(prompt).toContain('Publicação de referência: v100');expect(prompt).toContain('nova versão numérica');expect(prompt).toContain('Preserve notas originais');
    expect(prompt).toContain('Tentativa recusada · v101');expect(prompt).toContain('Albuns 2026!52');expect(prompt).toContain('sem sobrescrever a anterior');
    expect(locatorParts("'Albuns 2026'!$C$52")).toEqual({sheet:'Albuns 2026',row:52});
    expect(locatorParts('Resumo')).toEqual({sheet:'Resumo',row:null});
    expect(evidenceText({label:'Registro',version:null,locator:null})).toContain('versão não registrada');
  });
  it('combina filtros, busca sem acentos e URLs válidas sem aceitar escopo arbitrário',()=>{
    const {source,competition}=syntheticIssues();const report=buildIssueReport(source,competition);
    const filters=issueFilters(new URLSearchParams('q=repescagem&tipo=facts&origem=publication&impacto=blocking&limite=40'));
    const selected=filterIssues(report.items,filters);expect(selected).toHaveLength(1);expect(selected[0].code).toBe('TOP50_FACT_CONFLICT');
    expect(issueFilters(new URLSearchParams(issueQuery(filters)))).toEqual(filters);
    expect(issueFilters(new URLSearchParams('tipo=evil&origem=evil&limite=-1'))).toEqual({q:'',category:'all',scope:'all',impact:'all',limit:20});
  });
  it('renderiza proveniência, orientação, links privados e estado vazio sem esconder filtro ativo',()=>{
    const {source,competition}=syntheticIssues();const report=buildIssueReport(source,competition);
    const html=renderToStaticMarkup(<PendingIssuesPage report={report}/>);
    expect(html).toContain('Central de pendências');expect(html).toContain('Copiar pendências filtradas');expect(html).toContain('Albuns 2026!52');expect(html).toContain('Tentativa recusada');
    expect(html).toContain('/albuns/00000000-0000-4000-8000-000000000050');
    state.query='q=inexistente';expect(renderToStaticMarkup(<PendingIssuesPage report={report}/>)).toContain('Nenhuma pendência corresponde aos filtros');
    const empty=syntheticIssues('102',true);state.query='';expect(renderToStaticMarkup(<PendingIssuesPage report={buildIssueReport(empty.source,empty.competition)}/>)).toContain('Nenhuma pendência identificada');
    const failed=renderToStaticMarkup(<PendingIssuesPage report={null} loadFailed/>);expect(failed).toContain('Não foi possível carregar as pendências');expect(failed).not.toContain('Nenhuma pendência identificada');
  });
});
