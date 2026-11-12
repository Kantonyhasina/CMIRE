import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADMIN, CADRE, CHEF, afficher, appelsVers, corpsEnvoye, ouvrirSession, simulerApi } from './aide.jsx';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('connexion', () => {
  it('affiche le formulaire et désactive le bouton tant que les champs sont vides', () => {
    afficher('/connexion');
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled();
  });

  it('connecte l\'utilisateur, appelle l\'API et ouvre l\'accueil', async () => {
    const fetchSimule = simulerApi({ 'POST /api/auth/login': [200, { token: 'abc', utilisateur: ADMIN }] });
    const user = userEvent.setup();
    afficher('/connexion');

    await user.type(screen.getByLabelText('Identifiant'), '  admin ');
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse123');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Bonjour Jean Rakoto')).toBeInTheDocument();
    const [url, options] = fetchSimule.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ identifiant: 'admin', motDePasse: 'motdepasse123' });
    expect(JSON.parse(sessionStorage.getItem('cmire_session')).token).toBe('abc');
  });

  it('affiche le message du serveur si les identifiants sont faux', async () => {
    simulerApi({ 'POST /api/auth/login': [401, { message: 'Identifiant ou mot de passe incorrect' }] });
    const user = userEvent.setup();
    afficher('/connexion');

    await user.type(screen.getByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'faux');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiant ou mot de passe incorrect');
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(sessionStorage.getItem('cmire_session')).toBeNull();
  });

  it('signale un serveur injoignable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    afficher('/connexion');

    await user.type(screen.getByLabelText('Identifiant'), 'admin');
    await user.type(screen.getByLabelText('Mot de passe'), 'x');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur injoignable');
  });
});

describe('protection des pages', () => {
  it('redirige vers la connexion sans session', () => {
    afficher('/comptes');
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });

  it('un cadre ne voit aucun menu d\'administration et reçoit « Accès refusé »', () => {
    ouvrirSession(CADRE);
    afficher('/comptes');
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(menu).getByText('Tableau de bord')).toBeInTheDocument();
    expect(within(menu).queryByText('Comptes')).not.toBeInTheDocument();
    expect(within(menu).queryByText('Disponibilités')).not.toBeInTheDocument();
  });

  it('un administrateur ne voit que comptes, référentiels et accueil', () => {
    ouvrirSession(ADMIN);
    simulerApi({});
    afficher('/');
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    for (const lien of ['Tableau de bord', 'Comptes', 'Comptes désactivés', 'Référentiels']) {
      expect(within(menu).getByText(lien)).toBeInTheDocument();
    }
    for (const lien of ['Permanences', 'Disponibilités', 'Mon planning']) {
      expect(within(menu).queryByText(lien)).not.toBeInTheDocument();
    }
  });

  it('l\'administrateur est refusé sur les permanences et les disponibilités', () => {
    ouvrirSession(ADMIN);
    simulerApi({});
    const { unmount } = afficher('/permanences');
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
    unmount();
    afficher('/disponibilites');
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
  });

  it('referme la session quand l\'API répond 401 (jeton expiré)', async () => {
    ouvrirSession(ADMIN);
    simulerApi({
      'GET /api/comptes': [401, { message: 'Session invalide ou expirée' }],
      'GET /api/unites': [401, { message: 'Session invalide ou expirée' }],
    });
    afficher('/comptes');

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(sessionStorage.getItem('cmire_session')).toBeNull();
  });

  it('se déconnecte via le bouton', async () => {
    ouvrirSession(CADRE);
    const user = userEvent.setup();
    afficher('/');
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(sessionStorage.getItem('cmire_session')).toBeNull();
  });
});

describe('gestion des comptes', () => {
  const unites = [200, [{ numero_unite: 1, nom_unite: 'CNS' }, { numero_unite: 3, nom_unite: 'RSI' }]];
  const liste = [200, [
    { matricule: 'A001', nom: 'Rakoto', prenom: 'Jean', fonction: 'Administrateur', identifiant: 'admin', numero_unite: 3, nom_unite: 'RSI', numero_telephone: null, actif: true },
    { matricule: 'P002', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', identifiant: 'prabe', numero_unite: 1, nom_unite: 'CNS', numero_telephone: '0332337086', actif: true },
  ]];

  it('crée un compte sans saisir de matricule et affiche celui attribué', async () => {
    ouvrirSession(ADMIN);
    const fetchSimule = simulerApi({
      'GET /api/comptes': liste, 'GET /api/unites': unites,
      'POST /api/comptes': [201, { matricule: 'P009' }],
    });
    const user = userEvent.setup();
    afficher('/comptes');
    expect(await screen.findByText('Rabe')).toBeInTheDocument();

    expect(screen.queryByLabelText('Matricule')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nom'), 'Soa');
    await user.type(screen.getByLabelText('Prénom'), 'Hery');
    await user.selectOptions(screen.getByLabelText('Unité'), 'RSI');
    await user.type(screen.getByLabelText('Téléphone'), '0332337178');
    await user.type(screen.getByLabelText('Identifiant'), 'hsoa');
    await user.type(screen.getByLabelText(/Mot de passe/), 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Compte créé : Hery Soa (matricule P009)');
    const appel = appelsVers(fetchSimule, 'POST', '/api/comptes')[0];
    expect(appel[1].headers.Authorization).toBe('Bearer jeton');
    expect(corpsEnvoye(appel)).toMatchObject({
      nom: 'Soa', prenom: 'Hery', fonction: 'Cadre de maintenance', numeroUnite: 3,
      numeroTelephone: '0332337178', identifiant: 'hsoa',
    });
    expect(corpsEnvoye(appel)).not.toHaveProperty('matricule');
  });

  it('affiche l\'erreur du serveur (identifiant déjà pris)', async () => {
    ouvrirSession(ADMIN);
    simulerApi({
      'GET /api/comptes': [200, []], 'GET /api/unites': unites,
      'POST /api/comptes': [409, { message: 'Cet identifiant existe déjà' }],
    });
    const user = userEvent.setup();
    afficher('/comptes');
    await screen.findByText('Aucun compte');

    await user.type(screen.getByLabelText('Nom'), 'A');
    await user.type(screen.getByLabelText('Prénom'), 'B');
    await user.selectOptions(screen.getByLabelText('Unité'), 'CNS');
    await user.type(screen.getByLabelText('Identifiant'), 'ab');
    await user.type(screen.getByLabelText(/Mot de passe/), 'motdepasse1');
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cet identifiant existe déjà');
  });

  it('affiche matricule et téléphone dans le tableau', async () => {
    ouvrirSession(ADMIN);
    simulerApi({ 'GET /api/comptes': liste, 'GET /api/unites': unites });
    afficher('/comptes');
    const ligne = (await screen.findByText('Rabe')).closest('tr');
    expect(within(ligne).getByText('P002')).toBeInTheDocument();
    expect(within(ligne).getByText('0332337086')).toBeInTheDocument();
  });

  it('modifie un compte : formulaire prérempli, matricule en lecture seule, mot de passe vide', async () => {
    ouvrirSession(ADMIN);
    const fetchSimule = simulerApi({
      'GET /api/comptes': liste, 'GET /api/unites': unites,
      'PUT /api/comptes/P002': [200, { matricule: 'P002' }],
    });
    const user = userEvent.setup();
    afficher('/comptes');
    await user.click(await screen.findByRole('button', { name: 'Modifier Paul Rabe' }));

    expect(screen.getByRole('heading', { name: 'Modifier le compte P002' })).toBeInTheDocument();
    expect(screen.getByLabelText('Matricule')).toHaveValue('P002');
    expect(screen.getByLabelText('Matricule')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nom')).toHaveValue('Rabe');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('0332337086');
    expect(screen.getByLabelText('Unité')).toHaveValue('1');

    await user.clear(screen.getByLabelText('Téléphone'));
    await user.type(screen.getByLabelText('Téléphone'), '0339999999');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Compte P002 modifié');
    expect(corpsEnvoye(appelsVers(fetchSimule, 'PUT', '/api/comptes/P002')[0])).toMatchObject({
      nom: 'Rabe', numeroUnite: 1, numeroTelephone: '0339999999', motDePasse: '',
    });
    expect(screen.getByRole('heading', { name: 'Nouveau compte' })).toBeInTheDocument();
  });

  it('annuler une modification remet le formulaire à zéro', async () => {
    ouvrirSession(ADMIN);
    simulerApi({ 'GET /api/comptes': liste, 'GET /api/unites': unites });
    const user = userEvent.setup();
    afficher('/comptes');
    await user.click(await screen.findByRole('button', { name: 'Modifier Paul Rabe' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('heading', { name: 'Nouveau compte' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toHaveValue('');
  });

  it('désactive un compte sans utiliser de suppression physique', async () => {
    ouvrirSession(ADMIN);
    const fetchSimule = simulerApi({
      'GET /api/comptes': liste, 'GET /api/unites': unites,
      'PATCH /api/comptes/P002/activation': [200, { matricule: 'P002', actif: false }],
    });
    const user = userEvent.setup();
    afficher('/comptes');

    expect(await screen.findByRole('button', { name: 'Désactiver Jean Rakoto' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Désactiver Paul Rabe' }));
    await user.click(screen.getByRole('button', { name: 'Désactiver le compte' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Compte P002 désactivé');
    const appel = appelsVers(fetchSimule, 'PATCH', '/api/comptes/P002/activation')[0];
    expect(corpsEnvoye(appel)).toEqual({ actif: false });
    expect(fetchSimule.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  });

  it('réactive un compte depuis les comptes désactivés', async () => {
    ouvrirSession(ADMIN);
    const compteDesactive = { ...liste[1][1], actif: false, dateDesactivation: '2026-10-01T00:00:00.000Z' };
    const fetchSimule = simulerApi({
      'GET /api/comptes': [200, [compteDesactive]], 'GET /api/unites': unites,
      'PATCH /api/comptes/P002/activation': [200, { matricule: 'P002', actif: true }],
    });
    const user = userEvent.setup();
    afficher('/comptes/desactives');

    await user.click(await screen.findByRole('button', { name: 'Réactiver Paul Rabe' }));
    await user.click(screen.getByRole('button', { name: 'Réactiver le compte' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Compte P002 réactivé');
    const appel = appelsVers(fetchSimule, 'PATCH', '/api/comptes/P002/activation')[0];
    expect(corpsEnvoye(appel)).toEqual({ actif: true });
  });
});

describe('référentiels', () => {
  it('ajoute puis supprime une station (avec confirmation)', async () => {
    ouvrirSession(ADMIN);
    let stations = [];
    const fetchSimule = vi.fn(async (url, options = {}) => {
      const methode = options.method || 'GET';
      if (url === '/api/stations' && methode === 'GET') return { ok: true, status: 200, json: async () => stations };
      if (url === '/api/stations' && methode === 'POST') {
        stations = [{ numero_station: 7, nom_station: JSON.parse(options.body).nom }];
        return { ok: true, status: 201, json: async () => stations[0] };
      }
      if (url === '/api/stations/7' && methode === 'DELETE') { stations = []; return { ok: true, status: 204, json: async () => null }; }
      return { ok: true, status: 200, json: async () => [] };
    });
    globalThis.fetch = fetchSimule;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    afficher('/referentiels');

    await user.type(screen.getByLabelText('Nom du nouvel élément (station)'), 'Antsiranana');
    await user.click(within(screen.getByRole('heading', { name: 'Stations VSAT/VHF' }).closest('section')).getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Antsiranana')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(window.confirm).toHaveBeenCalledWith('Supprimer « Antsiranana » ?');
    expect(await screen.findAllByText('Aucun élément')).toHaveLength(3);
  });

  it('affiche l\'erreur quand la suppression est refusée', async () => {
    ouvrirSession(ADMIN);
    simulerApi({
      'GET /api/unites': [200, [{ numero_unite: 1, nom_unite: 'CNS' }]],
      'GET /api/postes': [200, []],
      'GET /api/stations': [200, []],
      'DELETE /api/unites/1': [409, { message: 'Suppression impossible : cet élément est encore utilisé' }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    afficher('/referentiels');

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('encore utilisé');
    expect(screen.getByText('CNS')).toBeInTheDocument();
  });
});

describe('disponibilités', () => {
  const personnels = [
    { matricule: 'C1', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', disponible: false,
      conflits: [{ type: 'permanence', dateDebut: '2025-12-15', dateFin: '2025-12-15', detail: 'Permanence cadre (06h-15h)' }] },
    { matricule: 'S1', nom: 'Hery', prenom: 'Lova', fonction: 'Surveillant', disponible: false,
      conflits: [{ type: 'conge', dateDebut: '2025-12-16', dateFin: '2025-12-18', detail: 'Congé : Annuel' }] },
    { matricule: 'C2', nom: 'Soa', prenom: 'Mino', fonction: 'Cadre de maintenance', disponible: true, conflits: [] },
  ];

  it('chef de service : unité verrouillée, envoie la période et affiche les conflits', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = simulerApi({
      'GET /api/unites': [200, [{ numero_unite: 1, nom_unite: 'CNS' }, { numero_unite: 2, nom_unite: 'ELB' }]],
      'GET /api/disponibilites': [200, personnels],
    });
    const user = userEvent.setup();
    afficher('/disponibilites');

    await screen.findByRole('option', { name: 'CNS' }); // attendre le chargement de la liste des unités
    expect(screen.getByLabelText('Unité')).toBeDisabled();
    expect(screen.getByLabelText('Unité')).toHaveValue('1');

    await user.clear(screen.getByLabelText('Du'));
    await user.type(screen.getByLabelText('Du'), '2025-12-15');
    await user.clear(screen.getByLabelText('Au'));
    await user.type(screen.getByLabelText('Au'), '2025-12-21');
    await user.click(screen.getByLabelText(/Ignorer les permanences/));
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(await screen.findByText('Résultat : 1 disponible(s) sur 3')).toBeInTheDocument();
    expect(screen.getByText('Permanence cadre (06h-15h) (15/12/2025)')).toBeInTheDocument();
    expect(screen.getByText('Congé : Annuel (du 16/12/2025 au 18/12/2025)')).toBeInTheDocument();
    expect(screen.getAllByText('Indisponible')).toHaveLength(2);
    expect(screen.getByText('Disponible')).toBeInTheDocument();

    const url = fetchSimule.mock.calls.find(([u]) => u.startsWith('/api/disponibilites'))[0];
    const q = new URL(url, 'http://x').searchParams;
    expect(Object.fromEntries(q)).toEqual({ numeroUnite: '1', dateDebut: '2025-12-15', dateFin: '2025-12-21', ignorer: 'permanence' });
  });

  it('affiche l\'erreur du serveur (ex. RG8)', async () => {
    ouvrirSession(CHEF);
    simulerApi({
      'GET /api/unites': [200, []],
      'GET /api/disponibilites': [403, { message: 'Vous ne pouvez consulter que les personnels de votre unité' }],
    });
    const user = userEvent.setup();
    afficher('/disponibilites');
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('votre unité');
  });
});
