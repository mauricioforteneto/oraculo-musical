import "server-only";
import { databasePool } from "@/lib/db/pool";
import { buildCompetitionPhaseHistory, type VersionedAlbumEvidence } from "./history";

export async function getCompetitionPhaseHistory(season: number, folderId: string, sourceVersion: string) {
  const result = await databasePool("read").query<{
    identity_key: string;
    version: string;
    current: boolean;
    record: VersionedAlbumEvidence["record"];
  }>(`SELECT a.identity_key, v.version::text, (v.id = p.source_version_id) AS current, r.record
        FROM oraculo.sources s
        JOIN oraculo.source_publications p ON p.source_id = s.id
        JOIN oraculo.source_versions published ON published.id = p.source_version_id
        JOIN oraculo.source_album_records r ON r.source_id = s.id
        JOIN oraculo.source_versions v ON v.id = r.source_version_id AND v.version <= published.version
        JOIN oraculo.albums a ON a.id = r.album_id
       WHERE s.season = $1 AND s.folder_id = $2
       ORDER BY v.version, a.identity_key`, [season, folderId]);
  return buildCompetitionPhaseHistory(result.rows.map(row => ({
    identityKey: row.identity_key, version: row.version, current: row.current, record: row.record,
  })), sourceVersion);
}
