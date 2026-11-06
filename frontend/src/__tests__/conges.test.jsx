import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADMIN, CADRE, CHEF, afficher, appelsVers, corpsEnvoye, ouvrirSession, parametres, simulerApi } from './aide.jsx';
import { ajouterMois, bornesDuMois, moisCourant } from '../utils/dates.js';

const TYPES = ['Annuel', 'Maladie', 'Hospitalisation', 'Autre'];
const demande = (id, statut, extra = {}) => ({
  id, matricule: 'P002', nom: 'Rabe', prenom: 'Paul', numeroUnite: 1, type: 'Annuel', statut,
  dateDebut: '2026-03-02', dateFin: '2026-03-06', ...extra,
});

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('menus selon la fonction', () => {
  it('un agent voit Mon planning, Missions, Mes congés et le Calendrier — pas les écrans du chef ni de l\'admin', () => {
    ouvrirSession(CADRE);
    simulerApi({});
    afficher('/');
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    for (const lien of ['Mon planning', 'Missions', 'Mes congés', 'Calendrier des congés']) {
      expect(within(menu).getByText(lien)).toBeInTheDocument();
    }
    for (const lien of ['Permanences', 'Demandes de congé', 'Disponibilités', 'Comptes', 'Référentiels']) {
      expect(within(menu).queryByText(lien)).not.toBeInTheDocument();
    }
  });

  it('un chef voit Permanences, Missions, Demandes de congé, Calendrier et Disponibilités — pas « Mes congés »', () => {
    ouvrirSession(CHEF);
    simulerApi({ 'GET /api/conges/unite/nombre': [200, { nombre: 0 }] });
    afficher('/');
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' });
    for (const lien of ['Permanences', 'Missions', 'Demandes de congé', 'Calendrier des congés', 'Disponibilités']) {
      expect(within(menu).getByText(lien)).toBeInTheDocument();
    }
    for (const lien of ['Mes congés', 'Mon planning', 'Comptes']) {
      expect(within(menu).queryByText(lien)).not.toBeInTheDocument();
    }
  });

  it('l\'administrateur n\'a accès à aucun écran de missions ou de congés', () => {
    ouvrirSession(ADMIN);
    simulerApi({});
    for (const chemin of ['/missions', '/mes-conges', '/demandes-conges', '/calendrier-conges']) {
      const { unmount } = afficher(chemin);
      expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
      unmount();
    }
  });

  it('un agent n\'accède pas aux demandes à traiter, un chef ne demande pas de congé', () => {
    ouvrirSession(CADRE);
    simulerApi({});
    const { unmount } = afficher('/demandes-conges');
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
    unmount();
    sessionStorage.clear();
    ouvrirSession(CHEF);
    simulerApi({ 'GET /api/conges/unite/nombre': [200, { nombre: 0 }] });
    afficher('/mes-conges');
    expect(screen.getByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
  });

  it('la pastille du menu affiche le nombre de demandes en attente du chef', async () => {
    ouvrirSession(CHEF);
    simulerApi({ 'GET /api/conges/unite/nombre': [200, { nombre: 3 }] });
    afficher('/');
    expect(await screen.findByLabelText('3 en attente')).toHaveTextContent('3');
  });

  it('aucune pastille quand il n\'y a rien à traiter', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({ 'GET /api/conges/unite/nombre': [200, { nombre: 0 }] });
    afficher('/');
    await waitFor(() => expect(appelsVers(api, 'GET', '/api/conges/unite/nombre')).toHaveLength(1));
    expect(screen.queryByLabelText(/en attente/)).not.toBeInTheDocument();
  });
});

describe('demander un congé (agent)', () => {
  const liste = [200, { types: TYPES, demandes: [demande(2, 'En attente'), demande(1, 'Validé', { dateDebut: '2026-01-05', dateFin: '2026-01-09' })] }];

  it('affiche mes demandes avec leur statut ; seule une demande en attente peut être annulée', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/conges/mes-demandes': liste });
    afficher('/mes-conges');
    expect(await screen.findByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Validé')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Annuler la demande/ })).toHaveLength(1);
  });

  it('envoie la demande (type, dates) et vide les dates', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({
      'GET /api/conges/mes-demandes': liste,
      'POST /api/conges': [201, { conge: demande(3, 'En attente'), alertes: [] }],
    });
    const user = userEvent.setup();
    afficher('/mes-conges');
    await screen.findByText('En attente');

    await user.selectOptions(screen.getByLabelText('Type de congé'), 'Maladie');
    await user.type(screen.getByLabelText('Du'), '2026-04-06');
    await user.type(screen.getByLabelText('Au'), '2026-04-08');
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Demande envoyée à votre chef de service');
    expect(corpsEnvoye(appelsVers(api, 'POST', '/api/conges')[0])).toEqual({ type: 'Maladie', dateDebut: '2026-04-06', dateFin: '2026-04-08' });
    expect(screen.getByLabelText('Du')).toHaveValue('');
    expect(appelsVers(api, 'GET', '/api/conges/mes-demandes')).toHaveLength(2); // liste rechargée
  });

  it('avertit quand une mission ou une permanence est déjà prévue (le chef en est informé)', async () => {
    ouvrirSession(CADRE);
    simulerApi({
      'GET /api/conges/mes-demandes': liste,
      'POST /api/conges': [201, { conge: demande(3, 'En attente'), alertes: ['Mission : Antsiranana (du 10/12/2025 au 14/12/2025)'] }],
    });
    const user = userEvent.setup();
    afficher('/mes-conges');
    await screen.findByText('En attente');
    await user.type(screen.getByLabelText('Du'), '2025-12-11');
    await user.type(screen.getByLabelText('Au'), '2025-12-12');
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    expect(await screen.findByText(/Mission : Antsiranana/)).toBeInTheDocument();
    expect(screen.getByText(/votre chef de service en est informé/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // la demande est bien envoyée
  });

  it('affiche l\'erreur du serveur (chevauchement)', async () => {
    ouvrirSession(CADRE);
    simulerApi({
      'GET /api/conges/mes-demandes': liste,
      'POST /api/conges': [409, { message: 'Cette période chevauche une de vos demandes en attente (du 02/03/2026 au 06/03/2026)' }],
    });
    const user = userEvent.setup();
    afficher('/mes-conges');
    await screen.findByText('En attente');
    await user.type(screen.getByLabelText('Du'), '2026-03-03');
    await user.type(screen.getByLabelText('Au'), '2026-03-04');
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('chevauche');
  });

  it('annule une demande après confirmation', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({ 'GET /api/conges/mes-demandes': liste, 'DELETE /api/conges/2': [204, null] });
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    afficher('/mes-conges');
    await user.click(await screen.findByRole('button', { name: /Annuler la demande/ }));
    expect(confirmation).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Demande annulée');
    expect(appelsVers(api, 'DELETE', '/api/conges/2')).toHaveLength(1);
  });

  it('n\'annule rien si on refuse la confirmation', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({ 'GET /api/conges/mes-demandes': liste });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    afficher('/mes-conges');
    await user.click(await screen.findByRole('button', { name: /Annuler la demande/ }));
    expect(api.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false);
  });
});

describe('demandes de congé (chef de service)', () => {
  const nombre = [200, { nombre: 2 }];
  const aTraiter = [200, [
    { ...demande(5, 'En attente'), conflits: [] },
    { ...demande(6, 'En attente', { matricule: 'P003', nom: 'Soa', prenom: 'Mino' }), conflits: ['Mission : Antsiranana (du 10/12/2025 au 14/12/2025)'] },
  ]];

  it('liste les demandes à traiter avec le planning déjà prévu', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({ 'GET /api/conges/unite': aTraiter, 'GET /api/conges/unite/nombre': nombre });
    afficher('/demandes-conges');
    expect(await screen.findByText('Mino Soa')).toBeInTheDocument();
    expect(screen.getByText('Paul Rabe')).toBeInTheDocument();
    expect(screen.getByText('Mission : Antsiranana (du 10/12/2025 au 14/12/2025)')).toBeInTheDocument();
    expect(parametres(appelsVers(api, 'GET', '/api/conges/unite')[0])).toEqual({ statut: 'En attente' });
  });

  it('valide une demande sans conflit : une seule requête, sans confirmation', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({
      'GET /api/conges/unite': aTraiter, 'GET /api/conges/unite/nombre': nombre,
      'PUT /api/conges/5/decision': [200, demande(5, 'Validé')],
    });
    const confirmation = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    afficher('/demandes-conges');
    await user.click(await screen.findByRole('button', { name: 'Valider la demande de Paul Rabe' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Demande de Paul Rabe : validée');
    expect(corpsEnvoye(appelsVers(api, 'PUT', '/api/conges/5/decision')[0])).toEqual({ decision: 'Validé' });
    expect(confirmation).not.toHaveBeenCalled();
  });

  it('met à jour la pastille du menu après une décision', async () => {
    ouvrirSession(CHEF);
    let restant = 2;
    const api = simulerApi({
      'GET /api/conges/unite': aTraiter,
      'GET /api/conges/unite/nombre': [200, () => ({ nombre: restant })],
      'PUT /api/conges/5/decision': [200, () => { restant = 1; return demande(5, 'Validé'); }],
    });
    const user = userEvent.setup();
    afficher('/demandes-conges');
    expect(await screen.findByLabelText('2 en attente')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Valider la demande de Paul Rabe' }));
    expect(await screen.findByLabelText('1 en attente')).toBeInTheDocument();
    expect(appelsVers(api, 'GET', '/api/conges/unite/nombre').length).toBeGreaterThanOrEqual(2);
  });

  it('conflit : demande confirmation avec le détail, puis valide en confirmant', async () => {
    ouvrirSession(CHEF);
    let appel = 0;
    simulerApi({
      'GET /api/conges/unite': aTraiter, 'GET /api/conges/unite/nombre': nombre,
      'PUT /api/conges/6/decision': [200, () => demande(6, 'Validé')],
    });
    // 1re requête : le serveur demande une confirmation ; 2e : acceptée
    const base = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, options) => {
      if (url === '/api/conges/6/decision' && appel++ === 0) {
        return { ok: false, status: 409, json: async () => ({
          message: "Conflit détecté : l'agent a déjà du travail planifié sur cette période",
          details: ['Mission : Antsiranana (du 10/12/2025 au 14/12/2025)'], code: 'CONFIRMATION_REQUISE',
        }) };
      }
      return base(url, options);
    });
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    afficher('/demandes-conges');
    await user.click(await screen.findByRole('button', { name: 'Valider la demande de Mino Soa' }));

    await waitFor(() => expect(confirmation).toHaveBeenCalledTimes(1));
    expect(confirmation.mock.calls[0][0]).toContain('Mission : Antsiranana');
    expect(confirmation.mock.calls[0][0]).toContain('Valider quand même');
    expect(await screen.findByRole('status')).toHaveTextContent('Demande de Mino Soa : validée');
    const envois = globalThis.fetch.mock.calls.filter(([u, o]) => u === '/api/conges/6/decision' && o?.method === 'PUT');
    expect(envois).toHaveLength(2);
    expect(JSON.parse(envois[0][1].body)).toEqual({ decision: 'Validé' });
    expect(JSON.parse(envois[1][1].body)).toEqual({ decision: 'Validé', confirmer: true });
  });

  it('conflit : si le chef refuse de confirmer, rien n\'est validé', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({
      'GET /api/conges/unite': aTraiter, 'GET /api/conges/unite/nombre': nombre,
      'PUT /api/conges/6/decision': [409, { message: 'Conflit détecté', details: ['Mission : X (le 01/01/2026)'], code: 'CONFIRMATION_REQUISE' }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    afficher('/demandes-conges');
    await user.click(await screen.findByRole('button', { name: 'Valider la demande de Mino Soa' }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(appelsVers(api, 'PUT', '/api/conges/6/decision')).toHaveLength(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuse une demande sans demander de confirmation', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({
      'GET /api/conges/unite': aTraiter, 'GET /api/conges/unite/nombre': nombre,
      'PUT /api/conges/5/decision': [200, demande(5, 'Refusé')],
    });
    const confirmation = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    afficher('/demandes-conges');
    await user.click(await screen.findByRole('button', { name: 'Refuser la demande de Paul Rabe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Demande de Paul Rabe : refusée');
    expect(corpsEnvoye(appelsVers(api, 'PUT', '/api/conges/5/decision')[0])).toEqual({ decision: 'Refusé' });
    expect(confirmation).not.toHaveBeenCalled();
  });

  it('affiche une erreur (demande déjà traitée)', async () => {
    ouvrirSession(CHEF);
    simulerApi({
      'GET /api/conges/unite': aTraiter, 'GET /api/conges/unite/nombre': nombre,
      'PUT /api/conges/5/decision': [409, { message: 'Cette demande a déjà été traitée' }],
    });
    const user = userEvent.setup();
    afficher('/demandes-conges');
    await user.click(await screen.findByRole('button', { name: 'Valider la demande de Paul Rabe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('déjà été traitée');
  });

  it('message quand il n\'y a rien à traiter', async () => {
    ouvrirSession(CHEF);
    simulerApi({ 'GET /api/conges/unite': [200, []], 'GET /api/conges/unite/nombre': [200, { nombre: 0 }] });
    afficher('/demandes-conges');
    expect(await screen.findByText('Aucune demande en attente')).toBeInTheDocument();
  });

  it('onglet « Congés validés » : liste les congés et permet de les annuler', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({
      'GET /api/conges/unite': [200, (_o, url) => (url.includes('Valid') ? [demande(1, 'Validé')] : [])],
      'GET /api/conges/unite/nombre': [200, { nombre: 0 }],
      'DELETE /api/conges/1': [204, null],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    afficher('/demandes-conges');
    await screen.findByText('Aucune demande en attente');
    await user.click(screen.getByRole('tab', { name: 'Congés validés' }));

    await user.click(await screen.findByRole('button', { name: 'Annuler le congé de Paul Rabe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Congé annulé');
    expect(appelsVers(api, 'DELETE', '/api/conges/1')).toHaveLength(1);
    expect(appelsVers(api, 'GET', '/api/conges/unite').some((a) => parametres(a).statut === 'Validé')).toBe(true);
  });
});

describe('calendrier des congés', () => {
  const agents = [
    { matricule: 'P002', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance' },
    { matricule: 'P003', nom: 'Soa', prenom: 'Mino', fonction: 'Cadre de maintenance' },
  ];
  const mois = moisCourant();
  const jour = (n) => `${mois}-${String(n).padStart(2, '0')}`;

  it('affiche une ligne par agent et colore les jours de congé (validé / en attente)', async () => {
    ouvrirSession(CHEF);
    const api = simulerApi({
      'GET /api/conges/unite/nombre': [200, { nombre: 0 }],
      'GET /api/conges/calendrier': [200, { agents, conges: [
        { id: 1, matricule: 'P002', statut: 'Validé', type: 'Maladie', dateDebut: jour(3), dateFin: jour(4) },
        { id: 2, matricule: 'P003', statut: 'En attente', type: 'Annuel', dateDebut: jour(10), dateFin: jour(10) },
      ] }],
    });
    afficher('/calendrier-conges');

    const valide = await screen.findByLabelText(`Paul Rabe 03/${mois.slice(5)} : Maladie (Validé)`);
    expect(valide).toHaveClass('conge-valide');
    expect(screen.getByLabelText(`Paul Rabe 04/${mois.slice(5)} : Maladie (Validé)`)).toHaveClass('conge-valide');
    expect(screen.getByLabelText(`Mino Soa 10/${mois.slice(5)} : Annuel (En attente)`)).toHaveClass('conge-attente');
    expect(screen.queryByLabelText(new RegExp('Paul Rabe 05/'))).not.toBeInTheDocument();
    expect(parametres(appelsVers(api, 'GET', '/api/conges/calendrier')[0]))
      .toEqual({ dateDebut: bornesDuMois(mois)[0], dateFin: bornesDuMois(mois)[1] });
  });

  it('un agent voit « Congé » quand le motif est masqué', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/conges/calendrier': [200, { agents, conges: [
      { id: 1, matricule: 'P003', statut: 'Validé', type: null, dateDebut: jour(8), dateFin: jour(8) },
    ] }] });
    afficher('/calendrier-conges');
    expect(await screen.findByLabelText(`Mino Soa 08/${mois.slice(5)} : Congé (Validé)`)).toBeInTheDocument();
  });

  it('navigation : mois suivant et précédent rechargent les bonnes bornes', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({ 'GET /api/conges/calendrier': [200, { agents, conges: [] }] });
    const user = userEvent.setup();
    afficher('/calendrier-conges');
    await screen.findByText('Paul Rabe');
    await user.click(screen.getByRole('button', { name: /Mois suivant/ }));
    await waitFor(() => expect(appelsVers(api, 'GET', '/api/conges/calendrier')).toHaveLength(2));
    const suivant = ajouterMois(mois, 1);
    expect(parametres(appelsVers(api, 'GET', '/api/conges/calendrier')[1]))
      .toEqual({ dateDebut: bornesDuMois(suivant)[0], dateFin: bornesDuMois(suivant)[1] });
    await user.click(screen.getByRole('button', { name: /Mois précédent/ }));
    await waitFor(() => expect(appelsVers(api, 'GET', '/api/conges/calendrier')).toHaveLength(3));
    expect(parametres(appelsVers(api, 'GET', '/api/conges/calendrier')[2]).dateDebut).toBe(bornesDuMois(mois)[0]);
  });

  it('affiche l\'erreur du serveur', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/conges/calendrier': [500, { message: 'Erreur interne du serveur' }] });
    afficher('/calendrier-conges');
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne du serveur');
  });
});
