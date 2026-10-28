-- Artwork is mutable enrichment, never part of workbook snapshots or evaluations.
CREATE TABLE oraculo.album_artwork (
  source_id uuid NOT NULL,
  album_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','found','missing','ambiguous','error','hidden')),
  selection text NOT NULL DEFAULT 'automatic' CHECK (selection IN ('automatic','manual')),
  release_group_id uuid,
  thumbnail_url text,
  image_url text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz,
  selected_by uuid,
  error_code text,
  PRIMARY KEY(source_id, album_id),
  FOREIGN KEY(source_id, album_id) REFERENCES oraculo.albums(source_id, id),
  CHECK (status <> 'found' OR (release_group_id IS NOT NULL AND thumbnail_url IS NOT NULL AND image_url IS NOT NULL)),
  CHECK (thumbnail_url IS NULL OR thumbnail_url LIKE 'https://%'),
  CHECK (image_url IS NULL OR image_url LIKE 'https://%')
);

-- One provider gate across sources and application instances. Runtime cannot delete it.
CREATE TABLE oraculo.artwork_provider_gate (
  provider text PRIMARY KEY CHECK(provider = 'musicbrainz-coverartarchive'),
  token uuid,
  expires_at timestamptz NOT NULL DEFAULT '-infinity',
  next_request_at timestamptz NOT NULL DEFAULT '-infinity'
);
INSERT INTO oraculo.artwork_provider_gate(provider) VALUES('musicbrainz-coverartarchive');
REVOKE ALL ON oraculo.album_artwork, oraculo.artwork_provider_gate FROM PUBLIC;
GRANT SELECT ON oraculo.album_artwork TO oraculo_reader, oraculo_sync;
GRANT INSERT ON oraculo.album_artwork TO oraculo_sync;
GRANT UPDATE(status, selection, release_group_id, thumbnail_url, image_url, checked_at, next_attempt_at, selected_by, error_code)
  ON oraculo.album_artwork TO oraculo_sync;
GRANT SELECT, UPDATE ON oraculo.artwork_provider_gate TO oraculo_sync;
