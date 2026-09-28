import { NextResponse } from "next/server";
import { authClient, authConfigured } from "@/lib/auth";
import { sameOrigin } from "@/lib/access";

export async function POST(request: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!sameOrigin(request.headers.get("origin"), origin)) return new Response("Origem não permitida", { status: 403 });
  if (!authConfigured()) return new Response("Acesso não configurado", { status: 503 });
  const client = await authClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", origin).toString(),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=oauth", origin), 303);
  return NextResponse.redirect(data.url, 303);
}
