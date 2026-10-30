-- Executar uma vez, após backup, com as migrações 0001–0008 aplicadas.
-- Alternativa administrativa a npm run db:migrate; não executar ambos novamente.
BEGIN;
SELECT pg_advisory_xact_lock(739126);
-- Additive, source-scoped monthly competition. No legacy rows are rewritten.
CREATE TABLE oraculo.source_monthly_records (
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  parser_revision integer NOT NULL CHECK (parser_revision > 0),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  PRIMARY KEY (source_version_id, parser_revision),
  FOREIGN KEY (source_id,source_version_id) REFERENCES oraculo.source_versions(source_id,id)
);
CREATE TABLE oraculo.monthly_contexts (
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  rules_version text NOT NULL,
  context_hash text NOT NULL CHECK (context_hash ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (source_version_id,month,rules_version),
  FOREIGN KEY (source_id,source_version_id) REFERENCES oraculo.source_versions(source_id,id)
);
CREATE TABLE oraculo.monthly_closures (
  source_id uuid NOT NULL,
  closure_id text NOT NULL CHECK (length(closure_id) BETWEEN 1 AND 100),
  source_version_id uuid NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  input jsonb NOT NULL,
  record jsonb NOT NULL,
  PRIMARY KEY (source_id,closure_id),
  UNIQUE (source_id,month,closure_id),
  FOREIGN KEY (source_id,source_version_id) REFERENCES oraculo.source_versions(source_id,id)
);
CREATE TABLE oraculo.monthly_publications (
  source_id uuid NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  closure_id text NOT NULL,
  PRIMARY KEY (source_id,month),
  FOREIGN KEY (source_id,month,closure_id) REFERENCES oraculo.monthly_closures(source_id,month,closure_id)
);
REVOKE ALL ON oraculo.source_monthly_records,oraculo.monthly_contexts,oraculo.monthly_closures,oraculo.monthly_publications FROM PUBLIC;
GRANT SELECT ON oraculo.source_monthly_records,oraculo.monthly_contexts,oraculo.monthly_closures,oraculo.monthly_publications TO oraculo_reader,oraculo_sync;
GRANT INSERT ON oraculo.source_monthly_records,oraculo.monthly_contexts,oraculo.monthly_closures,oraculo.monthly_publications TO oraculo_sync;
GRANT UPDATE(closure_id) ON oraculo.monthly_publications TO oraculo_sync;

INSERT INTO oraculo_migrations.applied(name,sha256) VALUES ('0009_monthly_competition.sql','e75371fa2ccda29dd3da6c2e236c75d4bbdfd5239466fa11910aee5eed1085d8');
COMMIT;
