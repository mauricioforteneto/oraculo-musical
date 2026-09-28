import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  console.error("Configure DATABASE_MIGRATION_URL no ambiente administrativo.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
let locked = false;
try {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(739126)");
  locked = true;
  await client.query(`CREATE SCHEMA IF NOT EXISTS oraculo_migrations;
    REVOKE ALL ON SCHEMA oraculo_migrations FROM PUBLIC;
    CREATE TABLE IF NOT EXISTS oraculo_migrations.applied (
      name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    );`);
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter(n => /^\d+_.+\.sql$/.test(n)).sort()) {
    const sql = await readFile(new URL(name, directory), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const { rows } = await client.query("SELECT sha256 FROM oraculo_migrations.applied WHERE name=$1", [name]);
    if (rows.length) {
      if (rows[0].sha256 !== hash) throw new Error("MIGRATION_CHECKSUM_MISMATCH");
      console.log(`Já aplicada: ${name}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO oraculo_migrations.applied(name,sha256) VALUES($1,$2)", [name, hash]);
      await client.query("COMMIT");
      console.log(`Aplicada: ${name}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
} catch {
  // Do not print connection strings or raw errors that could disclose credentials.
  console.error("Migração não concluída. Verifique acesso administrativo, versões já aplicadas e compatibilidade do SQL. Nenhum lote incompleto foi confirmado.");
  process.exitCode = 1;
} finally {
  if (locked) await client.query("SELECT pg_advisory_unlock(739126)").catch(() => {});
  await client.end();
}
