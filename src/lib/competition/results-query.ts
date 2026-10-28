// Use the last extraction format until the current version has been synced.
// The successful-run marker also distinguishes a deliberately empty extraction
// from one that has not run yet, so old facts are never resurrected.
export const PUBLISHED_PLAYOFF_RESULTS_SQL = `
  SELECT record FROM oraculo.source_competition_results
   WHERE source_id = $1 AND source_version_id = $2
     AND parser_version = CASE WHEN EXISTS (
       SELECT 1 FROM oraculo.sync_runs
        WHERE source_id = $1 AND version_id = $2
          AND status IN ('succeeded', 'unchanged')
          AND counts->>'playoffParserRevision' = $4::text
     ) THEN $3 ELSE '2026.2' END
   ORDER BY item_order`;
