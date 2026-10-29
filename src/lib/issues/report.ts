import type { AlbumRecord, LocalSourcePreview, PublishedPlayoffResult } from '@/lib/catalog/types';
import { visibleIssue } from '@/lib/catalog/visible-issues';
import { buildBracketView, ROUND_OF_16_GAME_IDS } from '@/lib/competition/bracket';
import { albumIdentity, MATCH_PENDING_LABELS, publishedResultsForMatch } from '@/lib/competition/rules';
import { TOP50_DECISION_INSTRUCTIONS } from '@/lib/competition/manual-decisions';
import type { getCompetitionState } from '@/lib/competition/service';

export type IssueCategory='facts'|'results'|'derived'|'import';
export type IssueScope='publication'|'attempt';
export type IssueSubject={artist:string;title:string;albumId?:string};
export type IssueEvidence={label:string;version:string|null;fileName?:string|null;locator:string|null};
export type PendingIssue={
  id:string;code:string;category:IssueCategory;scope:IssueScope;blocking:boolean;title:string;
  subjects:IssueSubject[];messages:string[];impact:string;action:string;evidence:IssueEvidence[];
};
export type IssueReport={version:string|null;publishedAt:string|null;items:PendingIssue[];notices:string[]};
export type IssueCompetition=Pick<Awaited<ReturnType<typeof getCompetitionState>>,'active'|'projection'>;
export const ISSUE_CATEGORIES=[{id:'facts',label:'Fatos do Top 50'},{id:'results',label:'Resultados'},{id:'derived',label:'Conferência da planilha'},{id:'import',label:'Importação'}] as const;
const CUT_TIE_ACTION=`Este empate depende de decisão explícita do proprietário registrada na tabela reconhecida pelo aplicativo. ${TOP50_DECISION_INSTRUCTIONS} Enquanto não houver decisão confirmada e validada, mantenha todo o grupo sem posição em Rank Top 50 provisório (Albuns 2026) e Pos. (Top 50), preservando notas originais, fatos competitivos e os demais classificados. Mantenha fase, bônus e índice conforme o cálculo atual informado. Se já houver decisão comprovada, preserve seu registro como histórico e transcreva somente o que foi confirmado para a tabela. Observações e posições preenchidas, isoladamente, não aplicam um desempate. Não declare o empate resolvido antes da validação da decisão pelo aplicativo.`;
const subject=(album:{artist:string;title:string;albumId?:string}):IssueSubject=>({artist:album.artist,title:album.title,...(album.albumId ? {albumId:album.albumId}:{})});
export function locatorParts(locator:string|null) {
  if(!locator) return {sheet:null,row:null};
  const split=locator.lastIndexOf('!');
  if(split<0) return {sheet:locator,row:null};
  const cell=locator.slice(split+1).match(/^(?:\$?[A-Za-z]+\$?)?([1-9][0-9]*)$/);
  return {sheet:locator.slice(0,split).replace(/^'|'$/g,''),row:cell ? Number(cell[1]) : null};
}
function albumEvidence(album:AlbumRecord,source:LocalSourcePreview):IssueEvidence {
  return {label:album.isPresent===false ? 'Última ocorrência do álbum':'Registro do álbum',
    version:album.provenance?.version ?? (album.isPresent===false ? null : source.version===null ? null : String(source.version)),
    fileName:album.provenance?.fileName ?? (album.isPresent===false ? null : source.fileName),
    locator:album.provenance?.sourceLocator ?? (album.sourceRow>0 ? `Albuns 2026!${album.sourceRow}`:null)};
}
function conflictAction(messages:string[]) {
  if(messages.some(m=>m.includes('exclusão da Repescagem'))) return 'Confirme se o álbum participou da Repescagem. Faça a indicação de fase e a observação concordarem com o fato comprovado; preserve o bônus somente se a participação for confirmada.';
  if(messages.some(m=>m.includes('duplicada'))) return 'Confira as linhas e identifique se representam o mesmo álbum ou edições distintas. Corrija a duplicidade na fonte sem fundir avaliações ou alterar notas originais automaticamente.';
  if(messages.some(m=>m.includes('ausente'))) return 'Confira se a omissão foi intencional. Se foi acidental, restaure o registro na próxima versão; a última ocorrência continua preservada no aplicativo.';
  return 'Confira a fase alcançada e suas evidências: etapa, score e resultado. Corrija os campos contraditórios na próxima versão, sem inventar participação nem atribuir uma fase encerrada apenas pela nota.';
}
function importAction(code:string) {
  if(code.startsWith('TOP50_DECISION')) return TOP50_DECISION_INSTRUCTIONS;
  if(/ORIGINAL|PILLAR/.test(code)) return 'Confira a nota original e os pilares com a avaliação registrada. Corrija a inconsistência preservando as notas originais imutáveis; não substitua a original por nota promovida ou índice.';
  if(/DUPLICATE|IDENTITY/.test(code)) return 'Confira artista, álbum e as linhas indicadas. Corrija identidades ou duplicidades sem fundir edições distintas nem apagar avaliações válidas.';
  if(/PLAYOFF/.test(code)) return 'Confira fase, jogo, seeds, artistas e vencedor na aba indicada. Preserve os seeds congelados e publique somente resultados comprovados.';
  if(/HEADER|COLUMN|SHEET|NO_ALBUM/.test(code)) return 'Restaure a aba, os cabeçalhos e as colunas exigidas no modelo da planilha; preserve os registros e gere uma nova versão numérica.';
  return 'Confira o apontamento na aba ou célula indicada. Corrija a fonte quando necessário e gere uma nova versão numérica do XLSX, preservando as avaliações originais e os resultados válidos.';
}

export function buildIssueReport(source:LocalSourcePreview|null,competition:IssueCompetition|null):IssueReport {
  const report:IssueReport={version:source?.version==null ? null:String(source.version),publishedAt:source?.publishedAt ?? null,items:[],notices:[]};
  if(!source) {report.notices.push('Ainda não há fonte registrada. Abra Sincronização para publicar a planilha.');return report;}
  const version=report.version;
  const albums=source.albums ?? [];
  const byIdentity=new Map<string,AlbumRecord[]>();
  for(const album of albums) {const key=albumIdentity(album);byIdentity.set(key,[...(byIdentity.get(key) ?? []),album]);}
  function add(issue:Omit<PendingIssue,'id'>) {report.items.push({...issue,id:`pendencia-${report.items.length+1}`});}
  const projection=competition?.projection;
  const active=competition?.active;
  const cutTieKeys=new Set(projection?.cutTieKeys ?? []);
  const cutTieGroup=(projection?.entries ?? []).filter(entry=>cutTieKeys.has(entry.identityKey))
    .map(entry=>`${entry.artist} — ${entry.title}`).join('; ');
  const decisionAvailability=source.top50DecisionsReady===false
    ? 'A leitura de desempates manuais aguarda a migração 0008 do banco. As decisões ainda não podem ser aplicadas nesta instalação.'
    : source.top50DecisionsExtracted===false ? 'Sincronize novamente a versão publicada para extrair a tabela de decisões com o novo parser. Não é necessário gerar outra versão se o XLSX já tiver a tabela correta.' : '';
  const cutTieAction=`${decisionAvailability ? `${decisionAvailability} `:''}${CUT_TIE_ACTION}`;
  if(decisionAvailability) report.notices.push(decisionAvailability);
  if(version!==null && !active) report.notices.push('As verificações competitivas aparecerão após a confirmação do corte oficial.');
  if(version!==null && source.publicationIssues===undefined) report.notices.push('Não há relatório de importação salvo para esta publicação. As verificações calculadas continuam disponíveis.');
  for(const entry of [...(projection?.entries ?? []),...(projection?.survivors ?? [])]) {
    const records=byIdentity.get(entry.identityKey) ?? [];
    const subjects=records.length ? records.map(subject) : [subject(entry)];
    const evidence=records.map(a=>albumEvidence(a,source));
    if(active) {
      const frozen=active.participants.find(p=>p.identityKey===entry.identityKey);
      if(frozen) evidence.push({label:'Corte congelado',version:active.fileVersion,fileName:active.fileName,locator:`Albuns 2026!${frozen.sourceRow}`});
    }
    if(entry.conflicts.length) add({code:'TOP50_FACT_CONFLICT',category:'facts',scope:'publication',blocking:true,title:'Fatos competitivos precisam de confirmação',
      subjects,messages:[...entry.conflicts],impact:'Este álbum fica sem posição provisória enquanto os fatos estiverem em conflito.',action:conflictAction(entry.conflicts),evidence});
    if(entry.warnings.length) add({code:'TOP50_SOURCE_DIFFERENCE',category:'derived',scope:'publication',blocking:false,title:'Valores da planilha diferem do cálculo',
      subjects,messages:[...entry.warnings,`Cálculo atual: ${entry.phase} · nota original ${entry.originalScore} · bônus ${entry.bonus ?? 'não aplicável'} · índice ${entry.index ?? 'não aplicável'} · posição ${entry.position ?? 'não definida'}.`,
        ...(cutTieKeys.has(entry.identityKey) ? [`Desempenho da fase no empate: ${entry.phasePerformance ?? 0}.`]:[]),
        ...(cutTieKeys.has(entry.identityKey) ? [`Grupo completo empatado no corte, sem ordem de desempate: ${cutTieGroup}.`]:[])],
      impact:'O aplicativo preserva a regra atual e a nota congelada; valores derivados divergentes não substituem o cálculo.',
      action:cutTieKeys.has(entry.identityKey)
        ? `Este álbum pertence ao grupo empatado no corte. Deixe sua posição vazia nas duas abas e corrija os demais valores derivados divergentes conforme o cálculo atual informado. Retirar a posição atribuída corrige o aviso de posição, mas o empate permanece pendente. ${cutTieAction}`
        : 'Atualize Melhor fase Top 50, Bônus Top 50, Índice Top 50 e Rank Top 50 provisório conforme o cálculo atual informado e a regra 2026-top50-2; mantenha a aba Top 50 coerente. Preserve os fatos e deixe campos não aplicáveis vazios.',evidence});
  }
  if(projection?.tieAtCut) {
    const keys=new Set(projection.cutTieKeys);
    const tied=projection.entries.filter(e=>keys.has(e.identityKey));
    const records=tied.flatMap(e=>byIdentity.get(e.identityKey) ?? []);
    add({code:'TOP50_CUT_TIE',category:'facts',scope:'publication',blocking:true,title:'Empate atravessa a última vaga do Top 50',
      subjects:tied.map(e=>subject(byIdentity.get(e.identityKey)?.[0] ?? e)),messages:[`${tied.length} álbuns continuam empatados após os critérios aprovados e disputam o corte das ${projection.slots} vagas por índice.`,
        ...tied.map(e=>`${e.artist} — ${e.title}: nota original ${e.originalScore}; fase ${e.phase}; desempenho da fase ${e.phasePerformance ?? 0}; índice ${e.index}.`)],
      impact:'Todo o grupo empatado permanece sem posição. Ordem alfabética não resolve a última vaga.',
      action:cutTieAction,
      evidence:records.map(a=>albumEvidence(a,source))});
  }
  for(const issue of projection?.decisionIssues ?? []) add({code:issue.code,category:'facts',scope:'publication',
    blocking:issue.rows.some(row=>cutTieKeys.has(albumIdentity(row,row.season ?? 2026))),
    title:issue.code==='TOP50_DECISION_PENDING' ? 'Desempate manual aguarda confirmação'
      : issue.code==='TOP50_DECISION_STALE' ? 'Desempate manual precisa de revisão'
      : issue.code==='TOP50_DECISION_CONFLICT' ? 'Decisões manuais conflitantes':'Desempate manual inválido',
    subjects:issue.rows.map(row=>subject(byIdentity.get(albumIdentity(row,row.season ?? 2026))?.[0] ?? row)),
    messages:[`Decisão: ${issue.decisionId || 'sem identificação'}.`,...issue.messages],
    impact:'Esta decisão não foi aplicada. Os critérios automáticos continuam valendo; um grupo empatado no corte permanece sem posição.',
    action:`${issue.code==='TOP50_DECISION_STALE' || issue.code==='TOP50_DECISION_CONFLICT'
      ? 'Reconfirme a ordem com o proprietário para o grupo e o contexto atuais; até lá, marque a decisão como Pendente. Não atualize apenas o contexto para fazer uma confirmação antiga passar na validação. '
      : 'Corrija a decisão indicada sem alterar notas, fatos ou os demais classificados. '}${TOP50_DECISION_INSTRUCTIONS}`,
    evidence:issue.rows.map(row=>({label:'Decisão manual publicada',version,fileName:source.fileName,locator:`${row.sourceSheet}!${row.sourceRow}`}))});
  const resultEvidence=(result:PublishedPlayoffResult):IssueEvidence=>({label:'Resultado publicado',version,fileName:source.fileName,locator:`${result.sourceSheet ?? 'Playoffs'}!${result.sourceRow}`});
  if(active?.bracket) {
    const results=source.playoffResults ?? [];
    const matched=new Set<PublishedPlayoffResult>();
    for(const phase of buildBracketView(active.bracket,results).phases) {
      for(const [index,game] of phase.games.entries()) {
        const gameId=phase.id==='first' ? `Jogo ${String(index+1).padStart(2,'0')}` : phase.id==='roundOf16' ? ROUND_OF_16_GAME_IDS[index]
          : phase.id==='quarters' ? `QF${index+1}` : phase.id==='semis' ? `SF${index+1}` : 'FINAL';
        const high=game.high.participant,low=game.low.participant;
        const rows=high && low ? publishedResultsForMatch(high,low,results,phase.id,gameId)
          : results.filter(r=>r.phase===phase.id && r.gameId===gameId);
        rows.forEach(row=>matched.add(row));
        const pending=game.resolution?.pending;
        if(!rows.length || (high && low && !pending)) continue;
        const subjects=[high,low].flatMap(p=>p ? [subject(byIdentity.get(p.identityKey)?.[0] ?? p)]:[]);
        add({code:pending ? `RESULT_${pending.replaceAll('-','_').toUpperCase()}`:'RESULT_WAITING_PARTICIPANTS',category:'results',scope:'publication',blocking:!!high && !!low,
          title:`${phase.label} · ${game.label}`,subjects,
          messages:[pending ? MATCH_PENDING_LABELS[pending]:'Existe resultado publicado, mas os participantes deste confronto ainda dependem das fases anteriores.',
            ...rows.map(r=>`Fonte: #${r.seedA} ${r.artistA} × #${r.seedB} ${r.artistB} · ${r.result || 'sem placar'} · vencedor: ${r.winner || 'não informado'}.`)],
          impact:'Sem vencedor validado, este resultado não comprova eliminação nem libera uma vaga reservada.',
          action:'Confira fase, identificador do jogo, seeds, artistas e vencedor nas linhas indicadas. Remova duplicidades acidentais e corrija incompatibilidades com a chave congelada; não presuma o vencedor pelo placar.',
          evidence:rows.map(resultEvidence)});
      }
    }
    for(const result of results.filter(r=>!matched.has(r))) add({code:'RESULT_NOT_ASSOCIATED',category:'results',scope:'publication',blocking:true,
      title:'Resultado sem confronto reconhecido',subjects:[],messages:[`#${result.seedA} ${result.artistA} × #${result.seedB} ${result.artistB} · ${result.gameId ?? 'jogo não informado'}.`],
      impact:'Este resultado não pode ser usado para avançar a chave.',action:'Confira fase, jogo, seeds e artistas e associe o registro a um confronto válido. Preserve os participantes congelados.',evidence:[resultEvidence(result)]});
  } else if(source.playoffResults?.length) report.notices.push('Há resultados publicados; a associação com os confrontos aguarda o corte oficial.');

  const seen=new Set<string>();
  function importIssues(issues:NonNullable<LocalSourcePreview['publicationIssues']>,scope:IssueScope,issueVersion:string|null,fileName?:string|null) {
    for(const issue of issues.filter(visibleIssue)) {
      const key=[scope,issue.code,issue.sourceLocator,issue.message].join('|');if(seen.has(key)) continue;seen.add(key);
      const parts=locatorParts(issue.sourceLocator);
      // Rejected candidate rows must never be linked to the album occupying that row in the active publication.
      const subjects=scope==='publication' && parts.sheet==='Albuns 2026' && parts.row!==null
        ? albums.filter(a=>a.isPresent!==false && a.sourceRow===parts.row).map(subject):[];
      add({code:issue.code,category:'import',scope,blocking:issue.severity==='error',title:issue.severity==='error' ? 'Erro na importação da planilha':'Aviso da importação da planilha',
        subjects,messages:[issue.message],impact:scope==='attempt' ? 'A tentativa não substituiu a publicação válida. Corrigir este item não altera a versão já publicada.'
          : 'Este apontamento pertence à publicação atual; confira a fonte antes de gerar a próxima versão.',
        action:importAction(issue.code),evidence:[{label:scope==='attempt' ? 'Tentativa recusada':'Relatório da publicação',version:issueVersion,fileName,locator:issue.sourceLocator || null}]});
    }
  }
  importIssues(source.publicationIssues ?? [],'publication',version,source.fileName);
  const attempt=source.lastAttempt;
  if(attempt?.status==='failed') {
    importIssues(attempt.issues ?? [],'attempt',attempt.version ?? null,attempt.fileName);
    if(!attempt.issues?.some(visibleIssue)) add({code:attempt.errorCode ?? 'SYNC_FAILED',category:'import',scope:'attempt',blocking:true,title:'A última importação não foi concluída',subjects:[],
      messages:[`Código da tentativa: ${attempt.errorCode ?? 'SYNC_FAILED'}.`],impact:'A última publicação válida foi preservada.',
      action:'Abra Sincronização para conferir a tentativa. Verifique acesso à fonte e o erro informado antes de tentar novamente; não altere avaliações para resolver uma falha de conexão.',
      evidence:[{label:'Tentativa recusada',version:attempt.version ?? null,fileName:attempt.fileName,locator:null}]});
  }
  if(attempt?.status==='running') report.notices.push('Há uma sincronização em andamento. Esta central usa a publicação disponível; recarregue após a conclusão.');
  report.items.sort((a,b)=>Number(b.blocking)-Number(a.blocking));
  return report;
}

export function evidenceText(evidence:IssueEvidence) {
  return [evidence.label,evidence.version!==null ? `v${evidence.version}`:'versão não registrada',evidence.fileName,evidence.locator ?? 'linha não registrada'].filter(Boolean).join(' · ');
}
export function issuePrompt(issues:PendingIssue[],version:string|null) {
  return [`Revise as pendências abaixo no XLSX do Oráculo Musical. Publicação de referência: ${version!==null ? `v${version}`:'nenhuma'}.`,
    'Corrija apenas o que estiver comprovado nas evidências e no cálculo atual informado. Se houver correções aplicáveis ao XLSX, gere uma nova versão numérica, sem sobrescrever a anterior. Se todos os itens dependerem de confirmação ou de recurso ainda ausente no aplicativo, entregue o diagnóstico e o que falta, sem gerar uma nova versão apenas para declarar resolução.',
    'Preserve notas originais, seeds congelados, resultados válidos e dados não relacionados. Não altere notas, fases, participação, scores ou resultados para fazer uma posição desejada fechar. Não invente participação, vencedor, critério de desempate ou aprovação do proprietário.',
    'Separe correção de dados, decisão do proprietário e mudança necessária no aplicativo. Use somente os campos reconhecidos descritos nas orientações para corrigir dados, incluindo a tabela Desempates Top 50 quando indicada. Observações e posições derivadas não substituem essa tabela. Preserve registros históricos existentes, sem tratá-los automaticamente como confirmação ou como decisão já aplicada.',
    'Nos campos derivados, siga o cálculo atual informado; posição não definida deve ficar vazia, nunca zero nem uma posição escolhida. Mantenha Albuns 2026 e Top 50 coerentes. Quando faltar evidência ou suporte para uma decisão, mantenha o item pendente e explique o impedimento.',
    'Ao final, liste separadamente as correções feitas, as confirmações que faltam e as mudanças necessárias no aplicativo. Diferencie remover um aviso de posição de resolver o empate que o causou. Só declare validação no aplicativo se ela tiver sido realizada; gerar o XLSX não comprova que as pendências desapareceram.',
    ...issues.map((issue,i)=>[`${i+1}. ${issue.title} (${issue.code})`,issue.scope==='attempt' ? 'Origem: tentativa recusada; não confundir suas linhas com a publicação ativa.':'Origem: publicação atual.',
      ...issue.subjects.map(s=>`${s.artist} — ${s.title}`),...issue.evidence.map(evidenceText),...issue.messages,`Efeito: ${issue.impact}`,`Orientação: ${issue.action}`].join('\n'))].join('\n\n');
}
