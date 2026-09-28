import { NextResponse } from "next/server";
import { authClient, authConfigured } from "@/lib/auth";
import { ownerAccess } from "@/lib/access";

export async function GET(request: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!origin || !authConfigured()) return new Response("Acesso não configurado", { status: 503 });
  // Never trust next, Host or forwarded headers for the redirect destination.
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const fail = () => NextResponse.redirect(new URL("/login?error=oauth", origin), 303);
  if (params.has("error") || !code || code.length > 4096) return fail();
  const client = await authClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return fail();
  const { data, error: userError } = await client.auth.getUser();
  if (userError || ownerAccess(process.env.OWNER_USER_ID, data.user?.id) !== "allowed") {
    await client.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/login?error=access", origin), 303);
  }
  return NextResponse.redirect(new URL("/", origin), 303);
}
