// Entity : Unite
const { creerReferentiel } = require('./referentiel');
module.exports = creerReferentiel({ table: 'unite', cle: 'numero_unite', libelle: 'nom_unite' });
