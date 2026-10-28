// Backlog remains part of ingestion; only its nonblocking UI warnings are hidden.
export function visibleIssue(issue: { severity: string; code: string; sourceLocator?: string; message: string }) {
  return issue.severity === "error" || !/backlog/i.test([issue.code, issue.sourceLocator, issue.message].join(" "));
}
