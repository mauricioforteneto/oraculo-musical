import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { readPageSource } from "@/lib/catalog/page-source";
import { rankAnnualAlbums } from "@/lib/catalog/ranking";
import { catalogFilters, catalogQuery } from "@/lib/catalog/catalog-navigation";
import { AppShell } from "@/components/app-shell";
import { AlbumDetails } from "@/components/album-details";
import styles from "@/components/workspace.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliação · Oráculo Musical" };
export default async function Album({ params, searchParams }: { params: Promise<{id: string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  // The configured source is the only lookup scope, including retained absent records.
  const source = await readPageSource();
  const album = rankAnnualAlbums(source?.albums ?? []).find(a => a.albumId === id);
  if (!album) notFound();
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["q","nota","limite"]) if (typeof values[key] === "string") query.set(key,values[key]);
  return <AppShell title="Detalhe do álbum" description="A avaliação original e os registros informados pela fonte." version={source?.version}>
    <div className={styles.stack}>
      <div><Link className={styles.action} href={`/albuns${catalogQuery(catalogFilters(query))}`}>← Voltar aos álbuns</Link></div>
      {album.isPresent === false && <p className={styles.muted}>Este álbum não consta na versão atual. A última avaliação conhecida está preservada.</p>}
      <AlbumDetails album={album} />
      <p className={styles.muted}>Álbuns {process.env.SOURCE_SEASON ?? "2026"} · linha {album.sourceRow}{album.isPresent === false ? " · última ocorrência conhecida" : ` · publicação v${source?.version}`}</p>
    </div>
  </AppShell>;
}
