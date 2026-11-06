import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CADRE, CHEF, afficher, appelsVers, corpsEnvoye, ouvrirSession, parametres, simulerApi } from './aide.jsx';
import { trimestreDe } from '../utils/dates.js';

const STATIONS = [200, [{ numero_station: 1, nom_station: 'Antsiranana' }, { numero_station: 2, nom_station: 'Nosy Be' }]];
const MISSION = {
  numeroMission: 10, dateDebut: '2025-12-10', dateFin: '2025-12-14', trimestre: 4, annee: 2025,
  numeroStation: 1, nomStation: 'Antsiranana',
  intervenants: [
    { matricule: 'P002', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', numeroUnite: 1, nomUnite: 'CNS' },
    { matricule: 'P003', nom: 'Soa', prenom: 'Mino', fonction: 'Cadre de maintenance', numeroUnite: 1, nomUnite: 'CNS' },
    { matricule: 'P010', nom: 'Randria', prenom: 'Faly', fonction: 'Cadre de maintenance', numeroUnite: 2, nomUnite: 'ELB' },
  ],
};
const courant = trimestreDe();

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

const apiChef = (extra = {}) => simulerApi({
  'GET /api/conges/unite/nombre': [200, { nombre: 0 }],
  'GET /api/stations': STATIONS,
  'GET /api/missions': [200, [MISSION]],
  ...extra,
});

describe('consulter les missions (agent)', () => {
  it('affiche le tableau du trimestre courant, intervenants regroupés par unité, sans aucun bouton de gestion', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({ 'GET /api/missions': [200, [MISSION]] });
    afficher('/missions');

    expect(await screen.findByText('Antsiranana')).toBeInTheDocument();
    expect(screen.getByText('du 10/12/2025 au 14/12/2025')).toBeInTheDocument();
    expect(screen.getByText(/Paul Rabe, Mino Soa/)).toBeInTheDocument();
    expect(screen.getByText(/Faly Randria/)).toBeInTheDocument();
    expect(screen.getByText('CNS')).toBeInTheDocument();
    expect(screen.getByText('ELB')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouvelle mission' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier|Supprimer|Mes intervenants/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Missions du trimestre ${courant.trimestre} · ${courant.annee}` })).toBeInTheDocument();
    expect(parametres(appelsVers(api, 'GET', '/api/missions')[0]))
      .toEqual({ annee: String(courant.annee), trimestre: String(courant.trimestre) });
    expect(appelsVers(api, 'GET', '/api/stations')).toHaveLength(0); // inutile pour un agent
  });

  it('un onglet par trimestre : change le trimestre demandé', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({ 'GET /api/missions': [200, []] });
    const user = userEvent.setup();
    afficher('/missions');
    await screen.findByText('Aucune mission ce trimestre');
    const autre = courant.trimestre === 2 ? 3 : 2;
    await user.click(screen.getByRole('tab', { name: `Trimestre ${autre}` }));
    await waitFor(() => expect(appelsVers(api, 'GET', '/api/missions').some((a) => parametres(a).trimestre === String(autre))).toBe(true));
    expect(screen.getByRole('tab', { name: `Trimestre ${autre}` })).toHaveAttribute('aria-selected', 'true');
  });

  it('changer l\'année recharge le tableau', async () => {
    ouvrirSession(CADRE);
    const api = simulerApi({ 'GET /api/missions': [200, []] });
    const user = userEvent.setup();
    afficher('/missions');
    await screen.findByText('Aucune mission ce trimestre');
    const champ = screen.getByLabelText('Année');
    await user.clear(champ);
    await user.type(champ, '2024');
    await waitFor(() => expect(appelsVers(api, 'GET', '/api/missions').some((a) => parametres(a).annee === '2024')).toBe(true));
    // aucune requête sur une année incomplète pendant la frappe
    expect(appelsVers(api, 'GET', '/api/missions').every((a) => /^\d{4}$/.test(parametres(a).annee))).toBe(true);
  });

  it('une année saisie à moitié est remise à l\'année affichée en quittant le champ', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/missions': [200, []] });
    const user = userEvent.setup();
    afficher('/missions');
    await screen.findByText('Aucune mission ce trimestre');
    const champ = screen.getByLabelText('Année');
    await user.clear(champ);
    await user.type(champ, '20');
    await user.tab();
    expect(champ).toHaveValue(courant.annee);
  });

  it('affiche l\'erreur du serveur', async () => {
    ouvrirSession(CADRE);
    simulerApi({ 'GET /api/missions': [500, { message: 'Erreur interne du serveur' }] });
    afficher('/missions');
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne du serveur');
  });
});

describe('planifier une mission (chef de service)', () => {
  it('voit les boutons de gestion ; la liste des stations est chargée', async () => {
    ouvrirSession(CHEF);
    const api = apiChef();
    afficher('/missions');
    expect(await screen.findByRole('button', { name: 'Nouvelle mission' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mes intervenants Antsiranana/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier la mission Antsiranana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer la mission Antsiranana' })).toBeInTheDocument();
    expect(appelsVers(api, 'GET', '/api/stations')).toHaveLength(1);
  });

  it('crée une mission puis affiche le trimestre de la mission créée', async () => {
    ouvrirSession(CHEF);
    const creee = { ...MISSION, numeroMission: 11, annee: courant.annee + 1, trimestre: courant.trimestre, intervenants: [] };
    const api = apiChef({ 'POST /api/missions': [201, creee] });
    const user = userEvent.setup();
    afficher('/missions');

    await user.click(await screen.findByRole('button', { name: 'Nouvelle mission' }));
    await user.selectOptions(screen.getByLabelText('Station'), 'Nosy Be');
    await user.type(screen.getByLabelText('Du'), '2027-02-03');
    await user.type(screen.getByLabelText('Au'), '2027-02-05');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Mission créée');
    expect(corpsEnvoye(appelsVers(api, 'POST', '/api/missions')[0])).toEqual({ numeroStation: 2, dateDebut: '2027-02-03', dateFin: '2027-02-05' });
    // le tableau passe sur l'année de la mission créée
    await waitFor(() => expect(appelsVers(api, 'GET', '/api/missions').some((a) => parametres(a).annee === String(courant.annee + 1))).toBe(true));
    expect(screen.queryByLabelText('Station')).not.toBeInTheDocument(); // formulaire refermé
  });

  it('annuler ferme le formulaire sans rien envoyer', async () => {
    ouvrirSession(CHEF);
    const api = apiChef();
    const user = userEvent.setup();
    afficher('/missions');
    await user.click(await screen.findByRole('button', { name: 'Nouvelle mission' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByLabelText('Station')).not.toBeInTheDocument();
    expect(api.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  });

  it('modifier : formulaire prérempli, envoie la modification', async () => {
    ouvrirSession(CHEF);
    const api = apiChef({ 'PUT /api/missions/10': [200, { ...MISSION, dateFin: '2025-12-12', trimestre: courant.trimestre, annee: courant.annee }] });
    const user = userEvent.setup();
    afficher('/missions');
    await user.click(await screen.findByRole('button', { name: 'Modifier la mission Antsiranana' }));

    expect(screen.getByRole('heading', { name: 'Modifier la mission' })).toBeInTheDocument();
    expect(screen.getByLabelText('Station')).toHaveValue('1');
    expect(screen.getByLabelText('Du')).toHaveValue('2025-12-10');
    expect(screen.getByLabelText('Au')).toHaveValue('2025-12-14');

    await user.clear(screen.getByLabelText('Au'));
    await user.type(screen.getByLabelText('Au'), '2025-12-12');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Mission modifiée');
    expect(corpsEnvoye(appelsVers(api, 'PUT', '/api/missions/10')[0])).toEqual({ numeroStation: 1, dateDebut: '2025-12-10', dateFin: '2025-12-12' });
  });

  it('affiche le détail des agents indisponibles quand la nouvelle période est refusée (409)', async () => {
    ouvrirSession(CHEF);
    apiChef({ 'PUT /api/missions/10': [409, {
      message: 'Nouvelle période impossible : des intervenants sont indisponibles',
      details: ['Paul Rabe : Congé : Annuel (du 20/12/2025 au 21/12/2025)'],
    }] });
    const user = userEvent.setup();
    afficher('/missions');
    await user.click(await screen.findByRole('button', { name: 'Modifier la mission Antsiranana' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nouvelle période impossible');
    expect(screen.getByText('Paul Rabe : Congé : Annuel (du 20/12/2025 au 21/12/2025)')).toBeInTheDocument();
    expect(screen.getByLabelText('Station')).toBeInTheDocument(); // le formulaire reste ouvert pour corriger
  });

  it('supprime après confirmation ; affiche le refus du serveur sinon', async () => {
    ouvrirSession(CHEF);
    const api = apiChef({ 'DELETE /api/missions/10': [409, { message: "Des intervenants d'autres unités participent à cette mission" }] });
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    afficher('/missions');
    await user.click(await screen.findByRole('button', { name: 'Supprimer la mission Antsiranana' }));
    expect(confirmation).toHaveBeenCalledWith('Supprimer la mission Antsiranana du 10/12/2025 au 14/12/2025 ?');
    expect(await screen.findByRole('alert')).toHaveTextContent('autres unités');
    expect(appelsVers(api, 'DELETE', '/api/missions/10')).toHaveLength(1);
  });

  it('refuser la confirmation n\'envoie rien', async () => {
    ouvrirSession(CHEF);
    const api = apiChef();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    afficher('/missions');
    await user.click(await screen.findByRole('button', { name: 'Supprimer la mission Antsiranana' }));
    expect(api.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false);
  });
});

describe('affecter les intervenants de son unité', () => {
  const candidats = [200, {
    mission: MISSION,
    agents: [
      { matricule: 'P002', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', disponible: true, conflits: [], affecte: true },
      { matricule: 'P003', nom: 'Soa', prenom: 'Mino', fonction: 'Cadre de maintenance', disponible: false, affecte: true,
        conflits: [{ type: 'conge', detail: 'Congé : Annuel', dateDebut: '2025-12-12', dateFin: '2025-12-13' }] },
      { matricule: 'P004', nom: 'Hery', prenom: 'Lova', fonction: 'Surveillant', disponible: true, conflits: [], affecte: false },
      { matricule: 'P005', nom: 'Zo', prenom: 'Ando', fonction: 'Cadre de maintenance', disponible: false, affecte: false,
        conflits: [{ type: 'permanence', detail: 'Permanence cadre (06h-15h00)', dateDebut: '2025-12-11', dateFin: '2025-12-11' }] },
    ],
  }];
  const ouvrir = async (user) => user.click(await screen.findByRole('button', { name: /Mes intervenants Antsiranana/ }));

  it('liste les agents de l\'unité : affectés cochés, indisponibles grisés avec la raison', async () => {
    ouvrirSession(CHEF);
    apiChef({ 'GET /api/missions/10/candidats': candidats });
    const user = userEvent.setup();
    afficher('/missions');
    await ouvrir(user);

    expect(await screen.findByRole('checkbox', { name: /Paul Rabe/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Lova Hery/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Lova Hery/ })).toBeEnabled();
    // indisponible ET non affecté : grisé ; indisponible mais déjà affecté : reste décochable
    expect(screen.getByRole('checkbox', { name: /Ando Zo/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Mino Soa/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Mino Soa/ })).toBeChecked();
    expect(screen.getByText('Indisponible : Permanence cadre (06h-15h00)')).toBeInTheDocument();
    expect(screen.getByText('Indisponible : Congé : Annuel')).toBeInTheDocument();
    expect(screen.getByText('2 intervenant(s) sélectionné(s)')).toBeInTheDocument();
  });

  it('enregistre la sélection, ferme le panneau et recharge le tableau', async () => {
    ouvrirSession(CHEF);
    const api = apiChef({
      'GET /api/missions/10/candidats': candidats,
      'PUT /api/missions/10/intervenants': [200, MISSION],
    });
    const user = userEvent.setup();
    afficher('/missions');
    await ouvrir(user);
    await user.click(await screen.findByRole('checkbox', { name: /Mino Soa/ })); // on retire l'agent en conflit
    await user.click(screen.getByRole('checkbox', { name: /Lova Hery/ }));       // on ajoute un autre agent
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Intervenants enregistrés');
    expect(corpsEnvoye(appelsVers(api, 'PUT', '/api/missions/10/intervenants')[0]).matricules.sort()).toEqual(['P002', 'P004']);
    expect(screen.queryByRole('checkbox', { name: /Paul Rabe/ })).not.toBeInTheDocument();
    expect(appelsVers(api, 'GET', '/api/missions').length).toBeGreaterThanOrEqual(2);
  });

  it('affiche le détail si le serveur refuse (409) et laisse le panneau ouvert', async () => {
    ouvrirSession(CHEF);
    apiChef({
      'GET /api/missions/10/candidats': candidats,
      'PUT /api/missions/10/intervenants': [409, {
        message: 'Affectation refusée : certains agents sont indisponibles',
        details: ['Mino Soa : Congé : Annuel (du 12/12/2025 au 13/12/2025)'],
      }],
    });
    const user = userEvent.setup();
    afficher('/missions');
    await ouvrir(user);
    await screen.findByRole('checkbox', { name: /Paul Rabe/ });
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Affectation refusée');
    expect(screen.getByText('Mino Soa : Congé : Annuel (du 12/12/2025 au 13/12/2025)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Paul Rabe/ })).toBeInTheDocument();
  });

  it('« Fermer » referme le panneau sans rien enregistrer', async () => {
    ouvrirSession(CHEF);
    const api = apiChef({ 'GET /api/missions/10/candidats': candidats });
    const user = userEvent.setup();
    afficher('/missions');
    await ouvrir(user);
    await screen.findByRole('checkbox', { name: /Paul Rabe/ });
    const panneau = screen.getByRole('heading', { name: /Mes intervenants · Antsiranana/ }).closest('section');
    await user.click(within(panneau).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('checkbox', { name: /Paul Rabe/ })).not.toBeInTheDocument();
    expect(api.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(false);
  });
});
