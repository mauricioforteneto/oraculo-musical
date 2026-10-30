import { pageSeason } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import { requireOwner } from '@/lib/auth';
import { readPageSource } from '@/lib/catalog/page-source';
import { loadCompetitionState } from "@/lib/competition/engine";
import { buildIssueReport, type IssueReport } from '@/lib/issues/report';
import { PendingIssuesPage } from '@/components/pending-issues-page';
export const dynamic='force-dynamic';
export const metadata={title:'Pendências · Oráculo Musical'};
export default async function PendingIssues({searchParams = Promise.resolve({})}: {searchParams?:Promise<SeasonParams>} = {}) {
  await requireOwner();
  const context = pageSeason(await searchParams);
  let report:IssueReport|null=null;
  let loadFailed=false;
  try {
    const source=await readPageSource(context);
    const state=await loadCompetitionState(context,source);
    const competition=state.format === "legacy-2026" ? state.data : null;
    report=buildIssueReport(source,competition);
  } catch {
    console.error('Pending issue report load failed');
    loadFailed=true;
  }
  return <PendingIssuesPage key={context.year} season={context.year} report={report} loadFailed={loadFailed}/>;
}
