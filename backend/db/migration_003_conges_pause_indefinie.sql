-- Étape 4 : congés directs du chef et indisponibilités sans durée connue.
-- À exécuter une seule fois sur la base CMIRE existante.

ALTER TABLE conge
  ALTER COLUMN date_debut_conge DROP NOT NULL,
  ALTER COLUMN date_fin_conge DROP NOT NULL;

ALTER TABLE conge DROP CONSTRAINT IF EXISTS conge_statut_check;
ALTER TABLE conge ADD CONSTRAINT conge_statut_check
  CHECK (statut IN ('En attente', 'Validé', 'Refusé', 'En pause', 'Repris'));

ALTER TABLE conge
  ADD COLUMN IF NOT EXISTS date_reprise DATE,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) REFERENCES personnel(matricule),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE conge DROP CONSTRAINT IF EXISTS conge_check;
ALTER TABLE conge ADD CONSTRAINT conge_periode_coherente_check
  CHECK (
    (date_debut_conge IS NULL AND date_fin_conge IS NULL AND statut IN ('En pause', 'Repris'))
    OR
    (date_debut_conge IS NOT NULL AND date_fin_conge IS NOT NULL AND date_fin_conge >= date_debut_conge)
  );

ALTER TABLE conge ADD CONSTRAINT conge_reprise_coherente_check
  CHECK (date_reprise IS NULL OR statut = 'Repris');

CREATE INDEX IF NOT EXISTS idx_conge_personnel_statut_periode
  ON conge (matricule, statut, date_debut_conge, date_fin_conge);
