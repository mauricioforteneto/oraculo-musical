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
  await db.exec(await readFile("db/migrations/0002_source_publication.sql", "utf8"));
  await db.exec(await readFile("db/migrations/0003_competition_freeze.sql", "utf8"));
  await db.exec(await readFile("db/migrations/0004_freeze_attestations.sql", "utf8"));
  await db.exec(await readFile("db/migrations/0008_top50_manual_decisions.sql", "utf8"));
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
  it("preserva decisões importadas como registros imutáveis para os papéis de execução", async () => {
    await denied("oraculo_reader", "INSERT INTO oraculo.source_top50_decisions VALUES(gen_random_uuid(),gen_random_uuid(),1,1,'{}')");
    await denied("oraculo_sync", "UPDATE oraculo.source_top50_decisions SET record='{}'");
    await denied("oraculo_sync", "DELETE FROM oraculo.source_top50_decisions");
  });
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
  it("mantém snapshot imutável e troca apenas o ponteiro de forma auditável", async () => {
    const source = "00000000-0000-4000-8000-000000000001";
    const first = "00000000-0000-4000-8000-000000000011";
    const second = "00000000-0000-4000-8000-000000000012";
    await db.exec("SET LOCAL ROLE oraculo_sync");
    await db.exec(`INSERT INTO oraculo.competition_freezes
      (id,source_id,season,drive_file_id,file_name,file_version,drive_revision,modified_at,sha256,cutoff_album_keys,rules_version,parser_version,frozen_by,backup_attested)
      VALUES ('${first}','${source}',2026,'f1','synthetic-v1.xlsx',1,'1','2026-09-30T23:00:00Z',repeat('a',64),'[]','test','test',gen_random_uuid(),true)`);
    await db.exec(`INSERT INTO oraculo.competition_freeze_participants
      (freeze_id,identity_key,artist,title,original_score,route,seed,source_row)
      VALUES ('${first}','synthetic-identity','Fictional Artist','Fictional Album',90,'elite',1,2)`);
    await db.exec(`INSERT INTO oraculo.competition_freeze_publications(source_id,freeze_id) VALUES('${source}','${first}')`);
    await db.exec(`INSERT INTO oraculo.competition_freezes
      (id,source_id,season,drive_file_id,file_name,file_version,drive_revision,modified_at,sha256,cutoff_album_keys,rules_version,parser_version,frozen_by,supersedes_id,correction_reason,eligibility_attested,backup_attested,no_match_attested)
      VALUES ('${second}','${source}',2026,'f2','synthetic-v2.xlsx',2,'1','2026-10-01T04:00:00Z',repeat('b',64),'[]','test','test',gen_random_uuid(),'${first}','Correção fictícia auditada',true,true,true)`);
    await db.exec(`UPDATE oraculo.competition_freeze_publications SET freeze_id='${second}' WHERE source_id='${source}'`);
    await db.exec("RESET ROLE");
    await denied("oraculo_sync", `UPDATE oraculo.competition_freezes SET sha256=repeat('c',64) WHERE id='${first}'`);
    await denied("oraculo_sync", `DELETE FROM oraculo.competition_freeze_participants WHERE freeze_id='${first}'`);
    await denied("oraculo_reader", `UPDATE oraculo.competition_freeze_publications SET freeze_id='${first}' WHERE source_id='${source}'`);
    await db.exec(`DO $$ BEGIN IF (SELECT freeze_id FROM oraculo.competition_freeze_publications WHERE source_id='${source}') <> '${second}'::uuid THEN RAISE EXCEPTION 'pointer mismatch'; END IF; END $$`);
  });
});
