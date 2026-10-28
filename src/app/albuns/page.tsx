import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { AppShell } from "@/components/app-shell";
import { CatalogPage } from "@/components/catalog-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Álbuns · Oráculo Musical" };
export default async function Albums() {
  await requireOwner();
  const source = await readPageSource();
  return <AppShell title="Álbuns" description="Explore o ranking anual pela nota original e consulte cada avaliação." version={source?.version}>
    <CatalogPage albums={source?.albums ?? []} />
  </AppShell>;
}
