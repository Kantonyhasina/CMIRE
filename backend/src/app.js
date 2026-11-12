const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const referentielRoutes = require('./routes/referentielRoutes');
const disponibiliteRoutes = require('./routes/disponibiliteRoutes');
const permanenceRoutes = require('./routes/permanenceRoutes');
const missionRoutes = require('./routes/missionRoutes');
const congeRoutes = require('./routes/congeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const unite = require('./models/unite');
const poste = require('./models/poste');
const station = require('./models/station');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
// Express 5 laisse req.body indéfini quand aucun corps n'est envoyé
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/comptes', adminRoutes);
app.use('/api/unites', referentielRoutes(unite, 'Unité'));
app.use('/api/postes', referentielRoutes(poste, 'Poste'));
app.use('/api/stations', referentielRoutes(station, 'Station'));
app.use('/api/disponibilites', disponibiliteRoutes);
app.use('/api/permanences', permanenceRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/conges', congeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route introuvable' }));

// Gestionnaire d'erreurs central (erreurs métier + erreurs PostgreSQL)
app.use((erreur, req, res, next) => {
  const parCodePg = {
    '23505': [409, 'Cette valeur existe déjà'],
    '23503': [400, 'Référence invalide (ex. unité inexistante)'],
    '23514': [400, 'Valeur non autorisée (ex. fonction)'],
  };
  if (erreur.status) {
    return res.status(erreur.status).json({
      message: erreur.message,
      ...(erreur.details ? { details: erreur.details } : {}),
      ...(typeof erreur.code === 'string' && erreur.code.startsWith('CONFIRMATION') ? { code: erreur.code } : {}),
    });
  }
  if (parCodePg[erreur.code]) {
    const [status, message] = parCodePg[erreur.code];
    return res.status(status).json({ message });
  }
  console.error(erreur);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

module.exports = app;
