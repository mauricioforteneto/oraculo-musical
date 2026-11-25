import { pageSeason } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { AppShell } from "@/components/app-shell";
import { CatalogPage } from "@/components/catalog-page";
import styles from "@/components/catalog-page.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Álbuns · Oráculo Musical" };
export default async function Albums({searchParams = Promise.resolve({})}: {searchParams?:Promise<SeasonParams>} = {}) {
  await requireOwner();
  const context = pageSeason(await searchParams);
  const source = await readPageSource(context);
  return <AppShell season={context.year} title="Álbuns" description="Explore o ranking anual pela nota original e consulte cada avaliação." version={source?.version} headingClassName={styles.pageHeading}>
    <CatalogPage albums={source?.albums ?? []} />
  </AppShell>;
}
