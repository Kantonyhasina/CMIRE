// Control : cas « Gérer les unités et postes » et « Gérer les stations VSAT/VHF »
const { ErreurMetier } = require('../utils/erreurs');

function lireId(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id <= 0) throw new ErreurMetier('Identifiant invalide', 400);
  return id;
}

function lireNom(corps) {
  const nom = typeof corps?.nom === 'string' ? corps.nom.trim() : '';
  if (!nom || nom.length > 255) {
    throw new ErreurMetier('Le nom est obligatoire (255 caractères maximum)', 400);
  }
  return nom;
}

const doublon = (e) => (e.code === '23505' ? new ErreurMetier('Ce nom existe déjà', 409) : e);

function creerControleur(modele, libelleEntite) {
  const introuvable = () => new ErreurMetier(`${libelleEntite} introuvable`, 404);

  return {
    async lister(req, res, next) {
      try { res.json(await modele.findAll()); } catch (e) { next(e); }
    },
    async creer(req, res, next) {
      try { res.status(201).json(await modele.create(lireNom(req.body))); } catch (e) { next(doublon(e)); }
    },
    async modifier(req, res, next) {
      try {
        const element = await modele.update(lireId(req.params.id), lireNom(req.body));
        if (!element) throw introuvable();
        res.json(element);
      } catch (e) { next(doublon(e)); }
    },
    async supprimer(req, res, next) {
      try {
        if (!(await modele.remove(lireId(req.params.id)))) throw introuvable();
        res.status(204).end();
      } catch (e) {
        next(e.code === '23503'
          ? new ErreurMetier('Suppression impossible : cet élément est encore utilisé', 409)
          : e);
      }
    },
  };
}

module.exports = { creerControleur };
