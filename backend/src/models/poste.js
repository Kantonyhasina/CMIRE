// Entity : Poste
const { creerReferentiel } = require('./referentiel');
module.exports = creerReferentiel({ table: 'poste', cle: 'numero_poste', libelle: 'nom_poste' });
