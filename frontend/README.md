# CMIRE : Frontend (React + Vite)

## Démarrage

1. Le backend doit tourner sur http://localhost:3000 (voir `backend/README.md`).
2. Dans ce dossier : `npm install`
3. `npm run dev` puis ouvrir http://localhost:5173
4. Se connecter avec le compte créé par `npm run create-admin` côté backend.

En développement, les appels `/api/...` sont relayés vers le backend par Vite (voir `vite.config.js`).
Si le backend n'est pas sur le port 3000 : `VITE_BACKEND_URL=http://localhost:4000 npm run dev`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm test` | tests (Vitest + Testing Library) |
| `npm run build` | version de production dans `dist/` |

## Pages

| Route | Accès | Cas d'utilisation |
|---|---|---|
| /connexion | public | S'authentifier |
| / | connecté | accueil |
| /comptes, /referentiels | Administrateur | Gérer les comptes, les unités, postes et stations |
| /permanences | Chef de service | Planifier les permanences (cadres, surveillants), exporter le tableau Excel |
| /disponibilites | Chef de service | Vérifier la disponibilité du personnel de son unité |
| /missions | Chef (planifie, affecte) · Cadre, Surveillant (consultent) | Planifier une mission trimestrielle, affecter des intervenants, consulter le planning des missions |
| /demandes-conges | Chef de service | Valider une demande de congé (pastille du menu = demandes en attente) |
| /mes-conges | Cadre, Surveillant | Demander un congé |
| /calendrier-conges | Chef, Cadre, Surveillant | Consulter le calendrier des congés |
| /mon-planning | Cadre, Surveillant | Consulter son planning (permanences, missions, congés) |

## Structure

```
src/
  api.js               appels HTTP (jeton, erreurs, session expirée)
  auth/                AuthContext (session) + RequireAuth (pages protégées par rôle)
  components/Layout    en-tête et menu selon la fonction
  pages/               une page par écran (Permanences = GrilleCadres + GrilleSurveillants ; Missions = tableau + panneau d'affectation)
  utils/dates.js       dates en texte AAAA-MM-JJ
  __tests__/           tests
```
