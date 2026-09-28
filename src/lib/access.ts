export type Access = "allowed" | "unauthenticated" | "forbidden" | "unconfigured";

export function ownerAccess(ownerId: string | undefined, userId: string | undefined): Access {
  if (!ownerId?.trim()) return "unconfigured";
  if (!userId) return "unauthenticated";
  return ownerId === userId ? "allowed" : "forbidden";
}

export function sameOrigin(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  try { return new URL(expected).origin === actual; } catch { return false; }
}

export function sameOriginFormRequest(request: Request, expected: string | undefined): boolean {
  const origin = request.headers.get("origin");
  if (sameOrigin(origin, expected)) return true;
  if (origin !== "null" || !expected) return false;

  try {
    return new URL(request.url).origin === new URL(expected).origin
      && request.headers.get("sec-fetch-site") === "same-origin"
      && request.headers.get("sec-fetch-mode") === "navigate"
      && request.headers.get("sec-fetch-dest") === "document";
  } catch {
    return false;
  }
}
