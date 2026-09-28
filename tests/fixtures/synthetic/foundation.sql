-- Entirely fictitious data. Never substitute a personal workbook export.
INSERT INTO oraculo.sources(id,season,folder_id)
VALUES ('00000000-0000-4000-8000-000000000001',2026,'fictional-folder');
INSERT INTO oraculo.source_versions(id,source_id,version,drive_file_id,file_name,modified_at,sha256,parser_version)
VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',1,
 'fictional-file','synthetic.xlsx','2026-01-01T00:00:00Z',repeat('a',64),'fixture-1');
INSERT INTO oraculo.albums(id,source_id,identity_key,artist,title)
VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',
 'fictional-identity','Artista Fictício','Álbum de Teste');
INSERT INTO oraculo.original_evaluations(album_id,source_version_id,source_locator,total,sound,identity,consistency,replay)
VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002',
 'Synthetic!A2:G2',78,20,20,20,18);
