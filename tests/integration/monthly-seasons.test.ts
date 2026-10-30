import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { parseWorkbookSheets, type WorkbookSheetData } from "../../src/lib/ingestion/workbook-parser";
import { MONTHLY_DECISION_HEADERS, MONTHLY_CLOSURE_HEADERS } from "../../src/lib/ingestion/monthly-records";
import { seasonContext } from "../../src/lib/seasons/context";
import type { MonthlyClosure } from "../../src/lib/competition/monthly";

const shared = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), latest: vi.fn(), download: vi.fn(), parse: vi.fn() }));
vi.mock("@/lib/db/pool", () => ({databasePool:()=>({query:shared.query,connect:shared.connect})}));
vi.mock("@/lib/ingestion/google", () => ({configuredDriveReader:()=>({latest:shared.latest,download:shared.download})}));
vi.mock("../../src/lib/ingestion/workbook", async () => ({...await vi.importActual<typeof import("../../src/lib/ingestion/workbook")>("../../src/lib/ingestion/workbook"),parseSourceWorkbook:shared.parse}));
import { syncDriveSource } from "../../src/lib/ingestion/sync-service";
import { getPublishedSource } from "../../src/lib/catalog/database";
import { getVersionHistory } from "../../src/lib/catalog/version-history-database";
import { ArtworkStore } from "../../src/lib/artwork/database";
import { ArtworkService } from "../../src/lib/artwork/service";

let db:PGlite, folder:string, legacyFolder:string, sourceId:string;
let sequence=0, version="1", moved=false, releaseUnknown=false;
let closures:MonthlyClosure[]=[];
const owner="00000000-0000-4000-8000-000000000099";
const headers=["Rank","Artista","Álbum","Nota","Faixa","Gênero","País","Fonte","Nota Original","Data da avaliação","Ano de lançamento"];
function sheets(year:number):WorkbookSheetData[] {
  const albums=[
    [1,"Artista fictício 1","Álbum fictício 1",95,"","Rock","Brasil","Fixture",95,moved?"2027-02-01":"2027-01-15",releaseUnknown?"":2027],
    [2,"Artista fictício 2","Álbum fictício 2",91,"","Jazz","Brasil","Fixture",91,"2027-01-16",2027],
    [3,"Artista fictício 3","Álbum fictício 3",90,"","Folk","Brasil","Fixture",90,"2027-01-17",2027],
    [4,"Artista fictício 4","Álbum fictício 4",99,"","Rock","Brasil","Fixture",99,"2027-02-02",2027],
  ];
  return [{sheet:`Albuns ${year}`,data:[headers,...albums]},
    {sheet:"Backlog",data:[["Ordem","Artista","Álbum","Prioridade","Fonte"]]},
    {sheet:"Desempates mensais",data:[MONTHLY_DECISION_HEADERS]},
    {sheet:"Fechamentos mensais",data:[MONTHLY_CLOSURE_HEADERS,...closures.map(row=>[row.closureId,row.season,row.month,row.rulesVersion,row.baseVersion,row.contextHash,row.status,row.confirmedBy,row.confirmedOn,row.reference,row.supersedes,row.reason])]}];
}
beforeAll(async()=>{
  db=new PGlite();
  for(const file of (await readdir("db/migrations")).filter(file=>file.endsWith(".sql")).sort()) await db.exec(await readFile(`db/migrations/${file}`,"utf8"));
  shared.query.mockImplementation(async(sql:string,params:unknown[])=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length||result.affectedRows||0};});
  shared.connect.mockResolvedValue({query:shared.query,release:vi.fn()});
},30000);
beforeEach(async()=>{
  folder=`monthly-${++sequence}`;legacyFolder=`legacy-${sequence}`;
  sourceId=(await db.query<{id:string}>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2027,$1) RETURNING id",[folder])).rows[0].id;
  await db.query("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,$1)",[legacyFolder]);
  version="1";moved=false;releaseUnknown=false;closures=[];
  vi.stubEnv("SOURCE_SEASON","2026");vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID",legacyFolder);vi.stubEnv("SEASON_SOURCES_JSON",JSON.stringify({2026:legacyFolder,2027:folder}));
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2027-03-02T12:00:00Z"));
  shared.latest.mockImplementation(async(parent:string,year:number)=>({sourceVersion:version,file:{id:`file-${year}-${version}`,name:`Oraculo_Musical_${year}_v${version}.xlsx`,modifiedTime:"2027-03-02T12:00:00Z",version:"1",parents:[parent]}}));
  shared.download.mockImplementation(async()=>({bytes:new Uint8Array(),sha256:String.fromCharCode(96+Number(version)).repeat(64)}));
  shared.parse.mockImplementation(async(_bytes:unknown,options:{season:number;sourceVersion:string})=>parseWorkbookSheets(sheets(options.season),options));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});afterAll(async()=>{await db?.close();});
async function sync(year=2027) {await db.exec("SET ROLE oraculo_sync");try{return await syncDriveSource(owner,seasonContext(String(year)));}finally{await db.exec("RESET ROLE");}}
async function read(year=2027) {await db.exec("SET ROLE oraculo_reader");try{return (await getPublishedSource(year,year===2027?folder:legacyFolder))!;}finally{await db.exec("RESET ROLE");}}
async function prepare(month:number,id:string,supersedes="") {
  const state=(await read()).monthly!;
  return {closureId:id,season:2027,month,rulesVersion:state.rulesVersion,baseVersion:state.sourceVersion!,contextHash:state.months[month-1].contextHash!,
    status:"Confirmada",confirmedBy:"Proprietário fictício",confirmedOn:"2027-03-02",reference:"Confirmação explícita sintética",supersedes,reason:supersedes?"Correção factual de data confirmada pelo proprietário":"",sourceRow:2} satisfies MonthlyClosure;
}
describe("temporadas e publicação mensal com permissões reais",()=>{
  it("isola fontes com mesma versão e nomes de álbum; não muda 2026",async()=>{
    await sync(2026);await sync(2027);
    const a=await read(2026),b=await read(2027);
    expect(a.version).toBe("1");expect(b.version).toBe("1");expect(a.albums[0].albumId).not.toBe(b.albums[0].albumId);
    expect(a.monthly).toBeUndefined();expect(b.monthly!.months[0].provisional.map(item=>item.originalScore)).toEqual([95,91]);
    expect(shared.latest).toHaveBeenCalledWith(folder,2027);expect(shared.latest).toHaveBeenCalledWith(legacyFolder,2026);
  });
  it("fecha com contexto confirmado e reimporta sem duplicar ou alterar originais",async()=>{
    await sync();closures=[await prepare(1,"jan-1")];version="2";
    expect((await sync()).status).toBe("succeeded");const month=(await read()).monthly!.months[0];
    expect(month.confirmed?.qualified.map(item=>item.originalScore)).toEqual([95,91]);expect(month.changedSinceClosure).toBe(false);
    expect((await sync()).status).toBe("unchanged");
    expect((await db.query<{n:number}>("SELECT count(*)::int AS n FROM oraculo.monthly_closures WHERE source_id=$1",[sourceId])).rows[0].n).toBe(1);
    expect((await db.query<{n:number}>("SELECT count(*)::int AS n FROM oraculo.original_evaluations o JOIN oraculo.albums a ON a.id=o.album_id WHERE a.source_id=$1",[sourceId])).rows[0].n).toBe(4);
  });
  it("isola históricos e operações de capas mesmo com versões iguais",async()=>{
    await sync(2026);await sync(2027);
    const legacy=await read(2026),monthly=await read();
    const oldHistory=await getVersionHistory(2026,legacyFolder,"1");
    const newHistory=await getVersionHistory(2027,folder,"1");
    expect(oldHistory?.selected.version).toBe("1");expect(newHistory?.selected.version).toBe("1");
    expect(oldHistory?.selected.fileName).not.toBe(newHistory?.selected.fileName);
    const fetcher=vi.fn<typeof fetch>();
    const service=new ArtworkService(new ArtworkStore(shared.query),fetcher,seasonContext("2027"));
    await db.exec("SET ROLE oraculo_sync");
    try {
      await expect(service.selection(legacy.albums[0].albumId!,"hide",undefined,owner)).rejects.toMatchObject({code:"ARTWORK_ALBUM_NOT_FOUND"});
      await service.selection(monthly.albums[0].albumId!,"hide",undefined,owner);
    } finally {await db.exec("RESET ROLE");}
    expect((await read()).albums[0].artwork?.status).toBe("hidden");
    expect((await read(2026)).albums[0].artwork?.status).not.toBe("hidden");expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejeita confirmação prematura e alteração de uma confirmação já publicada",async()=>{
    await sync();const row=await prepare(1,"jan-1");row.confirmedOn="2027-01-31";
    closures=[row];version="2";expect((await sync()).issues.some(issue=>issue.code==="MONTHLY_CLOSURE_PENDING")).toBe(true);
    expect((await read()).monthly!.months[0].confirmed).toBeUndefined();
    row.confirmedOn="2027-03-02";version="3";await sync();
    const confirmed=(await read()).monthly!.months[0].confirmed;
    row.reference="Referência editada posteriormente";version="4";
    expect((await sync()).issues.some(issue=>issue.message.includes("foi alterado"))).toBe(true);
    expect((await read()).monthly!.months[0].confirmed).toEqual(confirmed);
  });
  it("contexto de outra fonte não confirma fechamento",async()=>{
    await sync();closures=[await prepare(1,"jan-foreign")];closures[0].contextHash="f".repeat(64);version="2";
    const result=await sync();expect(result.issues.some(issue=>issue.code==="MONTHLY_CLOSURE_PENDING")).toBe(true);expect((await read()).monthly!.months[0].confirmed).toBeUndefined();
  });
  it("preserva mês fechado quando a data muda e corrige somente com confirmação nova",async()=>{
    await sync();closures=[await prepare(1,"jan-1")];version="2";await sync();moved=true;version="3";
    await sync();expect((await read()).monthly!.months[0].changedSinceClosure).toBe(true);
    closures.push(await prepare(1,"jan-2","jan-1"));version="4";await sync();
    expect((await read()).monthly!.months[0].confirmed?.qualified.map(item=>item.originalScore)).toEqual([91,90]);
    expect((await db.query<{n:number}>("SELECT count(*)::int AS n FROM oraculo.monthly_closures WHERE source_id=$1",[sourceId])).rows[0].n).toBe(2);
  });
  it("corrige meses juntos e impede um álbum em duas vagas confirmadas",async()=>{
    await sync();closures=[await prepare(1,"jan-1"),await prepare(2,"fev-1")];version="2";await sync();
    moved=true;version="3";await sync();
    closures.push(await prepare(2,"fev-2","fev-1"));version="4";
    expect((await sync()).issues.some(issue=>issue.message.includes("duplicaria"))).toBe(true);
    expect((await read()).monthly!.months[1].confirmed?.closureId).toBe("fev-1");
    closures.pop();closures.push(await prepare(1,"jan-2","jan-1"),await prepare(2,"fev-2","fev-1"));version="5";await sync();
    const months=(await read()).monthly!.months;expect(months[0].confirmed?.closureId).toBe("jan-2");expect(months[1].confirmed?.closureId).toBe("fev-2");
    const keys=months.flatMap(month=>month.confirmed?.qualified.map(album=>album.key)??[]);expect(new Set(keys).size).toBe(keys.length);
  });
  it("dezembro e metadados pendentes não produzem confirmação oficial",async()=>{
    releaseUnknown=true;await sync();closures=[await prepare(1,"jan-incomplete"),await prepare(12,"dec-unset")];version="2";
    const result=await sync();expect(result.issues.filter(issue=>issue.code==="MONTHLY_CLOSURE_PENDING")).toHaveLength(2);
    expect((await read()).monthly!.months.every(month=>!month.confirmed)).toBe(true);
  });
  it("papel leitor não grava e sincronizador não reescreve snapshots",async()=>{
    await sync();closures=[await prepare(1,"jan-1")];version="2";await sync();
    await db.exec("SET ROLE oraculo_reader");await expect(db.query("INSERT INTO oraculo.monthly_publications VALUES($1,1,'jan-1')",[sourceId])).rejects.toThrow();await db.exec("RESET ROLE");
    await db.exec("SET ROLE oraculo_sync");await expect(db.query("UPDATE oraculo.monthly_closures SET record='{}' WHERE source_id=$1",[sourceId])).rejects.toThrow();await db.exec("RESET ROLE");
  });
});
