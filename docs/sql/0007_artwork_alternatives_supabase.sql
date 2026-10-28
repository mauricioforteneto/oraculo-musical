-- Executar uma vez, no SQL Editor administrativo do Supabase.
-- Preserva capas, avaliações, versões e escolhas manuais.
BEGIN;
SELECT pg_advisory_xact_lock(739126);

-- Preserve existing MusicBrainz associations; Apple IDs are a separate namespace.
ALTER TABLE oraculo.album_artwork
  ADD COLUMN provider text NOT NULL DEFAULT 'musicbrainz' CHECK(provider IN ('musicbrainz','itunes')),
  ADD COLUMN itunes_collection_id bigint CHECK(itunes_collection_id > 0),
  ADD COLUMN provider_url text,
  ADD COLUMN fallback_checked_at timestamptz;
ALTER TABLE oraculo.album_artwork DROP CONSTRAINT album_artwork_check;
ALTER TABLE oraculo.album_artwork ADD CONSTRAINT album_artwork_found_provider CHECK (
  status <> 'found' OR (thumbnail_url IS NOT NULL AND image_url IS NOT NULL AND (
    (provider='musicbrainz' AND release_group_id IS NOT NULL AND itunes_collection_id IS NULL) OR
    (provider='itunes' AND release_group_id IS NULL AND itunes_collection_id IS NOT NULL AND provider_url IS NOT NULL AND provider_url LIKE 'https://music.apple.com/%')
  ))
);
GRANT UPDATE(provider,itunes_collection_id,provider_url,fallback_checked_at) ON oraculo.album_artwork TO oraculo_sync;

-- The existing lease still serializes batches; each service has its own persistent clock.
CREATE TABLE oraculo.artwork_provider_limits (
  provider text PRIMARY KEY CHECK(provider IN ('MUSICBRAINZ','COVER_ART_ARCHIVE','ITUNES')),
  next_request_at timestamptz NOT NULL DEFAULT '-infinity',
  failures integer NOT NULL DEFAULT 0 CHECK(failures >= 0)
);
INSERT INTO oraculo.artwork_provider_limits(provider,next_request_at)
  SELECT 'MUSICBRAINZ',next_request_at FROM oraculo.artwork_provider_gate;
INSERT INTO oraculo.artwork_provider_limits(provider) VALUES('COVER_ART_ARCHIVE'),('ITUNES');
REVOKE ALL ON oraculo.artwork_provider_limits FROM PUBLIC;
GRANT SELECT,UPDATE(next_request_at,failures) ON oraculo.artwork_provider_limits TO oraculo_sync;

INSERT INTO oraculo_migrations.applied(name,sha256) VALUES('0007_artwork_alternatives.sql','7fb609ff06c5fed0859eeff8ae549525b198afe5bd23971c7d95a2199f54358f');
COMMIT;

SELECT EXISTS (SELECT 1 FROM oraculo_migrations.applied WHERE name='0007_artwork_alternatives.sql' AND sha256='7fb609ff06c5fed0859eeff8ae549525b198afe5bd23971c7d95a2199f54358f') AS migracao_0007_registrada,
  to_regclass('oraculo.artwork_provider_limits') IS NOT NULL AS limites_por_provedor_existem,
  (SELECT count(*) FROM oraculo.album_artwork WHERE status='found') AS capas_salvas;
