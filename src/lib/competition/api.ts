import { SeasonError } from "@/lib/seasons/context";
import { authClient, authConfigured } from "@/lib/auth";
import { ownerAccess, sameOrigin } from "@/lib/access";
import { competitionFailure } from "./service";

export const noStore = { "Cache-Control": "private, no-store, max-age=0" };
export async function ownerForCompetition(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), process.env.APP_ORIGIN)) return { response: Response.json({ error: "ORIGIN_REJECTED" }, { status: 403, headers: noStore }) };
  if (!authConfigured()) return { response: Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 401, headers: noStore }) };
  const { data, error } = await (await authClient()).auth.getUser();
  const access = ownerAccess(process.env.OWNER_USER_ID, error ? undefined : data.user?.id);
  if (access !== "allowed") return { response: Response.json({ error: access === "forbidden" ? "FORBIDDEN" : "UNAUTHENTICATED" }, { status: access === "forbidden" ? 403 : 401, headers: noStore }) };
  return { userId: data.user!.id };
}
export function competitionResponse(error: unknown) {
  if (error instanceof SeasonError) return Response.json({ error: error.code }, {status: ["SOURCE_CONFIGURATION_INVALID","SOURCE_NOT_CONFIGURED"].includes(error.code) ? 503 : 400, headers:noStore});
  const { code, status } = competitionFailure(error);
  return Response.json({ error: code }, { status, headers: noStore });
}
