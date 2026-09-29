-- Keep the owner's declarations with the immutable snapshot for later audit.
ALTER TABLE oraculo.competition_freezes
  ADD COLUMN backup_attested boolean NOT NULL DEFAULT false,
  ADD COLUMN no_match_attested boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT competition_backup_attested CHECK (backup_attested),
  ADD CONSTRAINT competition_correction_no_match CHECK
    ((supersedes_id IS NULL AND NOT no_match_attested) OR (supersedes_id IS NOT NULL AND no_match_attested));
