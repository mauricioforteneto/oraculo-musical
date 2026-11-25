import { requestSeason } from "@/lib/seasons/context";
import { competitionResponse, noStore, ownerForCompetition } from "@/lib/competition/api";
import { confirmFreeze, type FreezeToken } from "@/lib/competition/service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const access = await ownerForCompetition(request);
  if (access.response) return access.response;
  try {
    const body = await request.json() as { mode?: unknown; token?: FreezeToken; backupAttested?: unknown; eligibilityAttested?: unknown; noMatchAttested?: unknown; reason?: unknown };
    const token = body?.token;
    if (!body || (body.mode !== "initial" && body.mode !== "correction") || !token ||
      ![token.fileId, token.fileVersion, token.driveRevision, token.modifiedAt, token.sha256].every(v => typeof v === "string" && v.length > 0) ||
      !(token.activeFreezeId === null || typeof token.activeFreezeId === "string") ||
      typeof body.backupAttested !== "boolean" || typeof body.eligibilityAttested !== "boolean" ||
      typeof body.noMatchAttested !== "boolean" || typeof body.reason !== "string" || body.reason.length > 2000) {
      return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStore });
    }
    return Response.json(await confirmFreeze({ mode: body.mode, token, backupAttested: body.backupAttested,
      eligibilityAttested: body.eligibilityAttested, noMatchAttested: body.noMatchAttested, reason: body.reason }, access.userId!, requestSeason(request)), { headers: noStore });
  } catch (error) { return competitionResponse(error); }
}
