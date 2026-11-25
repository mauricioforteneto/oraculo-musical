import { requestSeason } from "@/lib/seasons/context";
import { competitionResponse, noStore, ownerForCompetition } from "@/lib/competition/api";
import { previewFreeze } from "@/lib/competition/service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const access = await ownerForCompetition(request);
  if (access.response) return access.response;
  try {
    const body = await request.json() as { mode?: unknown };
    if (!body || (body.mode !== "initial" && body.mode !== "correction")) return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStore });
    return Response.json(await previewFreeze(body.mode, requestSeason(request)), { headers: noStore });
  } catch (error) { return competitionResponse(error); }
}
