require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET manquant : copiez .env.example vers .env et renseignez-le.');
  process.exit(1);
}

const app = require('./src/app');
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API CMIRE démarrée sur http://localhost:${port}`);
});
