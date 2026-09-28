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
