# CMIRE : Backend (API REST)

Node.js / Express / PostgreSQL. Architecture en couches : routes → controllers → services → models.

## Démarrage

1. Installer Node.js 18 ou plus (https://nodejs.org, version LTS).
2. Base de données : nouvelle installation → exécuter `db/cmire_schema.sql`, puis les migrations nécessaires à votre version.
   Pour une base CMIRE déjà utilisée avec les migrations 001 à 003, exécuter maintenant `db/migration_004_comptes_activation.sql` une seule fois.
3. Dans ce dossier : `npm install`
4. Copier `.env.example` vers `.env` et renseigner le mot de passe PostgreSQL, le nom de la base et `JWT_SECRET`.
5. Créer un administrateur (le matricule est attribué automatiquement) :
   `npm run create-admin -- Nom Prenom identifiant MotDePasse123 3 0331234567`
6. Lancer : `npm run dev` puis ouvrir http://localhost:3000/api/health

## Qui fait quoi

| Fonction | Responsabilités |
|---|---|
| **Administrateur** | comptes du personnel, unités, postes, stations. Rien d'autre. |
| **Chef de service** | permanences (cadres de son unité, tableau des surveillants), disponibilités, missions (planification + affectation des agents de son unité), demandes de congé de son unité (valider / refuser / annuler) |
| **Cadre, Surveillant** | consulter leur planning, les missions et le calendrier des congés ; demander un congé |

## Routes

Les requêtes protégées envoient `Authorization: Bearer <token>`. Les droits et le statut actif sont relus en base à chaque
requête : un compte désactivé perd immédiatement ses accès, sans suppression de ses données historiques.

| Méthode | Route | Accès |
|---|---|---|
| POST | /api/auth/login | public |
| GET | /api/auth/me | connecté |
| GET, POST, PUT /:matricule | /api/comptes | Administrateur |
| PATCH /:matricule/activation (`{ actif: true/false }`) | /api/comptes | Administrateur |
| GET | /api/dashboard | Utilisateur connecté (indicateurs selon le rôle) |
| GET | /api/unites, /api/postes, /api/stations | connecté |
| POST, PUT /:id, DELETE /:id | mêmes routes | Administrateur |
| GET | /api/disponibilites?numeroUnite=&dateDebut=&dateFin=&ignorer= | Chef (son unité) |
| GET, PUT | /api/permanences/cadres | Chef (son unité) |
| GET, PUT | /api/permanences/surveillants | Chef |
| GET | /api/permanences/export?date= (Excel, 2 feuilles) | Chef |
| GET | /api/permanences/mon-planning?date= (permanences, missions, congés) | Cadre, Surveillant |
| GET | /api/missions?annee=&trimestre= | Chef, Cadre, Surveillant |
| POST, PUT /:id, DELETE /:id | /api/missions | Chef |
| GET /:id/candidats, PUT /:id/intervenants | /api/missions | Chef (agents de son unité) |
| GET | /api/conges/mes-demandes | Cadre, Surveillant |
| POST, DELETE /:id | /api/conges | Cadre, Surveillant (DELETE : sa demande en attente) |
| GET /unite?statut=En attente\|Validé, GET /unite/nombre | /api/conges | Chef |
| PUT /:id/decision, DELETE /:id | /api/conges | Chef (DELETE : tout congé de son unité) |
| GET | /api/conges/calendrier?dateDebut=&dateFin= | Chef, Cadre, Surveillant |

## Règles appliquées

- **Matricule** : attribué par la base (P001, P002, ...), jamais saisi, jamais modifiable.
- **Disponibilité (RG1/RG2)** : un agent est indisponible sur une période s'il a un congé *validé*, une
  mission ou une permanence (date exacte). Une demande de congé « En attente » ou « Refusé » ne bloque rien.
- **Congés** : l'agent demande, le chef de **son unité** valide ou refuse. Une demande qui chevauche une
  mission ou une permanence est acceptée avec une alerte ; pour la **valider**, le chef doit confirmer
  (`confirmer: true`, sinon 409 `CONFIRMATION_REQUISE` avec le détail). Pas de chevauchement entre ses propres demandes.
- **Calendrier** : le motif d'un congé (maladie, hospitalisation) n'est visible que du chef et de l'intéressé.
- **Missions** : le trimestre se déduit de la date de début. Chaque chef affecte les agents de **son**
  unité. Une mission ne peut être modifiée ou supprimée que si aucun agent d'une autre unité n'y participe.
  La mission en cours d'affectation n'est pas comptée comme un conflit avec elle-même.
- **Permanences** : un planning est refusé (409, avec le détail) si un agent est en congé validé ou en
  mission le jour affecté. Le planning d'une semaine est remplacé en bloc, dans une transaction.
- **Surveillants** : tableau unique pour tous les postes ; le même surveillant peut tenir deux postes la nuit.
- **Comptes** : la désactivation est logique (`personnel.actif = false`) ; elle interdit la connexion et les nouvelles sélections de personnel. Les permanences, missions et congés liés au matricule restent conservés. Un administrateur peut réactiver le compte depuis l'écran « Comptes désactivés ». Il ne peut pas désactiver son propre compte.
