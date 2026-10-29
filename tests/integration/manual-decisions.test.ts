import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { syntheticManualWorkbook } from "../fixtures/synthetic/manual-decisions";
import { parseWorkbookSheets } from "../../src/lib/ingestion/workbook-parser";
import { buildParticipants } from "../../src/lib/competition/rules";
import { projectTop50 } from "../../src/lib/competition/top50";
import { buildIssueReport } from "../../src/lib/issues/report";
const shared = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), latest: vi.fn(), download: vi.fn(), parse: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/pool", () => ({ databasePool: () => ({ connect: shared.connect, query: shared.query }) }));
vi.mock("@/lib/ingestion/google", () => ({ configuredDriveReader: () => ({ latest: shared.latest, download: shared.download }) }));
vi.mock("../../src/lib/ingestion/workbook", async () => ({
  ...await vi.importActual<typeof import("../../src/lib/ingestion/workbook")>("../../src/lib/ingestion/workbook"), parseSourceWorkbook: shared.parse,
}));
import { syncDriveSource } from "../../src/lib/ingestion/sync-service";
import { getPublishedSource } from "../../src/lib/catalog/database";

let db: PGlite;
let folder: string;
let sourceId: string;
let sequence = 0;
const owner = "00000000-0000-4000-8000-000000000099";
beforeAll(async () => {
  db = new PGlite();
  for (const file of (await readdir("db/migrations")).filter(name => name.endsWith(".sql")).sort())
    await db.exec(await readFile(`db/migrations/${file}`, "utf8"));
  shared.query.mockImplementation(async (sql: string, params: unknown[]) => {
    const result = await db.query(sql, params);
    return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
  });
  shared.connect.mockResolvedValue({ query: shared.query, release: vi.fn() });
}, 30000);
beforeEach(async () => {
  folder = `synthetic-manual-${++sequence}`;
  sourceId = (await db.query<{ id: string }>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,$1) RETURNING id", [folder])).rows[0].id;
  vi.stubEnv("SOURCE_SEASON", "2026"); vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", folder);
  candidate("105");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await db?.close(); });

function candidate(version: string, decisions = true) {
  shared.latest.mockResolvedValue({ sourceVersion: version, file: { id: `synthetic-${version}`, name: `synthetic-v${version}.xlsx`,
    modifiedTime: "2026-10-29T00:00:00Z", version: "1", parents: [folder] } });
  shared.download.mockResolvedValue({ bytes: new Uint8Array(), sha256: (version === "105" ? "a" : "b").repeat(64) });
  const sheets = syntheticManualWorkbook();
  shared.parse.mockResolvedValue(parseWorkbookSheets(decisions ? sheets : sheets.slice(0, -1), { season: 2026, sourceVersion: version }));
}
async function sync() {
  await db.exec("SET ROLE oraculo_sync");
  try { return await syncDriveSource(owner); } finally { await db.exec("RESET ROLE"); }
}
async function published() {
  await db.exec("SET ROLE oraculo_reader");
  try { return (await getPublishedSource(2026, folder))!; } finally { await db.exec("RESET ROLE"); }
}
describe("publicação e leitura de decisões manuais", () => {
  it("publica com as permissões reais, preserva proveniência e resolve o empate a partir do banco", async () => {
    expect((await sync()).status).toBe("succeeded");
    const source = await published();
    expect(source.top50DecisionsReady).toBe(true); expect(source.top50Decisions).toHaveLength(3);
    expect(source.top50Decisions![0]).toMatchObject({ sourceSheet: "Desempates Top 50", sourceRow: 2, confirmedBy: "Proprietário fictício" });
    expect(source.playoffResults).toHaveLength(8);
    const participants = buildParticipants(source.albums).participants;
    const p = projectTop50(source.albums, participants, source.playoffResults, null, source.top50Decisions)!;
    expect(p.tieAtCut).toBe(false); expect(p.appliedDecisions).toHaveLength(1);
    expect(p.entries.filter(e => e.manualDecisionId).map(e => e.position)).toEqual([49, 50, null]);
  });
  it("reprocessa a mesma versão e não perde resultados extraídos antes do parser 2026.4", async () => {
    await sync();
    await db.query("DELETE FROM oraculo.source_top50_decisions WHERE source_id=$1", [sourceId]);
    await db.query(`UPDATE oraculo.sync_runs SET counts='{"playoffParserRevision":3}' WHERE source_id=$1`, [sourceId]);
    const before = await published();
    expect(before.top50Decisions).toEqual([]); expect(before.playoffResults).toHaveLength(8);
    expect(before.top50DecisionsExtracted).toBe(false);
    expect(buildIssueReport(before, null).notices.join()).toContain('Sincronize novamente');
    expect((await sync()).status).toBe("unchanged"); expect((await sync()).status).toBe("unchanged");
    expect((await published()).top50Decisions).toHaveLength(3);
    expect((await published()).top50DecisionsExtracted).toBe(true);
    expect((await db.query<{ count: string }>("SELECT count(*)::text FROM oraculo.source_top50_decisions WHERE source_id=$1", [sourceId])).rows[0].count).toBe("3");
  });
  it("preserva a decisão publicada quando uma candidata é recusada", async () => {
    await sync(); candidate("106");
    const parsed = await shared.parse(); parsed.albums[0].originalScore = 99;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { await expect(sync()).rejects.toMatchObject({ code: "ORIGINAL_SCORE_CHANGED" }); } finally { log.mockRestore(); }
    const source = await published();
    expect(source.version).toBe("105"); expect(source.lastAttempt?.status).toBe("failed");
    expect(source.top50Decisions).toHaveLength(3); expect(source.playoffResults).toHaveLength(8);
  });
  it("não recupera decisões de versão anterior quando a nova publicação não tem tabela", async () => {
    await sync(); candidate("106", false); await sync();
    const source = await published();
    expect(source.version).toBe("106"); expect(source.top50Decisions).toEqual([]);
    expect(source.playoffResults).toHaveLength(8);
    expect(projectTop50(source.albums, buildParticipants(source.albums).participants, source.playoffResults, null, source.top50Decisions)!.tieAtCut).toBe(true);
    expect((await db.query<{ count: string }>("SELECT count(*)::text FROM oraculo.source_top50_decisions WHERE source_id=$1", [sourceId])).rows[0].count).toBe("3");
  });
  it("não associa decisões a outra fonte nem a uma extração sem sucesso", async () => {
    await sync();
    const foreign = (await db.query<{ id: string }>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,'foreign-manual') RETURNING id")).rows[0].id;
    const version = (await db.query<{ id: string }>(`INSERT INTO oraculo.source_versions(source_id,version,drive_file_id,file_name,modified_at,sha256,parser_version)
      VALUES($1,105,'foreign','foreign.xlsx',now(),repeat('c',64),'2026.4') RETURNING id`, [foreign])).rows[0].id;
    await db.query(`INSERT INTO oraculo.source_top50_decisions SELECT $1,$2,parser_revision,item_order,record FROM oraculo.source_top50_decisions WHERE source_id=$3`, [foreign, version, sourceId]);
    await db.query("INSERT INTO oraculo.source_publications VALUES($1,$2,now())", [foreign, version]);
    await db.query(`INSERT INTO oraculo.sync_runs(source_id,version_id,requested_by,status,finished_at,counts)
      VALUES($1,$2,$3,'failed',now(),'{"top50DecisionParserRevision":1}')`, [foreign, version, owner]);
    expect((await getPublishedSource(2026, "foreign-manual"))!.top50Decisions).toEqual([]);
    expect((await published()).top50Decisions).toHaveLength(3);
  });
  it("mantém o catálogo consultável antes da migração e informa que decisões estão indisponíveis", async () => {
    await sync(); await db.exec("BEGIN; ALTER TABLE oraculo.source_top50_decisions RENAME TO decisions_temporarily_unavailable");
    try {
      const source = await published();
      expect(source.top50DecisionsReady).toBe(false); expect(source.albums.length).toBeGreaterThan(0);
      expect(buildIssueReport(source, null).notices.join()).toContain("migração 0008");
    } finally { await db.exec("ROLLBACK"); }
  });
});
