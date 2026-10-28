import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { loadVersionHistory, type HistoryQuery } from "../../src/lib/catalog/version-history-data";

let db: PGlite; let source: string; let foreign: string;
const versions = new Map<number, string>();
const albumIds = new Map<string, string>();
const firstResult = { seedA: 9, artistA: "A", seedB: 24, artistB: "B", winner: "A (#9)", result: "13 × 12", sourceRow: 12 };
const album = (artist: string, genre = "Rock") => ({ artist, title: `Disco ${artist}`, genre, originalScore: 80 });
const backlog = (artist: string, order = 1) => ({ artist, title: `Backlog ${artist}`, order, priority: "Normal", source: "Referência fictícia" });

async function addVersion(n: number, albums: Record<string, unknown>[], items: Record<string, unknown>[], results: Record<string, unknown>[],
  options: { source?: string; status?: string; parser?: string; counts?: Record<string, unknown> } = {}) {
  const sid = options.source ?? source;
  const id = (await db.query<{ id: string }>(`INSERT INTO oraculo.source_versions(source_id,version,drive_file_id,file_name,modified_at,sha256,parser_version)
    VALUES($1,$2,'synthetic-file',$3,'2026-01-01T00:00:00Z',repeat('a',64),$4) RETURNING id`, [sid, n, `synthetic-v${n}.xlsx`, options.parser ?? "2026.2"])).rows[0].id;
  for (const r of albums) {
    const key = `${sid}:${r.artist}`;
    if (!albumIds.has(key)) albumIds.set(key, (await db.query<{ id: string }>(`INSERT INTO oraculo.albums(source_id,identity_key,artist,title)
      VALUES($1,$2,$3,$4) RETURNING id`, [sid, `synthetic-key-${r.artist}`, r.artist, r.title])).rows[0].id);
    await db.query(`INSERT INTO oraculo.source_album_records VALUES($1,$2,$3,'Synthetic!2',$4::jsonb)`, [sid, id, albumIds.get(key), JSON.stringify(r)]);
  }
  for (const [i, r] of items.entries()) await db.query(`INSERT INTO oraculo.source_backlog_records VALUES($1,$2,$3,$4::jsonb)`, [sid, id, i + 1, JSON.stringify(r)]);
  for (const [i, r] of results.entries()) await db.query(`INSERT INTO oraculo.source_competition_results VALUES($1,$2,'2026.2',$3,$4::jsonb)`, [sid, id, i + 1, JSON.stringify(r)]);
  await db.query(`INSERT INTO oraculo.sync_runs(source_id,version_id,requested_by,status,finished_at,counts)
    VALUES($1,$2,gen_random_uuid(),$3,'2026-01-02T00:00:00Z',$4::jsonb)`, [sid, id, options.status ?? "succeeded", JSON.stringify(options.counts ?? { albums: albums.length, backlog: items.length })]);
  if (sid === source) versions.set(n, id);
  return id;
}
const query: HistoryQuery = async (sql, params) => {
  expect(sql.trim()).toMatch(/^(WITH|SELECT)/i);
  return db.query(sql, params);
};

beforeAll(async () => {
  db = new PGlite();
  for (const file of ["0001_foundation.sql", "0002_source_publication.sql", "0005_source_competition_results.sql"]) await db.exec(await readFile(`db/migrations/${file}`, "utf8"));
  source = (await db.query<{ id: string }>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,'history-source') RETURNING id")).rows[0].id;
  foreign = (await db.query<{ id: string }>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,'other-source') RETURNING id")).rows[0].id;
  await addVersion(9, [album("A")], [backlog("Café")], [], { parser: "2026.1" });
  await addVersion(81, [album("A")], [backlog("Cafe\u0301")], [firstResult]);
  await addVersion(84, [album("B")], [], []);
  await addVersion(99, [album("B"), album("C")], [backlog("Y")], [firstResult]);
  await addVersion(100, [album("A", "Jazz"), album("B", "Pop"), album("D")], [backlog("Café", 2), backlog("Y")],
    [{ ...firstResult, phase: "first", gameId: "Jogo 01", sourceSheet: "Resultados Playoffs", sourceRow: 2 }]);
  await addVersion(98, [album("FALHOU")], [], [], { status: "failed" });
  await addVersion(102, [album("FUTURO")], [], []);
  const otherVersion = await addVersion(50, [album("OUTRA FONTE")], [], [], { source: foreign });
  await db.query("INSERT INTO oraculo.source_publications VALUES($1,$2,now()),($3,$4,now())", [source, versions.get(100), foreign, otherVersion]);
  await db.exec("BEGIN");
}, 30000);
beforeEach(async () => { await db.exec("SAVEPOINT history_test"); });
afterEach(async () => { await db.exec("ROLLBACK TO SAVEPOINT history_test; RESET ROLE"); });
afterAll(async () => { if (db) { await db.exec("ROLLBACK"); await db.close(); } });

describe("histórico publicado no banco", () => {
  it("compara com a anterior importada e busca a evidência de reaparecimento sem precisar de UUID JSON", async () => {
    await db.exec("SET LOCAL ROLE oraculo_reader");
    const history = (await loadVersionHistory(query, 2026, "history-source"))!;
    expect(history.versions.map(v => v.version)).toEqual(["100", "99", "84", "81", "9"]);
    expect(history.previous!.version).toBe("99");
    expect(history.comparison.blocks.albums.changes.map(c => c.kind).sort()).toEqual(["absent", "added", "changed", "reappeared"]);
    expect(history.comparison.blocks.albums.changes.find(c => c.kind === "reappeared")!.before!.version).toBe("81");
    expect(history.comparison.blocks.backlog.changes.find(c => c.kind === "reappeared")!.before!.version).toBe("81");
    expect(history.comparison.blocks.playoffs.changes).toEqual([]);
  });
  it("reconhece resultados que voltaram a constar e blocos vazios comprovados", async () => {
    const history = (await loadVersionHistory(query, 2026, "history-source", "99"))!;
    expect(history.previous!.version).toBe("84");
    expect(history.comparison.blocks.backlog.status).toBe("ready");
    expect(history.comparison.blocks.playoffs.changes[0]).toMatchObject({ kind: "reappeared" });
    expect(history.comparison.blocks.playoffs.changes[0].before!.version).toBe("81");
  });
  it("não confunde extração antiga indisponível com resultado ausente", async () => {
    const history = (await loadVersionHistory(query, 2026, "history-source", "81"))!;
    expect(history.comparison.blocks.playoffs).toMatchObject({ status: "unavailable", changes: [] });
    const first = (await loadVersionHistory(query, 2026, "history-source", "9"))!;
    expect(first.previous).toBeNull(); expect(first.comparison.blocks.albums.status).toBe("baseline");
  });
  it("valida parâmetros, exclui versões falhas/futuras e não vaza dados de outra fonte", async () => {
    for (const version of ["50", "98", "102", "100 OR 1=1", ["100", "99"]]) {
      const history = (await loadVersionHistory(query, 2026, "history-source", version))!;
      expect(history.selected.version).toBe("100"); expect(history.notices.length).toBeGreaterThan(0);
      expect(JSON.stringify(history)).not.toContain("OUTRA FONTE");
    }
    expect(await loadVersionHistory(query, 2025, "history-source")).toBeNull();
    expect(await loadVersionHistory(query, 2026, "missing-folder")).toBeNull();
  });
  it("pagina numericamente em lotes de vinte e valida páginas inexistentes", async () => {
    for (let n = 10; n < 34; n++) await addVersion(n, [], [], []);
    const history = (await loadVersionHistory(query, 2026, "history-source"))!;
    expect(history.versions).toHaveLength(20); expect(history.hasMore).toBe(true);
    const older = (await loadVersionHistory(query, 2026, "history-source", "100", "2"))!;
    expect(older.page).toBe(2); expect(older.versions.at(-1)!.version).toBe("9"); expect(older.selected.version).toBe("100");
    const invalid = (await loadVersionHistory(query, 2026, "history-source", "100", "999"))!;
    expect(invalid.page).toBe(1); expect(invalid.notices.length).toBeGreaterThan(0);
  });
  it("usa a extração nova inteira, inclusive vazia, após reprocessamento", async () => {
    await db.query(`INSERT INTO oraculo.sync_runs(source_id,version_id,requested_by,status,finished_at,counts)
      VALUES($1,$2,gen_random_uuid(),'unchanged',now(),'{"playoffParserRevision":3}')`, [source, versions.get(100)]);
    const history = (await loadVersionHistory(query, 2026, "history-source"))!;
    expect(history.comparison.blocks.playoffs.status).toBe("ready");
    expect(history.comparison.blocks.playoffs.changes).toHaveLength(1);
    expect(history.comparison.blocks.playoffs.changes[0].kind).toBe("absent");
  });
});
