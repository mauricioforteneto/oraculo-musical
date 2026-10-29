-- Immutable extraction of explicit decisions from each published workbook.
CREATE TABLE oraculo.source_top50_decisions (
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  parser_revision integer NOT NULL CHECK (parser_revision > 0),
  item_order integer NOT NULL CHECK (item_order > 0),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  PRIMARY KEY (source_version_id, parser_revision, item_order),
  FOREIGN KEY (source_id, source_version_id) REFERENCES oraculo.source_versions(source_id, id)
);
REVOKE ALL ON oraculo.source_top50_decisions FROM PUBLIC;
GRANT SELECT ON oraculo.source_top50_decisions TO oraculo_reader, oraculo_sync;
GRANT INSERT ON oraculo.source_top50_decisions TO oraculo_sync;
