-- Run as migration administrator. Runtime roles are deliberately NOLOGIN.
-- Provision separate LOGIN identities outside Git, then grant these roles.
CREATE ROLE oraculo_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE oraculo_sync NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA oraculo;
REVOKE ALL ON SCHEMA oraculo FROM PUBLIC;

CREATE TABLE oraculo.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL CHECK (season BETWEEN 2000 AND 9999),
  folder_id text NOT NULL UNIQUE CHECK (length(folder_id) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE oraculo.source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES oraculo.sources(id),
  version bigint NOT NULL CHECK (version >= 0),
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  modified_at timestamptz NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  parser_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, version)
);
CREATE TABLE oraculo.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES oraculo.sources(id),
  version_id uuid REFERENCES oraculo.source_versions(id),
  requested_by uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('running','succeeded','unchanged','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}',
  error_code text,
  CHECK ((status = 'running' AND finished_at IS NULL) OR (status <> 'running' AND finished_at IS NOT NULL))
);
CREATE TABLE oraculo.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES oraculo.sources(id),
  identity_key text NOT NULL CHECK (length(identity_key) > 0),
  artist text NOT NULL CHECK (length(trim(artist)) > 0),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  edition text,
  UNIQUE(source_id, identity_key)
);
CREATE TABLE oraculo.original_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL UNIQUE REFERENCES oraculo.albums(id),
  source_version_id uuid NOT NULL REFERENCES oraculo.source_versions(id),
  source_locator text NOT NULL,
  total numeric(6,3) NOT NULL CHECK (total BETWEEN 0 AND 100),
  sound numeric(6,3) CHECK (sound BETWEEN 0 AND 25),
  identity numeric(6,3) CHECK (identity BETWEEN 0 AND 25),
  consistency numeric(6,3) CHECK (consistency BETWEEN 0 AND 25),
  replay numeric(6,3) CHECK (replay BETWEEN 0 AND 25),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sound IS NULL OR identity IS NULL OR consistency IS NULL OR replay IS NULL
    OR total = sound + identity + consistency + replay)
);
CREATE TABLE oraculo.import_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES oraculo.sync_runs(id),
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning','error')),
  source_locator text,
  message text NOT NULL
);

-- No exposure through public schema / Supabase Data API.
REVOKE ALL ON ALL TABLES IN SCHEMA oraculo FROM PUBLIC;
GRANT USAGE ON SCHEMA oraculo TO oraculo_reader, oraculo_sync;
GRANT SELECT ON ALL TABLES IN SCHEMA oraculo TO oraculo_reader, oraculo_sync;
GRANT INSERT ON oraculo.source_versions, oraculo.sync_runs, oraculo.albums,
  oraculo.original_evaluations, oraculo.import_issues TO oraculo_sync;
GRANT UPDATE(status, finished_at, counts, error_code, version_id)
  ON oraculo.sync_runs TO oraculo_sync;
-- Neither runtime role can change or delete originals, versions, or album identities.
-- Do not grant default INSERT/UPDATE privileges on future tables.
