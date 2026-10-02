import { Dashboard } from "@/components/dashboard";
import { getLocalSourcePreview } from "@/lib/catalog/local-preview";
import { getPublishedSource } from "@/lib/catalog/database";
import { authConfigured, requireOwner } from "@/lib/auth";
import { headers } from "next/headers";
import { getCompetitionState } from "@/lib/competition/service";
import { albumIdentity } from "@/lib/competition/rules";
import { buildCompetitionPhaseHistory } from "@/lib/competition/history";
import { getCompetitionPhaseHistory } from "@/lib/competition/history-database";

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
  const season = Number(process.env.SOURCE_SEASON ?? "2026");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
  const usingPreview = process.env.NODE_ENV === "development" && !process.env.DATABASE_READ_URL;
  const localPreview = usingPreview
    && !authConfigured()
    && isLoopbackHost((await headers()).get("host"));

  if (!localPreview) await requireOwner();
  const source = usingPreview
    ? await getLocalSourcePreview()
    : process.env.DATABASE_READ_URL ? await getPublishedSource(season, folderId) : null;
  const syncReady = !usingPreview && authConfigured()
    && Boolean(process.env.DATABASE_READ_URL && process.env.DATABASE_SYNC_URL && process.env.GOOGLE_DRIVE_FOLDER_ID
      && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  const competition = !usingPreview && source?.version ? await getCompetitionState(source.albums) : null;
  const competitionHistory = source?.version
    ? usingPreview
      ? buildCompetitionPhaseHistory(source.albums.map(album => ({
          identityKey: albumIdentity(album, season),
          version: String(source.version), current: true, record: album,
        })), String(source.version))
      : await getCompetitionPhaseHistory(season, folderId, String(source.version))
    : null;
  return <Dashboard source={source} syncReady={syncReady} localPreview={usingPreview} competition={competition} competitionHistory={competitionHistory} />;
}
