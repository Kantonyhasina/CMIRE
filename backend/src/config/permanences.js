// Grilles des tableaux de permanence (d'après les tableaux papier du service)
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Cadres de maintenance : 3 créneaux par jour (06h-15h00 | 15h00-18h30 | 18h30-06h)
const CRENEAUX_CADRE = ['06h-15h00', '15h00-18h30', '18h30-06h'];

// Surveillants : 3 plages par jour et par poste
const PLAGES_SURVEILLANT = ['06:00-12:00', '12:00-18:30', '18:30-06:00'];

module.exports = { JOURS, CRENEAUX_CADRE, PLAGES_SURVEILLANT };
