import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireOwner } from "@/lib/auth";
import { pageSeasonDefinition } from "@/lib/seasons/context";
import type { SeasonParams } from "@/lib/seasons/definitions";
import { AppShell } from "@/components/app-shell";
import { RulesContent } from "@/components/rules-content";
export const dynamic = "force-dynamic";
export const metadata = { title: "Regras da temporada · Oráculo Musical" };
export default async function Rules({searchParams}: {searchParams:Promise<SeasonParams>}) {
  await requireOwner();
  const season = pageSeasonDefinition(await searchParams);
  const originalText = await readFile(join(process.cwd(), "docs", "campeonato", `regras-${season.year}.md`), "utf8");
  return <AppShell season={season.year} publicationLabel="Regulamento" title={`Regras de ${season.year}`} description="Regulamento, decisões confirmadas e pontos que continuam em aberto.">
    <RulesContent year={season.year} originalText={originalText} />
  </AppShell>;
}
