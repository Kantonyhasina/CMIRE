// Control : AdminController (cas « Gérer les comptes du personnel »)
const bcrypt = require('bcryptjs');
const Personnel = require('../models/personnel');
const Unite = require('../models/unite');
const { ErreurMetier } = require('../utils/erreurs');
const { FONCTIONS, ROLES } = require('../config/roles');

const FORMAT_TELEPHONE = /^[0-9+\-. ()]{6,30}$/;

function texteObligatoire(valeur, libelle) {
  const texte = typeof valeur === 'string' ? valeur.trim() : '';
  if (!texte || texte.length > 255) {
    throw new ErreurMetier(`${libelle} obligatoire (255 caractères maximum)`, 400);
  }
  return texte;
}

// Valide le corps d'une création ou d'une modification. Le matricule n'en fait jamais partie.
function lireCompte(corps, { motDePasseObligatoire }) {
  const c = corps ?? {};
  const nom = texteObligatoire(c.nom, 'Le nom');
  const prenom = texteObligatoire(c.prenom, 'Le prénom');
  const identifiant = texteObligatoire(c.identifiant, "L'identifiant");

  if (!FONCTIONS.includes(c.fonction)) throw new ErreurMetier('Fonction invalide', 400);

  const numeroUnite = Number(c.numeroUnite);
  if (!Number.isInteger(numeroUnite) || numeroUnite <= 0) throw new ErreurMetier('Unité invalide', 400);

  let numeroTelephone = null;
  if (c.numeroTelephone !== undefined && c.numeroTelephone !== null && String(c.numeroTelephone).trim() !== '') {
    numeroTelephone = String(c.numeroTelephone).trim();
    if (!FORMAT_TELEPHONE.test(numeroTelephone)) throw new ErreurMetier('Numéro de téléphone invalide', 400);
  }

  let motDePasse = null;
  if (c.motDePasse) {
    if (typeof c.motDePasse !== 'string' || c.motDePasse.length < 8) {
      throw new ErreurMetier('Le mot de passe doit contenir au moins 8 caractères', 400);
    }
    motDePasse = c.motDePasse;
  } else if (motDePasseObligatoire) {
    throw new ErreurMetier('Le mot de passe doit contenir au moins 8 caractères', 400);
  }

  return { nom, prenom, identifiant, fonction: c.fonction, numeroUnite, numeroTelephone, motDePasse };
}

async function verifierUniteEtIdentifiant({ numeroUnite, identifiant }, matriculeActuel = null) {
  if (!(await Unite.existe(numeroUnite))) throw new ErreurMetier('Unité inexistante', 400);
  if (await Personnel.identifiantExiste(identifiant, matriculeActuel)) {
    throw new ErreurMetier('Cet identifiant existe déjà', 409);
  }
}

const doublon = (e) => (e.code === '23505' ? new ErreurMetier('Cet identifiant existe déjà', 409) : e);

async function listerComptes(req, res, next) {
  try {
    res.json(await Personnel.findAll());
  } catch (erreur) {
    next(erreur);
  }
}

async function creerCompte(req, res, next) {
  try {
    const donnees = lireCompte(req.body, { motDePasseObligatoire: true });
    await verifierUniteEtIdentifiant(donnees);

    const compte = await Personnel.create({
      ...donnees,
      motDePasseHash: await bcrypt.hash(donnees.motDePasse, 10),
    });
    res.status(201).json(compte);
  } catch (erreur) {
    next(doublon(erreur));
  }
}

async function modifierCompte(req, res, next) {
  try {
    const { matricule } = req.params;
    const existant = await Personnel.findByMatricule(matricule);
    if (!existant) throw new ErreurMetier('Compte introuvable', 404);

    const donnees = lireCompte(req.body, { motDePasseObligatoire: false });
    // Champ absent = on conserve le téléphone actuel ; champ vide = on l'efface
    if (req.body.numeroTelephone === undefined) donnees.numeroTelephone = existant.numero_telephone;

    // Un administrateur ne peut pas se retirer lui-même ses droits (risque de se bloquer)
    if (matricule === req.utilisateur.matricule && donnees.fonction !== ROLES.ADMIN) {
      throw new ErreurMetier('Vous ne pouvez pas modifier votre propre fonction', 400);
    }
    // Les permanences existantes sont liées à la fonction (cadre ou surveillant)
    if (donnees.fonction !== existant.fonction && (await Personnel.aDesPermanences(matricule))) {
      throw new ErreurMetier(
        'Changement de fonction impossible : cet agent a des permanences enregistrées', 409);
    }
    await verifierUniteEtIdentifiant(donnees, matricule);

    const compte = await Personnel.update(matricule, {
      ...donnees,
      motDePasseHash: donnees.motDePasse ? await bcrypt.hash(donnees.motDePasse, 10) : null,
    });
    res.json(compte);
  } catch (erreur) {
    next(doublon(erreur));
  }
}

async function supprimerCompte(req, res, next) {
  try {
    const { matricule } = req.params;
    if (matricule === req.utilisateur.matricule) {
      throw new ErreurMetier('Vous ne pouvez pas supprimer votre propre compte', 400);
    }
    if (!(await Personnel.remove(matricule))) throw new ErreurMetier('Compte introuvable', 404);
    res.status(204).end();
  } catch (erreur) {
    next(erreur.code === '23503'
      ? new ErreurMetier('Suppression impossible : cet agent a des permanences, missions ou congés enregistrés', 409)
      : erreur);
  }
}

module.exports = { listerComptes, creerCompte, modifierCompte, supprimerCompte };
