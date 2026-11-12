-- Notifications CMIRE : dates permettant de distinguer les éléments nouvellement créés/modifiés.
-- À exécuter une seule fois sur la base CMIRE existante.
-- Les anciennes lignes restent avec created_at NULL dans les tables qui n'avaient pas d'horodatage :
-- elles ne seront donc pas toutes signalées comme nouvelles après la migration.

-- Une permanence est recréée lors de l'enregistrement de la grille : son created_at
-- correspond donc à la dernière affectation enregistrée.
ALTER TABLE permanence_cadre
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE permanence_cadre
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE permanence_surveillant
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE permanence_surveillant
  ALTER COLUMN created_at SET DEFAULT NOW();

-- L'affectation d'un agent à une mission est horodatée indépendamment de la mission.
ALTER TABLE mission_intervenant
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE mission_intervenant
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Une modification de dates/station d'une mission doit aussi pouvoir déclencher une notification.
ALTER TABLE mission
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE mission
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Les décisions de congé (validé/refusé/reprise) doivent être horodatées.
-- On ne met pas de valeur par défaut sur les anciennes lignes updated_at : cela évite
-- de notifier rétroactivement toutes les décisions historiques lors du premier lancement.
ALTER TABLE conge
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION cmire_notifications_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_notifications_updated_at ON mission;
CREATE TRIGGER trg_mission_notifications_updated_at
BEFORE UPDATE ON mission
FOR EACH ROW
EXECUTE FUNCTION cmire_notifications_set_updated_at();

DROP TRIGGER IF EXISTS trg_conge_notifications_updated_at ON conge;
CREATE TRIGGER trg_conge_notifications_updated_at
BEFORE UPDATE ON conge
FOR EACH ROW
EXECUTE FUNCTION cmire_notifications_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_permanence_cadre_created_at
  ON permanence_cadre (matricule, created_at);
CREATE INDEX IF NOT EXISTS idx_permanence_surveillant_created_at
  ON permanence_surveillant (matricule, created_at);
CREATE INDEX IF NOT EXISTS idx_mission_intervenant_created_at
  ON mission_intervenant (matricule, created_at);
CREATE INDEX IF NOT EXISTS idx_conge_notifications_updated_at
  ON conge (matricule, updated_at, statut);
CREATE INDEX IF NOT EXISTS idx_conge_notifications_created_at
  ON conge (created_at, statut);
