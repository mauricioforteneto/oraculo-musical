import { NextResponse } from "next/server";
import { authClient, authConfigured } from "@/lib/auth";
import { sameOriginFormRequest } from "@/lib/access";
export async function POST(request: Request) {
  if (!sameOriginFormRequest(request, process.env.APP_ORIGIN)) return new Response("Origem não permitida", { status: 403 });
  if (authConfigured()) await (await authClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", process.env.APP_ORIGIN!), 303);
}
