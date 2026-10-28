import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { syntheticAlbum } from "../fixtures/synthetic/top50";
const shared = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/pool", () => ({ databasePool: () => ({ connect: shared.connect }) }));
import { getPublishedSource } from "../../src/lib/catalog/database";
let db: PGlite;
const ids: string[] = [];
beforeAll(async () => {
  db = new PGlite();
  for (const file of ["0001_foundation.sql","0002_source_publication.sql","0005_source_competition_results.sql"]) await db.exec(await readFile(`db/migrations/${file}`,"utf8"));
  shared.connect.mockResolvedValue({ query: (sql: string, args: unknown[]) => db.query(sql,args), release: vi.fn() });
  for (const folder of ["configured-folder","foreign-folder"]) {
    const source = (await db.query<{id:string}>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,$1) RETURNING id",[folder])).rows[0].id;
    const version = (await db.query<{id:string}>("INSERT INTO oraculo.source_versions(source_id,version,drive_file_id,file_name,modified_at,sha256,parser_version) VALUES($1,100,'synthetic','synthetic-v100.xlsx',now(),repeat('a',64),'2026.2') RETURNING id",[source])).rows[0].id;
    const albumId = (await db.query<{id:string}>("INSERT INTO oraculo.albums(source_id,identity_key,artist,title) VALUES($1,'synthetic','Artista','Álbum') RETURNING id",[source])).rows[0].id;
    ids.push(albumId);
    await db.query("INSERT INTO oraculo.source_album_state(source_id,album_id,last_seen_source_version_id,is_present,record) VALUES($1,$2,$3,false,$4::jsonb)",[source,albumId,version,JSON.stringify(syntheticAlbum(1,{albumId:"spoofed-json-id"}))]);
    await db.query("INSERT INTO oraculo.source_backlog_records VALUES($1,$2,1,$3::jsonb)",[source,version,JSON.stringify({order:1,artist:"Preservado",title:"Backlog",priority:"",source:""})]);
    await db.query("INSERT INTO oraculo.source_publications VALUES($1,$2,now())",[source,version]);
  }
},30000);
afterAll(async () => { await db?.close(); });
describe("identidade dos álbuns na publicação", () => {
  it("expõe o UUID do banco e preserva ausentes sem incluir a outra fonte", async () => {
    const source = (await getPublishedSource(2026,"configured-folder"))!;
    expect(source.albums).toHaveLength(1);
    expect(source.albums[0]).toMatchObject({albumId:ids[0],isPresent:false});
    expect(source.albums.some(a => a.albumId === ids[1])).toBe(false);
    expect(source.backlog).toHaveLength(1);
  });
  it("não retorna publicação de outra temporada ou pasta", async () => {
    expect(await getPublishedSource(2025,"configured-folder")).toBeNull();
    expect(await getPublishedSource(2026,"unknown-folder")).toBeNull();
  });
});
