import { requireOwner } from '@/lib/auth';
import { readPageSource } from '@/lib/catalog/page-source';
import { getCompetitionState } from '@/lib/competition/service';
import { buildIssueReport, type IssueReport } from '@/lib/issues/report';
import { PendingIssuesPage } from '@/components/pending-issues-page';
export const dynamic='force-dynamic';
export const metadata={title:'Pendências · Oráculo Musical'};
export default async function PendingIssues() {
  await requireOwner();
  let report:IssueReport|null=null;
  let loadFailed=false;
  try {
    const source=await readPageSource();
    const competition=source?.version!=null ? await getCompetitionState(source.albums,source.playoffResults):null;
    report=buildIssueReport(source,competition);
  } catch {
    console.error('Pending issue report load failed');
    loadFailed=true;
  }
  return <PendingIssuesPage report={report} loadFailed={loadFailed}/>;
}
