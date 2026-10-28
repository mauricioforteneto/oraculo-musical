import { ISSUE_CATEGORIES, type PendingIssue, type IssueCategory, type IssueScope } from './report';
export type IssueFilters={q:string;category:IssueCategory|'all';scope:IssueScope|'all';impact:'all'|'blocking'|'review';limit:number};
export function issueFilters(params:{get:(name:string)=>string|null}):IssueFilters {
  const category=params.get('tipo'),scope=params.get('origem'),impact=params.get('impacto'),limit=Number(params.get('limite'));
  return {q:(params.get('q') ?? '').slice(0,200),category:ISSUE_CATEGORIES.some(c=>c.id===category) ? category as IssueCategory:'all',
    scope:scope==='publication' || scope==='attempt' ? scope:'all',impact:impact==='blocking' || impact==='review' ? impact:'all',
    limit:Number.isSafeInteger(limit) && limit>=20 ? Math.min(1000,limit):20};
}
export function issueQuery(filters:IssueFilters) {
  const params=new URLSearchParams();
  if(filters.q) params.set('q',filters.q);
  if(filters.category!=='all') params.set('tipo',filters.category);
  if(filters.scope!=='all') params.set('origem',filters.scope);
  if(filters.impact!=='all') params.set('impacto',filters.impact);
  if(filters.limit>20) params.set('limite',String(filters.limit));
  return params.size ? `?${params}`:'';
}
const normalize=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR');
export function filterIssues(items:PendingIssue[],filters:IssueFilters) {
  return items.filter(item=>(filters.category==='all' || item.category===filters.category) && (filters.scope==='all' || item.scope===filters.scope)
    && (filters.impact==='all' || item.blocking===(filters.impact==='blocking')) && normalize([item.title,item.code,...item.messages,
      ...item.subjects.flatMap(s=>[s.artist,s.title]),...item.evidence.flatMap(e=>[e.version,e.locator,e.fileName])].join(' ')).includes(normalize(filters.q.trim())));
}
