-- Competition snapshots are append-only. Only the active pointer may change.
CREATE TABLE oraculo.competition_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES oraculo.sources(id),
  season integer NOT NULL CHECK (season = 2026),
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  file_version bigint NOT NULL CHECK (file_version >= 0),
  drive_revision text NOT NULL,
  modified_at timestamptz NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  cutoff_album_keys jsonb NOT NULL CHECK (jsonb_typeof(cutoff_album_keys) = 'array'),
  rules_version text NOT NULL,
  parser_version text NOT NULL,
  frozen_by uuid NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  supersedes_id uuid,
  correction_reason text,
  eligibility_attested boolean NOT NULL DEFAULT false,
  CHECK ((supersedes_id IS NULL AND correction_reason IS NULL AND NOT eligibility_attested)
    OR (supersedes_id IS NOT NULL AND length(trim(correction_reason)) >= 10 AND eligibility_attested)),
  UNIQUE (source_id, id),
  FOREIGN KEY (source_id, supersedes_id) REFERENCES oraculo.competition_freezes(source_id, id)
);
CREATE TABLE oraculo.competition_freeze_participants (
  freeze_id uuid NOT NULL REFERENCES oraculo.competition_freezes(id),
  identity_key text NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  original_score numeric(6,3) NOT NULL,
  route text NOT NULL CHECK (route IN ('elite', 'direct', 'pre')),
  seed integer NOT NULL CHECK (seed BETWEEN 1 AND 32),
  source_row integer NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (freeze_id, identity_key),
  UNIQUE (freeze_id, seed)
);
CREATE TABLE oraculo.competition_freeze_publications (
  source_id uuid PRIMARY KEY REFERENCES oraculo.sources(id),
  freeze_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_id, freeze_id) REFERENCES oraculo.competition_freezes(source_id, id)
);
CREATE INDEX competition_freezes_history_idx ON oraculo.competition_freezes(source_id, frozen_at DESC);
GRANT SELECT ON oraculo.competition_freezes, oraculo.competition_freeze_participants,
  oraculo.competition_freeze_publications TO oraculo_reader, oraculo_sync;
GRANT INSERT ON oraculo.competition_freezes, oraculo.competition_freeze_participants,
  oraculo.competition_freeze_publications TO oraculo_sync;
GRANT UPDATE(freeze_id, published_at) ON oraculo.competition_freeze_publications TO oraculo_sync;
