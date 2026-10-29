import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PUBLISHED_PLAYOFF_RESULTS_SQL } from "../../src/lib/competition/results-query";
import { PLAYOFF_PARSER_REVISION, PLAYOFF_EXTRACTION_VERSION } from "../../src/lib/ingestion/workbook-parser";

let db: PGlite;
const sourceId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  db = new PGlite();
  for (const path of ["db/migrations/0001_foundation.sql", "tests/fixtures/synthetic/foundation.sql",
    "db/migrations/0002_source_publication.sql", "db/migrations/0005_source_competition_results.sql"]) {
    await db.exec(await readFile(path, "utf8"));
  }
  await db.query(`INSERT INTO oraculo.source_competition_results VALUES ($1,$2,'2026.2',1,'{"winner":"legacy"}')`, [sourceId, versionId]);
  await db.exec("BEGIN");
}, 30000);
beforeEach(async () => { await db.exec("SAVEPOINT extraction"); });
afterEach(async () => { await db.exec("ROLLBACK TO SAVEPOINT extraction"); });
afterAll(async () => { if (db) { await db.exec("ROLLBACK"); await db.close(); } });

async function mark(status: string) {
  await db.query(`INSERT INTO oraculo.sync_runs(source_id,requested_by,status,version_id,counts,finished_at)
    VALUES ($1,gen_random_uuid(),$3,$2,$4::jsonb,now())`, [sourceId, versionId, status, JSON.stringify({ playoffParserRevision: PLAYOFF_PARSER_REVISION })]);
}
async function records() {
  return (await db.query<{ record: { winner: string } }>(PUBLISHED_PLAYOFF_RESULTS_SQL,
    [sourceId, versionId, PLAYOFF_EXTRACTION_VERSION, String(PLAYOFF_PARSER_REVISION)])).rows.map(row => row.record.winner);
}

describe("leitura das extrações versionadas de resultados", () => {
  it("preserva resultados anteriores até uma sincronização bem-sucedida do novo parser", async () => {
    expect(await records()).toEqual(["legacy"]);
    await mark("failed");
    expect(await records()).toEqual(["legacy"]);
  });
  it("seleciona uma extração inteira, idempotente, após reprocessar a mesma versão", async () => {
    const sql = `INSERT INTO oraculo.source_competition_results VALUES ($1,$2,$3,1,'{"winner":"current"}') ON CONFLICT DO NOTHING`;
    const params = [sourceId, versionId, PLAYOFF_EXTRACTION_VERSION];
    await db.query(sql, params); await db.query(sql, params);
    await mark("unchanged");
    expect(await records()).toEqual(["current"]);
  });
  it("não ressuscita a extração antiga quando a nova sincronização tem zero resultados", async () => {
    await mark("succeeded");
    expect(await records()).toEqual([]);
  });
});
