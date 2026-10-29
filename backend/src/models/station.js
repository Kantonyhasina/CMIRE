// Entity : Station
const { creerReferentiel } = require('./referentiel');
module.exports = creerReferentiel({ table: 'station', cle: 'numero_station', libelle: 'nom_station' });
