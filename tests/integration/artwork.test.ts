import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
vi.mock('server-only',()=>({}));
import {ArtworkStore,readArtwork,type ArtworkQuery} from '../../src/lib/artwork/database';
import {ArtworkService} from '../../src/lib/artwork/service';
import {syntheticAlbum} from '../fixtures/synthetic/top50';
let db:PGlite,store:ArtworkStore,source:string,foreign:string;
const ids:string[]=[];
const groupId='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const record={id:groupId,title:'Disco 1','artist-credit':[{name:'Banda 1'}]};
const cover=()=>Response.json({images:[{approved:true,front:true,thumbnails:{250:'https://archive.org/download/synthetic/250.jpg',500:'https://archive.org/download/synthetic/500.jpg'}}]});
const query:ArtworkQuery=async(sql,params)=>{const result=await db.query(sql,params);return {rows:result.rows as Record<string,unknown>[]};};
beforeAll(async()=>{
  db=new PGlite();
  for(const name of ['0001_foundation.sql','0002_source_publication.sql','0006_album_artwork.sql']) await db.exec(await readFile(`db/migrations/${name}`,'utf8'));
  store=new ArtworkStore(query);
  for(const folder of ['artwork-source','foreign-source']) {
    const sid=(await db.query<{id:string}>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,$1) RETURNING id",[folder])).rows[0].id;
    if(folder==='artwork-source') source=sid;else foreign=sid;
    const version=(await db.query<{id:string}>("INSERT INTO oraculo.source_versions(source_id,version,drive_file_id,file_name,modified_at,sha256,parser_version) VALUES($1,100,'synthetic','synthetic.xlsx',now(),repeat('a',64),'test') RETURNING id",[sid])).rows[0].id;
    for(let i=1;i<=(folder==='artwork-source'?6:1);i++) {
      const id=(await db.query<{id:string}>("INSERT INTO oraculo.albums(source_id,identity_key,artist,title) VALUES($1,$2,$3,$4) RETURNING id",[sid,String(i),`Banda ${i}`,`Disco ${i}`])).rows[0].id;
      if(folder==='artwork-source') ids.push(id);
      await db.query('INSERT INTO oraculo.source_album_state(source_id,album_id,record,last_seen_source_version_id,is_present) VALUES($1,$2,$3::jsonb,$4,$5)',[sid,id,JSON.stringify(syntheticAlbum(i,{artist:`Banda ${i}`,title:`Disco ${i}`})),version,i!==6]);
    }
  }
  await db.exec('BEGIN');
},30000);
beforeEach(async()=>{
  vi.stubEnv('SOURCE_SEASON','2026');vi.stubEnv('GOOGLE_DRIVE_FOLDER_ID','artwork-source');
  await db.exec('SAVEPOINT artwork_test');
});
afterEach(async()=>{await db.exec('ROLLBACK TO SAVEPOINT artwork_test; RESET ROLE');vi.unstubAllEnvs();});
afterAll(async()=>{if(db){await db.exec('ROLLBACK');await db.close();}});
describe('capas persistidas',()=>{
  it('processa apenas presentes, persiste resultados e não repete negativos recentes',async()=>{
    // Stable album order for this test puts the transient failure last.
    const albums=await store.albums(source);
    const positions=new Map(albums.filter(a=>a.isPresent).map((a,i)=>[a.artist,i]));
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
      const url=new URL(String(input));
      if(url.hostname==='coverartarchive.org') return url.pathname.includes(groupId) ? cover() : new Response(null,{status:404});
      const artist=url.searchParams.get('query')?.match(/artist:"(.*?)"/)?.[1] ?? '';
      const i=positions.get(artist)!;
      if(i===4) return new Response(null,{status:503,headers:{'retry-after':'120'}});
      const title=albums.find(a=>a.artist===artist)!.title;
      const row={...record,'artist-credit':[{name:artist}],title};
      return Response.json({count:i===1?2:i===2?0:1,'release-groups':i===1?[row,{...row,id:'33333333-3333-4333-8333-333333333333'}]:i===2?[]:[{...row,id:i===3?'44444444-4444-4444-8444-444444444444':groupId}]});
    });
    const service=new ArtworkService(store,fetcher);
    const result=await service.batch();
    expect(result.processed).toBe(5);expect(result.paused).toBe(true);
    expect(result.summary).toMatchObject({total:5,found:1,ambiguous:1,missing:2,error:1,due:0});
    const saved=await readArtwork(query,source);
    expect(saved.records.has(ids[5])).toBe(false);expect(saved.records.size).toBe(5);
    const error=[...saved.records.values()].find(v=>v.status==='error')!;
    expect(Date.parse(error.nextAttemptAt!)-Date.now()).toBeGreaterThan(29*60_000);
    const missing=[...saved.records.values()].find(v=>v.status==='missing')!;
    expect(Date.parse(missing.nextAttemptAt!)-Date.now()).toBeGreaterThan(6*86400_000);
    const requests=fetcher.mock.calls.length;
    expect((await service.batch()).processed).toBe(0);expect(fetcher).toHaveBeenCalledTimes(requests);
  },30000);
  it('preserva capa manual em falha de correção e permite ocultar ou reativar sem mexer na fonte',async()=>{
    const before=(await db.query('SELECT record FROM oraculo.source_album_state WHERE album_id=$1',[ids[0]])).rows;
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>String(input).includes('coverartarchive.org')?cover():Response.json(record));
    const service=new ArtworkService(store,fetcher);
    const token=await store.acquire();
    for(const other of ids.slice(1,5)) await store.write(source,other,token,{status:'hidden',manual:true,userId:owner});
    await store.release(token);
    await service.selection(ids[0],'select',groupId,owner);
    const requests=fetcher.mock.calls.length;
    expect((await service.batch()).processed).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(requests);
    let saved=(await readArtwork(query,source)).records.get(ids[0])!;
    expect(saved).toMatchObject({status:'found',selection:'manual',releaseGroupId:groupId});
    fetcher.mockResolvedValue(new Response(null,{status:404}));
    await expect(service.selection(ids[0],'select',groupId,owner)).rejects.toMatchObject({code:'ARTWORK_NOT_FOUND'});
    expect((await readArtwork(query,source)).records.get(ids[0])).toEqual(saved);
    await service.selection(ids[0],'hide',undefined,owner);
    saved=(await readArtwork(query,source)).records.get(ids[0])!;expect(saved.status).toBe('hidden');
    await service.selection(ids[0],'automatic',undefined,owner);
    expect((await readArtwork(query,source)).records.get(ids[0])).toMatchObject({status:'pending',selection:'automatic'});
    expect((await db.query('SELECT record FROM oraculo.source_album_state WHERE album_id=$1',[ids[0]])).rows).toEqual(before);
  },15000);
  it('isola fontes e não consulta provedor para ID de outra fonte',async()=>{
    const foreignId=(await store.albums(foreign))[0].id;
    const fetcher=vi.fn<typeof fetch>();const service=new ArtworkService(store,fetcher);
    await expect(service.search(foreignId)).rejects.toMatchObject({code:'ARTWORK_ALBUM_NOT_FOUND'});
    expect(fetcher).not.toHaveBeenCalled();
    const token=await store.acquire();
    await expect(store.write(source,foreignId,token,{status:'hidden',manual:true})).rejects.toMatchObject({code:'23503'});
  });
  it('coordena instâncias e espaça chamadas mesmo após liberar o lote',async()=>{
    const other=new ArtworkStore(query);const token=await store.acquire();
    await expect(other.acquire()).rejects.toMatchObject({code:'ARTWORK_BUSY'});
    expect(await store.reserveRequest(token)).toBeLessThan(100);
    expect(await store.reserveRequest(token)).toBeGreaterThan(900);
    await store.release(token);const next=await other.acquire();
    expect(await other.reserveRequest(next)).toBeGreaterThan(1800);
    await store.release(token);await expect(store.acquire()).rejects.toMatchObject({code:'ARTWORK_BUSY'});
    await db.exec("UPDATE oraculo.artwork_provider_gate SET expires_at=clock_timestamp()-interval '1 second'");
    await expect(other.write(source,ids[0],next,{status:'pending'})).rejects.toMatchObject({code:'ARTWORK_LEASE_LOST'});
  });
  it('concede leitura ao leitor e restringe escrita ao enriquecimento no sincronizador',async()=>{
    await db.exec('SET LOCAL ROLE oraculo_reader');expect((await readArtwork(query,source)).ready).toBe(true);
    await db.exec('SAVEPOINT denied_artwork');
    await expect(db.query("INSERT INTO oraculo.album_artwork(source_id,album_id,status) VALUES($1,$2,'pending')",[source,ids[0]])).rejects.toMatchObject({code:'42501'});
    await db.exec('ROLLBACK TO SAVEPOINT denied_artwork; RESET ROLE; SET LOCAL ROLE oraculo_sync');
    const token=await store.acquire();await store.write(source,ids[0],token,{status:'hidden',manual:true,userId:owner});
    expect((await readArtwork(query,source)).records.get(ids[0])!.status).toBe('hidden');
    await db.exec('SAVEPOINT denied_delete');await expect(db.exec('DELETE FROM oraculo.album_artwork')).rejects.toMatchObject({code:'42501'});
    await db.exec('ROLLBACK TO SAVEPOINT denied_delete');
    await db.exec('SAVEPOINT denied_identity');await expect(db.exec('UPDATE oraculo.album_artwork SET source_id=source_id')).rejects.toMatchObject({code:'42501'});
    await db.exec('ROLLBACK TO SAVEPOINT denied_identity');
  });
});
