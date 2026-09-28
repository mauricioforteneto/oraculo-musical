-- Immutable source-version snapshots plus a small mutable pointer to the last valid publication.
ALTER TABLE oraculo.source_versions
  ADD COLUMN reference_date text NOT NULL DEFAULT '',
  ADD COLUMN summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT source_versions_source_id_id_key UNIQUE (source_id, id);

ALTER TABLE oraculo.albums
  ADD CONSTRAINT albums_source_id_id_key UNIQUE (source_id, id);

ALTER TABLE oraculo.sync_runs
  ADD COLUMN candidate_version bigint CHECK (candidate_version IS NULL OR candidate_version >= 0),
  ADD COLUMN candidate_file_id text,
  ADD COLUMN candidate_file_name text,
  ADD COLUMN candidate_sha256 text CHECK (candidate_sha256 IS NULL OR candidate_sha256 ~ '^[a-f0-9]{64}$');

CREATE TABLE oraculo.source_publications (
  source_id uuid PRIMARY KEY REFERENCES oraculo.sources(id),
  source_version_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_id, source_version_id)
    REFERENCES oraculo.source_versions(source_id, id)
);

-- Full per-version rows preserve provenance. The state table keeps the last known row
-- when a later workbook omits it, with an explicit present flag.
CREATE TABLE oraculo.source_album_records (
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  album_id uuid NOT NULL,
  source_locator text NOT NULL,
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  PRIMARY KEY (source_version_id, album_id),
  FOREIGN KEY (source_id, source_version_id)
    REFERENCES oraculo.source_versions(source_id, id),
  FOREIGN KEY (source_id, album_id)
    REFERENCES oraculo.albums(source_id, id)
);

CREATE TABLE oraculo.source_album_state (
  source_id uuid NOT NULL,
  album_id uuid NOT NULL,
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  last_seen_source_version_id uuid NOT NULL,
  is_present boolean NOT NULL DEFAULT true,
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, album_id),
  FOREIGN KEY (source_id, album_id)
    REFERENCES oraculo.albums(source_id, id),
  FOREIGN KEY (source_id, last_seen_source_version_id)
    REFERENCES oraculo.source_versions(source_id, id)
);

CREATE TABLE oraculo.source_backlog_records (
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  item_order integer NOT NULL CHECK (item_order > 0),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  PRIMARY KEY (source_version_id, item_order),
  FOREIGN KEY (source_id, source_version_id)
    REFERENCES oraculo.source_versions(source_id, id)
);

CREATE TABLE oraculo.sync_leases (
  source_id uuid PRIMARY KEY REFERENCES oraculo.sources(id),
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX sync_runs_source_started_idx ON oraculo.sync_runs(source_id, started_at DESC);
CREATE INDEX sync_runs_candidate_hash_idx ON oraculo.sync_runs(source_id, candidate_version, candidate_sha256)
  WHERE candidate_sha256 IS NOT NULL;
CREATE INDEX source_backlog_version_order_idx ON oraculo.source_backlog_records(source_id, source_version_id, item_order);

GRANT SELECT ON oraculo.source_publications, oraculo.source_album_records,
  oraculo.source_album_state, oraculo.source_backlog_records
  TO oraculo_reader, oraculo_sync;
GRANT SELECT ON oraculo.sync_leases TO oraculo_sync;
GRANT INSERT ON oraculo.source_publications, oraculo.source_album_records,
  oraculo.source_album_state, oraculo.source_backlog_records, oraculo.sync_leases
  TO oraculo_sync;
GRANT UPDATE(source_version_id, published_at) ON oraculo.source_publications TO oraculo_sync;
GRANT UPDATE(record, last_seen_source_version_id, is_present, last_changed_at)
  ON oraculo.source_album_state TO oraculo_sync;
GRANT UPDATE(token, expires_at) ON oraculo.sync_leases TO oraculo_sync;
GRANT DELETE ON oraculo.sync_leases TO oraculo_sync;
GRANT INSERT ON oraculo.source_versions TO oraculo_sync;
GRANT UPDATE(candidate_version, candidate_file_id, candidate_file_name, candidate_sha256)
  ON oraculo.sync_runs TO oraculo_sync;
