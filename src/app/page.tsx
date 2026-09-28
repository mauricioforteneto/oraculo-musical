import { Dashboard } from "@/components/dashboard";
import { getLocalSourcePreview } from "@/lib/catalog/local-preview";
import { authConfigured, requireOwner } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function isLoopbackHost(value: string | null) {
  if (!value) return false;
  const host = value.trim().toLowerCase();
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export default async function Home() {
  const localPreview = process.env.NODE_ENV === "development"
    && !authConfigured()
    && isLoopbackHost((await headers()).get("host"));

  if (!localPreview) await requireOwner();
  const source = await getLocalSourcePreview();
  return <Dashboard source={source} />;
}
