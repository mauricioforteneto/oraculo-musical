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
  const consolidatedText = season.year===2026 ? await readFile(join(process.cwd(), "docs", "campeonato", "regras-2026-vigentes.md"), "utf8") : undefined;
  return <AppShell season={season.year} publicationLabel="Regulamento" title={`Regras de ${season.year}`}>
    <RulesContent year={season.year} originalText={originalText} consolidatedText={consolidatedText} />
  </AppShell>;
}
