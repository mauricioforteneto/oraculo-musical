import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ownerAccess } from "./access";

export function authConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.OWNER_USER_ID);
}

export async function authClient() {
  if (!authConfigured()) throw new Error("AUTH_NOT_CONFIGURED");
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server Components cannot write; proxy refreshes before render. */ }
      },
    },
  });
}

export async function requireOwner() {
  if (!authConfigured()) redirect("/login");
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  const access = ownerAccess(process.env.OWNER_USER_ID, error ? undefined : data.user?.id);
  if (access !== "allowed") redirect(access === "forbidden" ? "/login?error=access" : "/login");
  return data.user!;
}
