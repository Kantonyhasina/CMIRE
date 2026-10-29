# CMIRE : Backend (API REST)

Node.js / Express / PostgreSQL. Architecture en couches : routes → controllers → services → models.

## Démarrage

1. Installer Node.js 18 ou plus (https://nodejs.org, version LTS).
2. Base de données : nouvelle installation → exécuter `db/cmire_schema.sql` ;
   base existante → exécuter une seule fois `db/migration_001_telephone_matricule.sql`.
3. Dans ce dossier : `npm install`
4. Copier `.env.example` vers `.env` et renseigner le mot de passe PostgreSQL, le nom de la base et `JWT_SECRET`.
5. Créer un administrateur (le matricule est attribué automatiquement) :
   `npm run create-admin -- Nom Prenom identifiant MotDePasse123 3 0331234567`
   (arguments : nom, prénom, identifiant, mot de passe, numéro d'unité, téléphone facultatif)
6. Lancer : `npm run dev` puis ouvrir http://localhost:3000/api/health

## Routes

Les requêtes protégées envoient `Authorization: Bearer <token>`. Les droits sont relus en base à chaque
requête : un compte supprimé ou dont la fonction change perd ses accès immédiatement.

| Méthode | Route | Accès | Cas d'utilisation |
|---|---|---|---|
| POST | /api/auth/login | public | S'authentifier |
| GET | /api/auth/me | connecté | (session) |
| GET, POST | /api/comptes | Administrateur | Gérer les comptes du personnel |
| PUT, DELETE | /api/comptes/:matricule | Administrateur | Gérer les comptes du personnel |
| GET | /api/unites, /api/postes, /api/stations | connecté | (listes déroulantes) |
| POST, PUT /:id, DELETE /:id | mêmes routes | Administrateur | Gérer unités, postes, stations |
| GET | /api/disponibilites?numeroUnite=&dateDebut=&dateFin=&ignorer= | Chef (son unité), Administrateur | Vérifier la disponibilité |
| GET, PUT | /api/permanences/cadres | Chef (son unité), Administrateur | Planifier la permanence des cadres |
| GET, PUT | /api/permanences/surveillants | Chef, Administrateur | Planifier la permanence des surveillants |
| GET | /api/permanences/export?date= | Chef, Administrateur | Générer le tableau de permanence (PDF) |
| GET | /api/permanences/mon-planning?date= | Cadre, Surveillant | Consulter le planning de permanence |

Toutes les routes de permanences prennent une `date` (AAAA-MM-JJ) : n'importe quel jour de la semaine
voulue, la semaine (lundi → dimanche) est déduite. Elle est créée en base au premier enregistrement.

## Règles appliquées

- **Matricule** : attribué par la base (P001, P002, ...), jamais saisi, jamais modifiable.
- **Disponibilité (RG1/RG2)** : un agent est indisponible sur une période s'il a un congé *validé*,
  une mission ou une permanence (date exacte). L'administrateur n'est jamais proposé (super-utilisateur).
- **Planification** : un planning est refusé (409, avec le détail) si un agent est en congé validé ou en
  mission le jour affecté. Les autres permanences de l'agent ne comptent pas (plusieurs créneaux possibles).
- **Cadres (RG8)** : un chef de service ne planifie que les cadres de son unité ; l'administrateur toutes.
- **Surveillants** : tableau unique pour tous les postes et toutes les unités, donc planifiable par tout
  chef de service ; un seul surveillant par poste, jour et plage, mais le même peut tenir deux postes la nuit.
- **Enregistrement** : le planning d'une semaine est remplacé en bloc, dans une transaction (tout ou rien).
- **Comptes** : on ne peut pas supprimer son propre compte ni changer sa propre fonction ; la fonction
  d'un agent qui a des permanences ne peut pas changer ; un agent référencé ne peut pas être supprimé.
- **PUT /api/comptes** : un champ absent conserve la valeur actuelle (téléphone), un champ vide l'efface ;
  un mot de passe vide laisse le mot de passe inchangé.
