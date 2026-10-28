import "server-only";
import { databasePool } from "@/lib/db/pool";
import { loadVersionHistory } from "./version-history-data";

export async function getVersionHistory(season: number, folder: string, version?: unknown, page?: unknown) {
  if (!Number.isInteger(season) || !folder) return null;
  const client = await databasePool("read").connect();
  try {
    // A publication can advance while this page loads. Keep the list, counts
    // and both snapshots on the same database view without locking writers.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const history = await loadVersionHistory((sql, params) => client.query(sql, params), season, folder, version, page);
    await client.query("COMMIT");
    return history;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
