import "server-only";
import type { LocalSourcePreview } from "@/lib/catalog/types";
import type { SeasonContext } from "@/lib/seasons/context";
import { getCompetitionState } from "./service";
import { buildMonthlyState, type MonthlyState } from "./monthly";
export type CompetitionState =
  | { format: "legacy-2026"; data: Awaited<ReturnType<typeof getCompetitionState>> | null }
  | { format: "monthly"; data: MonthlyState };
export async function loadCompetitionState(context: SeasonContext, source: LocalSourcePreview | null): Promise<CompetitionState> {
  if (context.format === "monthly") return { format: "monthly", data: source?.monthly ?? { ...buildMonthlyState(source?.albums ?? []), storageReady: false } };
  return { format: "legacy-2026", data: source?.version != null ? await getCompetitionState(source.albums, source.playoffResults, source.top50Decisions, context) : null };
}
