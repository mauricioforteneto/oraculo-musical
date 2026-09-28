import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

// Local: isolated PostgreSQL WASM. CI: a dedicated disposable PostgreSQL service.
let db: { exec: (sql: string) => Promise<unknown>; close: () => Promise<void> };
beforeAll(async () => {
  if (process.env.DATABASE_TEST_URL) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_TEST_URL });
    await client.connect();
    db = { exec: sql => client.query(sql), close: () => client.end() };
  } else {
    db = new PGlite();
  }
  await db.exec("BEGIN");
  await db.exec(await readFile("db/migrations/0001_foundation.sql", "utf8"));
  await db.exec(await readFile("tests/fixtures/synthetic/foundation.sql", "utf8"));
}, 30000);
afterAll(async () => { if (db) { await db.exec("ROLLBACK"); await db.close(); } });

async function denied(role: string, sql: string) {
  await db.exec("SAVEPOINT permission_test");
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await expect(db.exec(sql)).rejects.toMatchObject({ code: "42501" });
  } finally { await db.exec("ROLLBACK TO SAVEPOINT permission_test"); }
}

describe("permissões reais do banco", () => {
  it("leitor consulta e não modifica avaliações", async () => {
    await db.exec("SET LOCAL ROLE oraculo_reader");
    await expect(db.exec("SELECT total FROM oraculo.original_evaluations")).resolves.toBeDefined();
    await db.exec("RESET ROLE");
    await denied("oraculo_reader", "UPDATE oraculo.original_evaluations SET total=99");
    await denied("oraculo_reader", "DELETE FROM oraculo.original_evaluations");
    await denied("oraculo_reader", "INSERT INTO oraculo.import_issues(sync_run_id,code,severity,message) VALUES(gen_random_uuid(),'x','warning','x')");
  });
  it("sincronizador não sobrescreve originais nem cria fontes", async () => {
    await denied("oraculo_sync", "UPDATE oraculo.original_evaluations SET total=80");
    await denied("oraculo_sync", "DELETE FROM oraculo.source_versions");
    await denied("oraculo_sync", "INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,'other')");
  });
  it("sincronizador pode registrar uma tentativa e finalizar seu estado", async () => {
    await db.exec("SET LOCAL ROLE oraculo_sync");
    await db.exec(`INSERT INTO oraculo.sync_runs(id,source_id,requested_by,status)
      VALUES('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',gen_random_uuid(),'running')`);
    await db.exec("UPDATE oraculo.sync_runs SET status='failed',finished_at=now(),error_code='SYNTHETIC' WHERE id='00000000-0000-4000-8000-000000000004'");
    await db.exec("RESET ROLE");
  });
  it("banco rejeita soma incorreta e notas fora da escala", async () => {
    for (const changes of ["total=79", "sound=26", "total=-1"]) {
      await db.exec("SAVEPOINT invalid_score");
      await expect(db.exec(`UPDATE oraculo.original_evaluations SET ${changes}`)).rejects.toMatchObject({ code: "23514" });
      await db.exec("ROLLBACK TO SAVEPOINT invalid_score");
    }
  });
});
