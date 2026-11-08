import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CADRE, CHEF, afficher, appelsVers, corpsEnvoye, ouvrirSession, parametres, simulerApi } from './aide.jsx';

const annee = new Date().getFullYear();
const STATIONS = [200, [
  { numero_station: 1, nom_station: 'Antsiranana' },
  { numero_station: 2, nom_station: 'Nosy Be' },
]];
const MISSION = {
  numeroMission: 10,
  dateDebut: `${annee}-12-10`,
  dateFin: `${annee}-12-14`,
  trimestre: 4,
  annee,
  numeroStation: 1,
  nomStation: 'Antsiranana',
  verrouillee: false,
  intervenants: [
    { matricule: 'P002', identifiant: 'PRA', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', numeroUnite: 1, nomUnite: 'CNS' },
    { matricule: 'P010', identifiant: 'JRA', nom: 'Rakoto', prenom: 'Johny', fonction: 'Cadre de maintenance', numeroUnite: 2, nomUnite: 'ELB' },
  ],
};
const CANDIDATS = [200, {
  mission: MISSION,
  matriculeAffecte: null,
  agents: [
    { matricule: 'P002', identifiant: 'PRA', nom: 'Rabe', prenom: 'Paul', fonction: 'Cadre de maintenance', nomUnite: 'CNS', disponible: true, conflits: [], affecte: false },
    { matricule: 'P007', identifiant: 'LAL', nom: 'Soa', prenom: 'Lala', fonction: 'Chef de service', nomUnite: 'CNS', disponible: true, conflits: [], affecte: false },
  ],
}];

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

function apiDeBase(extra = {}) {
  return simulerApi({
    'GET /api/stations': STATIONS,
    'GET /api/missions': [200, (_options, url) => {
      const params = new URL(url, 'http://localhost').searchParams;
      return Number(params.get('trimestre')) === 4 ? [MISSION] : [];
    }],
    ...extra,
  });
}

describe('planning annuel des missions', () => {
  it('affiche les quatre trimestres, les stations même sans mission et les identifiants par unité', async () => {
    ouvrirSession(CADRE);
    const api = apiDeBase();
    afficher('/missions');

    expect(await screen.findByRole('heading', { name: `Trimestre 1 · ${annee}` })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Trimestre 2 · ${annee}` })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Trimestre 3 · ${annee}` })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Trimestre 4 · ${annee}` })).toBeInTheDocument();
    const ordreTrimestres = [...document.querySelectorAll('.tableau-trimestre h2')].map((h) => h.textContent);
    expect(ordreTrimestres).toEqual([1, 3, 2, 4].map((n) => `Trimestre ${n} · ${annee}`));

    const trimestre4 = screen.getByRole('heading', { name: `Trimestre 4 · ${annee}` }).closest('article');
    expect(within(trimestre4).getByText('Antsiranana')).toBeInTheDocument();
    expect(within(trimestre4).getByText('Nosy Be')).toBeInTheDocument();
    expect(within(trimestre4).getByText('PRA')).toBeInTheDocument();
    expect(within(trimestre4).getByText('JRA')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Planifier|Modifier|Supprimer|Mon unité/ })).not.toBeInTheDocument();
    expect(appelsVers(api, 'GET', '/api/missions')).toHaveLength(4);
    expect(appelsVers(api, 'GET', '/api/stations')).toHaveLength(1);
  });

  it('affiche une mission commencée en vert et sans actions de modification', async () => {
    ouvrirSession(CHEF);
    const verrouillee = { ...MISSION, dateDebut: `${annee}-01-10`, dateFin: `${annee}-01-12`, trimestre: 1, verrouillee: true };
    const api = apiDeBase({
      'GET /api/missions': [200, (_options, url) => {
        const q = Number(new URL(url, 'http://localhost').searchParams.get('trimestre'));
        return q === 1 ? [verrouillee] : [];
      }],
    });
    afficher('/missions');

    const trimestre1 = screen.getByRole('heading', { name: `Trimestre 1 · ${annee}` }).closest('article');
    const ligne = await within(trimestre1).findByText('Antsiranana');
    expect(ligne.closest('tr')).toHaveClass('mission-demarree');
    expect(within(trimestre1).getByText('Verrouillée')).toBeInTheDocument();
    expect(within(trimestre1).queryByRole('button', { name: /Modifier|Supprimer|Mon unité/ })).not.toBeInTheDocument();
    expect(appelsVers(api, 'GET', '/api/missions')).toHaveLength(4);
  });
});

describe('planification et affectation', () => {
  it('crée une mission avec une période du même trimestre', async () => {
    ouvrirSession(CHEF);
    const api = apiDeBase({ 'POST /api/missions': [201, { ...MISSION, numeroMission: 11, numeroStation: 2, nomStation: 'Nosy Be', intervenants: [] }] });
    const user = userEvent.setup();
    afficher('/missions');

    await user.click(await screen.findByRole('button', { name: 'Nouvelle mission' }));
    await user.selectOptions(screen.getByLabelText('Station'), '2');
    await user.type(screen.getByLabelText('Date de début'), `${annee}-12-03`);
    await user.type(screen.getByLabelText('Date de fin'), `${annee}-12-05`);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Mission créée');
    expect(corpsEnvoye(appelsVers(api, 'POST', '/api/missions')[0])).toEqual({
      numeroStation: 2, dateDebut: `${annee}-12-03`, dateFin: `${annee}-12-05`,
    });
  });

  it('permet de rechercher un identifiant et enregistre un seul cadre pour son unité', async () => {
    ouvrirSession(CHEF);
    const api = apiDeBase({
      'GET /api/missions/10/candidats': CANDIDATS,
      'PUT /api/missions/10/intervenants': [200, MISSION],
    });
    const user = userEvent.setup();
    afficher('/missions');

    await user.click(await screen.findByRole('button', { name: 'Affecter mon unité Antsiranana T4' }));
    const recherche = await screen.findByLabelText('Rechercher par identifiant');
    await user.type(recherche, 'PRA');
    await user.click(await screen.findByRole('option', { name: /PRA.*Paul Rabe/ }));
    expect(screen.getByText(/Sélectionné : PRA/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Intervenant enregistré');
    expect(corpsEnvoye(appelsVers(api, 'PUT', '/api/missions/10/intervenants')[0]).matricules).toEqual(['P002']);
  });

  it('permet de retirer l’intervenant de son unité', async () => {
    ouvrirSession(CHEF);
    const candidatsAvecAffectation = [200, {
      ...CANDIDATS[1],
      matriculeAffecte: 'P002',
      agents: CANDIDATS[1].agents.map((agent) => ({ ...agent, affecte: agent.matricule === 'P002' })),
    }];
    const api = apiDeBase({
      'GET /api/missions/10/candidats': candidatsAvecAffectation,
      'PUT /api/missions/10/intervenants': [200, MISSION],
    });
    const user = userEvent.setup();
    afficher('/missions');

    await user.click(await screen.findByRole('button', { name: 'Affecter mon unité Antsiranana T4' }));
    await screen.findByText(/Sélectionné : PRA/);
    await user.click(screen.getByRole('button', { name: 'Retirer cet intervenant' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(corpsEnvoye(appelsVers(api, 'PUT', '/api/missions/10/intervenants')[0]).matricules).toEqual([]);
  });
});
