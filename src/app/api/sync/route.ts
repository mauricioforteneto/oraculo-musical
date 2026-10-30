import { requestSeason, SeasonError } from "@/lib/seasons/context";
import { authClient, authConfigured } from "@/lib/auth";
import { ownerAccess, sameOrigin } from "@/lib/access";
import { syncDriveSource, SyncServiceError } from "@/lib/ingestion/sync-service";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function statusFor(code: string) {
  if (["SYNC_IN_PROGRESS", "SYNC_LEASE_LOST", "AMBIGUOUS_VERSION", "FILE_CHANGED_DURING_READ", "SOURCE_VERSION_CONTENT_CONFLICT", "SOURCE_VERSION_REGRESSION", "SOURCE_VERSION_NOT_CURRENT", "IDENTITY_CHANGE_AMBIGUOUS", "ORIGINAL_SCORE_CHANGED", "ORIGINAL_PILLARS_CHANGED"].includes(code)) return 409;
  if (["INVALID_SEASON", "SEASON_UNAVAILABLE"].includes(code)) return 400;
  if (["WORKBOOK_INVALID", "FILE_TOO_LARGE", "INVALID_XLSX", "INVALID_XLSX_CONTAINER", "WORKBOOK_LIMIT_EXCEEDED", "INVALID_SEASON", "VERSION_OUT_OF_RANGE"].includes(code)) return 422;
  if (["DRIVE_NOT_CONFIGURED", "DATABASE_SYNC_NOT_CONFIGURED", "SOURCE_NOT_REGISTERED", "SOURCE_CONFIGURATION_AMBIGUOUS", "SOURCE_NOT_CONFIGURED", "SYNC_STORAGE_UNAVAILABLE"].includes(code)) return 503;
  if (["SOURCE_NOT_FOUND", "DRIVE_ACCESS_DENIED", "DRIVE_UNAVAILABLE", "DRIVE_RETRY_LATER", "INCOMPLETE_DRIVE_LIST", "DRIVE_LIST_LIMIT"].includes(code)) return 502;
  return 500;
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), process.env.APP_ORIGIN)) {
    return Response.json({ error: "ORIGIN_REJECTED" }, { status: 403, headers: noStore });
  }
  if (!authConfigured()) return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 401, headers: noStore });

  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  const access = ownerAccess(process.env.OWNER_USER_ID, error ? undefined : data.user?.id);
  if (access === "unauthenticated" || access === "unconfigured") {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: noStore });
  }
  if (access === "forbidden") return Response.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });

  try {
    const result = await syncDriveSource(data.user!.id, requestSeason(request));
    return Response.json(result, { headers: noStore });
  } catch (cause) {
    const code = cause instanceof SyncServiceError || cause instanceof SeasonError ? cause.code : "SYNC_FAILED";
    const issues = cause instanceof SyncServiceError ? cause.issues : [];
    return Response.json({ error: code, issues }, { status: statusFor(code), headers: noStore });
  }
}
