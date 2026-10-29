// Valeurs identiques à la colonne personnel.fonction
const ROLES = {
  ADMIN: 'Administrateur',
  CHEF: 'Chef de service',
  CADRE: 'Cadre de maintenance',
  SURVEILLANT: 'Surveillant',
};

module.exports = { ROLES, FONCTIONS: Object.values(ROLES) };
