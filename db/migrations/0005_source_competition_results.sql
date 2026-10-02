-- Keep result facts from each imported workbook version separate from the cutoff snapshot.
CREATE TABLE oraculo.source_competition_results (
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  parser_version text NOT NULL,
  item_order integer NOT NULL CHECK (item_order > 0),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  PRIMARY KEY (source_version_id, parser_version, item_order),
  FOREIGN KEY (source_id, source_version_id)
    REFERENCES oraculo.source_versions(source_id, id)
);

GRANT SELECT ON oraculo.source_competition_results TO oraculo_reader, oraculo_sync;
GRANT INSERT ON oraculo.source_competition_results TO oraculo_sync;
