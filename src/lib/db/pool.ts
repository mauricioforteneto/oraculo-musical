import "server-only";
import pg, { type Pool } from "pg";

type DatabaseRole = "read" | "sync";
type PoolStore = Partial<Record<DatabaseRole, Pool>>;
const globalPools = globalThis as typeof globalThis & { __oraculoPools?: PoolStore };

export function databasePool(role: DatabaseRole): Pool {
  const key = role === "read" ? "DATABASE_READ_URL" : "DATABASE_SYNC_URL";
  const connectionString = process.env[key];
  if (!connectionString) throw new Error(role === "read" ? "DATABASE_READ_NOT_CONFIGURED" : "DATABASE_SYNC_NOT_CONFIGURED");

  const pools = globalPools.__oraculoPools ?? (globalPools.__oraculoPools = {});
  if (!pools[role]) pools[role] = new pg.Pool({ connectionString, max: role === "sync" ? 2 : 4, idleTimeoutMillis: 10_000 });
  return pools[role]!;
}
