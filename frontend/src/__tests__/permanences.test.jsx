import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CADRE, CHEF, SURVEILLANT, afficher, appelsVers, corpsEnvoye, ouvrirSession, parametres, simulerApi } from './aide.jsx';
import { ajouterJours, semaineCourante } from '../utils/dates.js';

const SEMAINE = { dateDebut: '2025-12-15', dateFin: '2025-12-21', annee: 2025, numeroIso: 51, enregistree: true };
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  .map((nom, i) => ({ nom, date: `2025-12-${15 + i}` }));
const UNITES = [200, [{ numero_unite: 1, nom_unite: 'TECH CNS' }, { numero_unite: 2, nom_unite: 'TECH ELB' }, { numero_unite: 3, nom_unite: 'RSI' }]];

const CADRES = {
  semaine: SEMAINE, jours: JOURS, creneaux: ['06h-15h00', '15h00-18h30', '18h30-06h'],
  agents: [
    { matricule: 'P002', nom: 'Rabe', prenom: 'Paul', numeroTelephone: '0332337086', indisponibilites: [] },
    { matricule: 'P003', nom: 'Soa', prenom: 'Mino', numeroTelephone: null,
      indisponibilites: [{ type: 'conge', dateDebut: '2025-12-16', dateFin: '2025-12-18', detail: 'Congé : Annuel' }] },
  ],
  affectations: [{ matricule: 'P002', jour: 'Lundi', creneau: '06h-15h00' }],
};

const SURVEILLANTS = {
  semaine: SEMAINE, jours: JOURS, plages: ['06:00-12:00', '12:00-18:30', '18:30-06:00'],
  postes: [{ numero_poste: 1, nom_poste: 'Station terrienne Ivato' }, { numero_poste: 2, nom_poste: 'Centrale électrique Ivato' }],
  agents: [
    { matricule: 'P005', nom: 'Rakoto', prenom: 'Johny', identifiant: 'JRA', numeroUnite: 2, nomUnite: 'TECH ELB', indisponibilites: [] },
    { matricule: 'P006', nom: 'Rasoa', prenom: 'Nirina', identifiant: 'NRA', numeroUnite: 1, nomUnite: 'TECH CNS',
      indisponibilites: [{ type: 'conge', dateDebut: '2025-12-17', dateFin: '2025-12-17', detail: 'Congé : Maladie' }] },
  ],
  affectations: [],
};

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('menus selon la fonction', () => {
  it('le chef de service voit « Permanences », pas « Mon planning »', () => {
    ouvrirSession(CHEF);
    simulerApi({});
    afficher('/');
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(menu).getByText('Permanences')).toBeInTheDocument();
    expect(within(menu).queryByText('Mon planning')).not.toBeInTheDocument();
  });

  it('un cadre voit « Mon planning » mais pas « Permanences », et la page lui est refusée', () => {
    ouvrirSession(CADRE);
    simulerApi({});
    afficher('/permanences');
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(menu).getByText('Mon planning')).toBeInTheDocument();
    expect(within(menu).queryByText('Permanences')).not.toBeInTheDocument();
  });
});

describe('planning des cadres', () => {
  const api = (extra = {}) => simulerApi({
    'GET /api/unites': UNITES,
    'GET /api/permanences/cadres': [200, CADRES],
    ...extra,
  });

  it('affiche la grille : cases préremplies, téléphone, cases bloquées en cas de congé', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = api();
    afficher('/permanences');

    expect(await screen.findByLabelText('Paul Rabe Lundi 06h-15h00')).toBeChecked();
    expect(screen.getByLabelText('Paul Rabe Mardi 06h-15h00')).not.toBeChecked();
    expect(screen.getByText(/0332337086/)).toBeInTheDocument();
    expect(screen.getByText('Semaine 51 · 2025')).toBeInTheDocument();
    expect(screen.getByText('du 15/12/2025 au 21/12/2025')).toBeInTheDocument();

    // Mino est en congé validé du 16 au 18 : cases bloquées ces jours-là, libre le lundi
    expect(screen.getByLabelText('Mino Soa Mardi 06h-15h00')).toBeDisabled();
    expect(screen.getByLabelText('Mino Soa Mardi 06h-15h00')).toHaveAttribute('title', 'Indisponible : Congé : Annuel');
    expect(screen.getByLabelText('Mino Soa Jeudi 06h-15h00')).toBeDisabled();
    expect(screen.getByLabelText('Mino Soa Vendredi 06h-15h00')).toBeEnabled();
    expect(screen.getByLabelText('Mino Soa Lundi 06h-15h00')).toBeEnabled();

    expect(screen.getByRole('button', { name: 'Enregistrer le planning' })).toBeDisabled(); // rien à enregistrer
    const appel = appelsVers(fetchSimule, 'GET', '/api/permanences/cadres')[0];
    expect(parametres(appel)).toEqual({ date: semaineCourante()[0], numeroUnite: '1' });
  });

  it('chef de service : l\'unité est celle du chef et ne peut pas être changée', async () => {
    ouvrirSession(CHEF);
    api();
    afficher('/permanences');
    await screen.findByRole('option', { name: 'CNS' });
    expect(screen.getByLabelText('Unité')).toBeDisabled();
    expect(screen.getByLabelText('Unité')).toHaveValue('1');
  });

  it('coche un créneau puis enregistre : envoie toutes les affectations avec la semaine et l\'unité', async () => {
    ouvrirSession(CHEF);
    const apres = { ...CADRES, affectations: [...CADRES.affectations, { matricule: 'P002', jour: 'Mardi', creneau: '06h-15h00' }] };
    const fetchSimule = api({ 'PUT /api/permanences/cadres': [200, apres] });
    const user = userEvent.setup();
    afficher('/permanences');

    await user.click(await screen.findByLabelText('Paul Rabe Mardi 06h-15h00'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le planning' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Planning enregistré');
    const corps = corpsEnvoye(appelsVers(fetchSimule, 'PUT', '/api/permanences/cadres')[0]);
    expect(corps.date).toBe(semaineCourante()[0]);
    expect(corps.numeroUnite).toBe(1);
    expect(corps.affectations).toEqual(expect.arrayContaining([
      { matricule: 'P002', jour: 'Lundi', creneau: '06h-15h00' },
      { matricule: 'P002', jour: 'Mardi', creneau: '06h-15h00' },
    ]));
    expect(corps.affectations).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Enregistrer le planning' })).toBeDisabled();
  });

  it('décocher un créneau le retire de l\'envoi', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = api({ 'PUT /api/permanences/cadres': [200, { ...CADRES, affectations: [] }] });
    const user = userEvent.setup();
    afficher('/permanences');
    await user.click(await screen.findByLabelText('Paul Rabe Lundi 06h-15h00'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le planning' }));
    await screen.findByRole('status');
    expect(corpsEnvoye(appelsVers(fetchSimule, 'PUT', '/api/permanences/cadres')[0]).affectations).toEqual([]);
  });

  it('affiche le détail des agents indisponibles quand le serveur refuse (409)', async () => {
    ouvrirSession(CHEF);
    api({ 'PUT /api/permanences/cadres': [409, {
      message: 'Planning refusé : certains agents sont indisponibles',
      details: ['Mino Soa : Mardi 16/12/2025 (Congé : Annuel)'],
    }] });
    const user = userEvent.setup();
    afficher('/permanences');
    await user.click(await screen.findByLabelText('Paul Rabe Mardi 06h-15h00'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le planning' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Planning refusé');
    expect(screen.getByText('Mino Soa : Mardi 16/12/2025 (Congé : Annuel)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le planning' })).toBeEnabled(); // on peut corriger et réessayer
  });

  it('semaine suivante : recharge à +7 jours ; avec modifications non enregistrées, demande confirmation', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = api();
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    afficher('/permanences');
    const lundi = semaineCourante()[0];

    await user.click(await screen.findByLabelText('Paul Rabe Mardi 06h-15h00'));
    await user.click(screen.getByRole('button', { name: /Semaine suivante/ }));
    expect(confirmation).toHaveBeenCalled();
    expect(appelsVers(fetchSimule, 'GET', '/api/permanences/cadres')).toHaveLength(1); // refusé : on reste sur la semaine
    expect(screen.getByLabelText('Paul Rabe Mardi 06h-15h00')).toBeChecked(); // saisie conservée

    confirmation.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /Semaine suivante/ }));
    await waitFor(() => expect(appelsVers(fetchSimule, 'GET', '/api/permanences/cadres')).toHaveLength(2));
    expect(parametres(appelsVers(fetchSimule, 'GET', '/api/permanences/cadres')[1]).date).toBe(ajouterJours(lundi, 7));
  });

  it('semaine précédente sans modification : pas de confirmation', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = api();
    const confirmation = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    afficher('/permanences');
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    await user.click(screen.getByRole('button', { name: /Semaine précédente/ }));
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() => expect(appelsVers(fetchSimule, 'GET', '/api/permanences/cadres')).toHaveLength(2));
    expect(parametres(appelsVers(fetchSimule, 'GET', '/api/permanences/cadres')[1]).date).toBe(ajouterJours(semaineCourante()[0], -7));
  });
});

describe('planning des surveillants', () => {
  const api = (extra = {}) => simulerApi({
    'GET /api/unites': UNITES,
    'GET /api/permanences/cadres': [200, CADRES],
    'GET /api/permanences/surveillants': [200, SURVEILLANTS],
    ...extra,
  });

  it('permet de choisir TECH ELB et TECH CNS directement dans les cases et enregistre les libellés', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = api({
      'PUT /api/permanences/surveillants': [200, {
        ...SURVEILLANTS,
        affectations: [
          { numeroPoste: 1, jour: 'Lundi', plage: '18:30-06:00', designationSpeciale: 'TECH ELB', matricule: null },
          { numeroPoste: 2, jour: 'Lundi', plage: '18:30-06:00', designationSpeciale: 'TECH CNS', matricule: null },
        ],
      }],
    });
    const user = userEvent.setup();
    afficher('/permanences');
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    await user.click(screen.getByRole('tab', { name: 'Surveillants' }));

    const premiereCase = await screen.findByLabelText('Station terrienne Ivato Lundi 18:30-06:00');
    await user.click(premiereCase);
    await user.click(await screen.findByRole('option', { name: /TECH ELB/ }));

    const deuxiemeCase = screen.getByLabelText('Centrale électrique Ivato Lundi 18:30-06:00');
    await user.click(deuxiemeCase);
    await user.click(await screen.findByRole('option', { name: /TECH CNS/ }));
    expect(premiereCase).toHaveValue('TECH ELB');
    expect(deuxiemeCase).toHaveValue('TECH CNS');

    await user.click(screen.getByRole('button', { name: 'Enregistrer le planning' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Planning enregistré');
    const affectations = corpsEnvoye(appelsVers(fetchSimule, 'PUT', '/api/permanences/surveillants')[0]).affectations;
    expect(affectations).toEqual([
      { numeroPoste: 1, jour: 'Lundi', plage: '18:30-06:00', designationSpeciale: 'TECH ELB' },
      { numeroPoste: 2, jour: 'Lundi', plage: '18:30-06:00', designationSpeciale: 'TECH CNS' },
    ]);
  });

  it('propose les identifiants des surveillants sans filtrer par unité et signale les indisponibilités', async () => {
    ouvrirSession(CHEF);
    api();
    const user = userEvent.setup();
    afficher('/permanences');
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    await user.click(screen.getByRole('tab', { name: 'Surveillants' }));

    const mercredi = screen.getByLabelText('Station terrienne Ivato Mercredi 06:00-12:00');
    await user.type(mercredi, 'NRA');
    expect(await screen.findByRole('option', { name: /NRA.*Nirina Rasoa.*Indisponible/ })).toBeDisabled();

    const lundi = screen.getByLabelText('Station terrienne Ivato Lundi 06:00-12:00');
    await user.type(lundi, 'JRA');
    expect(await screen.findByRole('option', { name: /JRA.*Johny Rakoto/ })).toBeEnabled();
  });

  it("vider une case retire l’affectation", async () => {
    ouvrirSession(CHEF);
    const fetchSimule = api({
      'GET /api/permanences/surveillants': [200, { ...SURVEILLANTS, affectations: [{ numeroPoste: 1, jour: 'Lundi', plage: '06:00-12:00', matricule: 'P005' }] }],
      'PUT /api/permanences/surveillants': [200, SURVEILLANTS],
    });
    const user = userEvent.setup();
    afficher('/permanences');
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    await user.click(screen.getByRole('tab', { name: 'Surveillants' }));
    const cellule = await screen.findByLabelText('Station terrienne Ivato Lundi 06:00-12:00');
    expect(cellule).toHaveValue('JRA');
    await user.clear(cellule);
    await user.click(screen.getByRole('button', { name: 'Enregistrer le planning' }));
    await screen.findByRole('status');
    expect(corpsEnvoye(appelsVers(fetchSimule, 'PUT', '/api/permanences/surveillants')[0]).affectations).toEqual([]);
  });

  it('changer d\'onglet avec une saisie non enregistrée demande confirmation', async () => {
    ouvrirSession(CHEF);
    api();
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    afficher('/permanences');
    await user.click(await screen.findByLabelText('Paul Rabe Mardi 06h-15h00'));
    await user.click(screen.getByRole('tab', { name: 'Surveillants' }));
    expect(confirmation).toHaveBeenCalled();
    expect(screen.getByLabelText('Paul Rabe Mardi 06h-15h00')).toBeChecked();
  });
});

describe('export Excel', () => {
  function preparerTelechargement() {
    URL.createObjectURL = vi.fn(() => 'blob:fichier');
    URL.revokeObjectURL = vi.fn();
    const noms = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { noms.push(this.download); });
    return noms;
  }

  it('télécharge le fichier Excel avec le jeton et nomme le fichier d\'après la semaine', async () => {
    ouvrirSession(CHEF);
    const fetchSimule = simulerApi({
      'GET /api/unites': UNITES, 'GET /api/permanences/cadres': [200, CADRES],
      'GET /api/permanences/export': [200, null],
    });
    const noms = preparerTelechargement();
    const user = userEvent.setup();
    afficher('/permanences');
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    await user.click(screen.getByRole('button', { name: 'Exporter le tableau (Excel)' }));

    await waitFor(() => expect(noms).toEqual(['tableau-permanence-S51-2025.xlsx']));
    const appel = appelsVers(fetchSimule, 'GET', '/api/permanences/export')[0];
    expect(appel[1].headers.Authorization).toBe('Bearer jeton');
    expect(parametres(appel)).toEqual({ date: semaineCourante()[0] });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fichier');
  });

  it('est désactivé tant que le planning a des modifications non enregistrées', async () => {
    ouvrirSession(CHEF);
    simulerApi({ 'GET /api/unites': UNITES, 'GET /api/permanences/cadres': [200, CADRES] });
    const user = userEvent.setup();
    afficher('/permanences');
    const bouton = screen.getByRole('button', { name: 'Exporter le tableau (Excel)' });
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    expect(bouton).toBeEnabled();
    await user.click(screen.getByLabelText('Paul Rabe Mardi 06h-15h00'));
    expect(bouton).toBeDisabled();
  });

  it('affiche l\'erreur si la génération échoue', async () => {
    ouvrirSession(CHEF);
    simulerApi({
      'GET /api/unites': UNITES, 'GET /api/permanences/cadres': [200, CADRES],
      'GET /api/permanences/export': [500, { message: 'Erreur interne du serveur' }],
    });
    preparerTelechargement();
    const user = userEvent.setup();
    afficher('/permanences');
    await screen.findByLabelText('Paul Rabe Lundi 06h-15h00');
    await user.click(screen.getByRole('button', { name: 'Exporter le tableau (Excel)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne du serveur');
  });
});

describe('mon planning', () => {
  it('liste mes permanences de la semaine (cadre : sans poste)', async () => {
    ouvrirSession(CADRE);
    const fetchSimule = simulerApi({ 'GET /api/permanences/mon-planning': [200, {
      semaine: SEMAINE,
      permanences: [{ jour: 'Lundi', date: '2025-12-15', horaire: '06h-15h00', poste: null }],
      missions: [], conges: [],
    }] });
    afficher('/mon-planning');

    expect(await screen.findByText('Lundi 15/12')).toBeInTheDocument();
    expect(screen.getByText('06h-15h00')).toBeInTheDocument();
    expect(screen.getByText('Semaine 51 · 2025')).toBeInTheDocument();
    expect(parametres(appelsVers(fetchSimule, 'GET', '/api/permanences/mon-planning')[0]))
      .toEqual({ date: semaineCourante()[0] });
  });

  it('surveillant : affiche le poste ; semaine vide : message', async () => {
    ouvrirSession(SURVEILLANT);
    let appel = 0;
    simulerApi({ 'GET /api/permanences/mon-planning': [200, () => (appel++ === 0
      ? { semaine: SEMAINE, permanences: [{ jour: 'Mardi', date: '2025-12-16', horaire: '18:30-06:00', poste: 'Station terrienne Ivato' }], missions: [], conges: [] }
      : { semaine: { ...SEMAINE, numeroIso: 52 }, permanences: [], missions: [], conges: [] })] });
    const user = userEvent.setup();
    afficher('/mon-planning');

    expect(await screen.findByText('Station terrienne Ivato')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Semaine suivante/ }));
    expect(await screen.findByText('Aucune permanence cette semaine')).toBeInTheDocument();
  });

  it('affiche aussi mes missions et mes congés de la semaine', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/permanences/mon-planning': [200, {
      semaine: SEMAINE, permanences: [],
      missions: [{ station: 'Antsiranana', dateDebut: '2025-12-10', dateFin: '2025-12-16' }],
      conges: [{ type: 'Maladie', statut: 'Validé', dateDebut: '2025-12-18', dateFin: '2025-12-18' }],
    }] });
    afficher('/mon-planning');
    expect(await screen.findByText('Antsiranana · du 10/12/2025 au 16/12/2025')).toBeInTheDocument();
    expect(screen.getByText(/Maladie · 18\/12\/2025/)).toBeInTheDocument();
    expect(screen.getByText('(Validé)')).toBeInTheDocument();
  });

  it('affiche l\'erreur du serveur', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/permanences/mon-planning': [500, { message: 'Erreur interne du serveur' }] });
    afficher('/mon-planning');
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne du serveur');
  });
});
