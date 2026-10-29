// Crée un compte Administrateur. Le matricule est généré automatiquement (P001, P002, ...).
// Usage : npm run create-admin -- <nom> <prenom> <identifiant> <motDePasse> <numeroUnite> [telephone]
require('dotenv').config();
const bcrypt = require('bcryptjs');
const Personnel = require('../src/models/personnel');
const db = require('../src/config/db');

async function main() {
  const [nom, prenom, identifiant, motDePasse, numeroUnite, numeroTelephone] = process.argv.slice(2);
  if (!numeroUnite) {
    console.error('Usage : npm run create-admin -- <nom> <prenom> <identifiant> <motDePasse> <numeroUnite> [telephone]');
    process.exit(1);
  }
  const compte = await Personnel.create({
    nom, prenom,
    fonction: 'Administrateur',
    identifiant,
    motDePasseHash: await bcrypt.hash(motDePasse, 10),
    numeroUnite: Number(numeroUnite),
    numeroTelephone: numeroTelephone || null,
  });
  console.log('Administrateur créé :', compte);
}

main()
  .catch((e) => { console.error('Échec :', e.message); process.exitCode = 1; })
  .finally(() => db.pool.end());
