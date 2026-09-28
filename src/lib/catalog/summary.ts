export function parseSummaryNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = /[-+]?\d+(?:[.,]\d+)?/.exec(value);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
