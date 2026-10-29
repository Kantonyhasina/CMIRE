-- =====================================================================
-- Base de données CMIRE : permanences, missions et congés
-- Issue du diagramme de classes de conception (6.4)
-- PostgreSQL 12+ | À exécuter sur une base VIDE
-- =====================================================================

-- ---------- Référentiels ----------

CREATE TABLE unite (
    numero_unite  SERIAL       PRIMARY KEY,
    nom_unite     VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE poste (
    numero_poste  SERIAL       PRIMARY KEY,
    nom_poste     VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE station (
    numero_station SERIAL       PRIMARY KEY,
    nom_station    VARCHAR(255) NOT NULL UNIQUE
);

-- numero_semaine = identifiant technique (auto-incrémenté).
-- Le n° de semaine ISO se déduit de date_debut : EXTRACT(WEEK FROM date_debut)
CREATE TABLE semaine (
    numero_semaine SERIAL  PRIMARY KEY,
    annee          INTEGER NOT NULL,
    date_debut     DATE    NOT NULL UNIQUE,
    date_fin       DATE    NOT NULL,
    CHECK (date_fin = date_debut + 6)   -- une semaine = 7 jours (ex. 15 au 21/12)
);

-- ---------- Matricules automatiques : P001, P002, ... ----------

CREATE SEQUENCE seq_matricule START 1;

CREATE FUNCTION generer_matricule() RETURNS TEXT
LANGUAGE sql AS $$
    SELECT 'P' || lpad(n::text, greatest(3, length(n::text)), '0')
      FROM (SELECT nextval('seq_matricule') AS n) t
$$;

-- ---------- Personnel ----------
-- Héritage Cadre / Surveillant : une seule table, distinguée par "fonction"
-- mot_de_passe : stocker un HASH (bcrypt), jamais le mot de passe en clair

CREATE TABLE personnel (
    matricule         VARCHAR(50)  PRIMARY KEY DEFAULT generer_matricule(),
    nom               VARCHAR(255) NOT NULL,
    prenom            VARCHAR(255) NOT NULL,
    fonction          VARCHAR(255) NOT NULL
                      CHECK (fonction IN ('Chef de service', 'Cadre de maintenance',
                                          'Surveillant', 'Administrateur')),
    identifiant       VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe      VARCHAR(255) NOT NULL,
    numero_telephone  VARCHAR(30),
    numero_unite      INTEGER      NOT NULL REFERENCES unite (numero_unite)
);

-- ---------- Permanences ----------

CREATE TABLE permanence_cadre (
    id_permc        SERIAL       PRIMARY KEY,
    jour_permc      VARCHAR(255) NOT NULL
                    CHECK (jour_permc IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi',
                                          'Vendredi', 'Samedi', 'Dimanche')),
    creneau         VARCHAR(255) NOT NULL,
    numero_semaine  INTEGER      NOT NULL REFERENCES semaine (numero_semaine),
    matricule       VARCHAR(50)  NOT NULL REFERENCES personnel (matricule),
    UNIQUE (numero_semaine, matricule, jour_permc, creneau)
);

CREATE TABLE permanence_surveillant (
    id_perms        SERIAL       PRIMARY KEY,
    jour_perms      VARCHAR(255) NOT NULL
                    CHECK (jour_perms IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi',
                                          'Vendredi', 'Samedi', 'Dimanche')),
    plage_horaire   VARCHAR(255) NOT NULL,
    numero_semaine  INTEGER      NOT NULL REFERENCES semaine (numero_semaine),
    numero_poste    INTEGER      NOT NULL REFERENCES poste (numero_poste),
    matricule       VARCHAR(50)  NOT NULL REFERENCES personnel (matricule),
    UNIQUE (numero_semaine, numero_poste, jour_perms, plage_horaire)
);

-- ---------- Missions ----------

CREATE TABLE mission (
    numero_mission      SERIAL  PRIMARY KEY,
    date_debut_mission  DATE    NOT NULL,
    date_fin_mission    DATE    NOT NULL,
    trimestre           INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    annee_mission       INTEGER NOT NULL,
    numero_station      INTEGER NOT NULL REFERENCES station (numero_station),
    CHECK (date_fin_mission >= date_debut_mission)
);

-- Classe-association Mission <-> Personnel
CREATE TABLE mission_intervenant (
    id_interv       SERIAL      PRIMARY KEY,
    numero_mission  INTEGER     NOT NULL REFERENCES mission (numero_mission) ON DELETE CASCADE,
    matricule       VARCHAR(50) NOT NULL REFERENCES personnel (matricule),
    UNIQUE (numero_mission, matricule)
);

-- ---------- Congés ----------

CREATE TABLE conge (
    id_conge          SERIAL       PRIMARY KEY,
    date_debut_conge  DATE         NOT NULL,
    date_fin_conge    DATE         NOT NULL,
    type              VARCHAR(255) NOT NULL,
    statut            VARCHAR(255) NOT NULL DEFAULT 'En attente'
                      CHECK (statut IN ('En attente', 'Validé', 'Refusé')),
    matricule         VARCHAR(50)  NOT NULL REFERENCES personnel (matricule),
    CHECK (date_fin_conge >= date_debut_conge)
);

-- ---------- Données initiales (optionnel) ----------

INSERT INTO unite (nom_unite) VALUES ('CNS'), ('ELB'), ('RSI');

INSERT INTO poste (nom_poste) VALUES
    ('Station terrienne Ivato'),
    ('Centrale électrique Ivato');
