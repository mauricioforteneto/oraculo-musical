import {describe,it,expect,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
vi.mock('server-only',()=>({}));
import {readArtwork,ArtworkStore,type ArtworkQuery} from '../../src/lib/artwork/database';
describe('upgrade das capas existentes',()=>{
  it('mantém leitura antes da 0007 e preserva capas, revisões, negativos e prazos ao migrar',async()=>{
    const db=new PGlite();
    try {
      for(const file of ['0001_foundation.sql','0002_source_publication.sql','0006_album_artwork.sql']) await db.exec(await readFile(`db/migrations/${file}`,'utf8'));
      const source=(await db.query<{id:string}>("INSERT INTO oraculo.sources(season,folder_id) VALUES(2026,'migration-test') RETURNING id")).rows[0].id;
      const ids:string[]=[];
      for(const [i,status] of ['found','ambiguous','missing','error','hidden'].entries()) {
        const id=(await db.query<{id:string}>("INSERT INTO oraculo.albums(source_id,identity_key,artist,title) VALUES($1,$2,'Banda','Disco') RETURNING id",[source,String(i)])).rows[0].id;ids.push(id);
        await db.query(`INSERT INTO oraculo.album_artwork(source_id,album_id,status,selection,release_group_id,thumbnail_url,image_url,next_attempt_at)
          VALUES($1,$2,$3,$4,'11111111-1111-4111-8111-111111111111','https://archive.org/250.jpg','https://archive.org/500.jpg','2099-01-01')`,[source,id,status,status==='found' || status==='hidden' ? 'manual':'automatic']);
      }
      const query:ArtworkQuery=async(sql,params)=>({rows:(await db.query(sql,params)).rows as Record<string,unknown>[]});
      const before=await readArtwork(query,source);expect(before.ready).toBe(true);expect(before.records.size).toBe(5);
      await expect(new ArtworkStore(query).acquire()).rejects.toMatchObject({code:'ARTWORK_STORAGE_UPGRADE_REQUIRED'});
      await db.exec('CREATE SCHEMA oraculo_migrations; CREATE TABLE oraculo_migrations.applied(name text PRIMARY KEY,sha256 text NOT NULL)');
      const migration=await readFile('db/migrations/0007_artwork_alternatives.sql','utf8');
      const mobile=await readFile('docs/sql/0007_artwork_alternatives_supabase.sql','utf8');
      expect(mobile).toContain(migration);
      await db.exec(mobile);
      expect((await db.query('SELECT name,sha256 FROM oraculo_migrations.applied')).rows).toEqual([
        {name:'0007_artwork_alternatives.sql',sha256:createHash('sha256').update(migration).digest('hex')}]);
      const after=await readArtwork(query,source);
      expect(after.records).toEqual(before.records);
      expect(after.records.get(ids[0])).toMatchObject({provider:'musicbrainz',selection:'manual'});
      expect((await db.query('SELECT * FROM oraculo.artwork_provider_limits')).rows).toHaveLength(3);
      await db.exec('SET ROLE oraculo_sync');
      const store=new ArtworkStore(query),token=await store.acquire();
      await expect(store.write(source,ids[2],token,{status:'found',provider:'itunes',itunesCollectionId:'123',
        thumbnailUrl:'https://is1-ssl.mzstatic.com/image/thumb/synthetic/100x100bb.jpg',imageUrl:'https://is1-ssl.mzstatic.com/image/thumb/synthetic/100x100bb.jpg'}))
        .rejects.toMatchObject({code:'23514'});
      await store.write(source,ids[2],token,{status:'found',provider:'itunes',itunesCollectionId:'123',providerUrl:'https://music.apple.com/br/album/disco/123',
        thumbnailUrl:'https://is1-ssl.mzstatic.com/image/thumb/synthetic/100x100bb.jpg',imageUrl:'https://is1-ssl.mzstatic.com/image/thumb/synthetic/100x100bb.jpg'});
      expect((await readArtwork(query,source)).records.get(ids[2])).toMatchObject({provider:'itunes',itunesCollectionId:'123'});
    } finally {await db.close();}
  },30000);
});
