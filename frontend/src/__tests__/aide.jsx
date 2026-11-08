import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

export const ADMIN = { matricule: 'A001', nom: 'Rakoto', prenom: 'Jean', fonction: 'Administrateur', numeroUnite: 3 };
export const CADRE = { matricule: 'P002', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', numeroUnite: 1 };
export const SURVEILLANT = { matricule: 'P005', nom: 'Rakoto', prenom: 'Johny', fonction: 'Surveillant', numeroUnite: 1 };
export const CHEF = { matricule: 'P007', nom: 'Soa', prenom: 'Lala', fonction: 'Chef de service', numeroUnite: 1 };

export const ouvrirSession = (utilisateur) =>
  sessionStorage.setItem('cmire_session', JSON.stringify({ token: 'jeton', utilisateur }));

const reponse = (status, corps) => ({
  ok: status < 400, status, json: async () => corps, blob: async () => new Blob(['%PDF-test']),
});

// Simule l'API : { 'GET /api/unites': [status, corps], ... } (clé = méthode + chemin, sans query string).
// Un corps peut être une fonction (options) => corps pour réagir à la requête.
export function simulerApi(routes) {
  const fetchSimule = vi.fn(async (url, options = {}) => {
    const cle = `${options.method || 'GET'} ${url.split('?')[0]}`;
    const [status, corps] = routes[cle] ?? (cle === 'GET /api/conges/personnels-unite' ? [200, []] : [404, { message: `non simulé : ${cle}` }]);
    return reponse(status, typeof corps === 'function' ? corps(options, url) : corps);
  });
  globalThis.fetch = fetchSimule;
  return fetchSimule;
}

export const afficher = (chemin = '/') =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>
  );

export const appelsVers = (fetchSimule, methode, chemin) =>
  fetchSimule.mock.calls.filter(([url, o]) => (o?.method || 'GET') === methode && url.split('?')[0] === chemin);

export const corpsEnvoye = (appel) => JSON.parse(appel[1].body);
export const parametres = (appel) => Object.fromEntries(new URL(appel[0], 'http://x').searchParams);
