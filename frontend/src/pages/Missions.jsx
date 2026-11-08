import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { formaterPeriode } from '../utils/dates.js';
import SaisieIdentifiant from '../components/SaisieIdentifiant.jsx';

const FORMULAIRE_VIDE = { numeroStation: '', dateDebut: '', dateFin: '' };
const CODES_UNITES = ['CNS', 'RSI', 'ELB'];
const ORDRE_STATIONS = [
  'ANTSIRANANA', 'NOSY BE', 'ANTALAHA', 'MAINTIRANO', 'MANANJARY',
  'MORONDAVA', 'TOLIARY', 'TOLAGNARO', 'MORONI',
];

function normaliser(valeur) {
  return String(valeur || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase();
}

function ordonnerStations(stations) {
  return [...stations].sort((a, b) => {
    const rangA = ORDRE_STATIONS.indexOf(normaliser(a.nom_station));
    const rangB = ORDRE_STATIONS.indexOf(normaliser(b.nom_station));
    if (rangA !== -1 || rangB !== -1) return (rangA === -1 ? 999 : rangA) - (rangB === -1 ? 999 : rangB);
    return a.nom_station.localeCompare(b.nom_station);
  });
}

function intervenantUnite(mission, code) {
  return mission?.intervenants?.find((agent) => normaliser(agent.nomUnite).includes(code));
}

function dateLocaleISO() {
  // Même fuseau que le backend : Indian/Antananarivo.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Indian/Antananarivo' }).format(new Date());
}

function trimestreCourantMadagascar() {
  const date = dateLocaleISO();
  const annee = Number(date.slice(0, 4));
  const mois = Number(date.slice(5, 7));
  return { annee, trimestre: Math.ceil(mois / 3) };
}

function estVerrouillee(mission) {
  return Boolean(mission && (mission.verrouillee || mission.dateDebut <= dateLocaleISO()));
}

function trimestreEstEchu(annee, trimestre) {
  return bornesTrimestre(annee, trimestre).max < dateLocaleISO();
}

function bornesTrimestre(annee, trimestre) {
  if (!trimestre) return { min: `${annee}-01-01`, max: `${annee}-12-31` };
  const premierMois = (trimestre - 1) * 3 + 1;
  const dernierMois = premierMois + 2;
  const dernierJour = new Date(annee, dernierMois, 0).getDate();
  return {
    min: `${annee}-${String(premierMois).padStart(2, '0')}-01`,
    max: `${annee}-${String(dernierMois).padStart(2, '0')}-${String(dernierJour).padStart(2, '0')}`,
  };
}

export default function Missions() {
  const { api, utilisateur, telecharger } = useAuth();
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const courant = trimestreCourantMadagascar();

  const [annee, setAnnee] = useState(courant.annee);
  const [anneeSaisie, setAnneeSaisie] = useState(String(courant.annee));
  const [missionsParTrimestre, setMissionsParTrimestre] = useState({ 1: [], 2: [], 3: [], 4: [] });
  const [stations, setStations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [message, setMessage] = useState('');
  const [edition, setEdition] = useState(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [trimestreCible, setTrimestreCible] = useState(null);
  const [affectation, setAffectation] = useState(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const resultats = await Promise.all([1, 2, 3, 4].map((trimestre) =>
        api(`/api/missions?${new URLSearchParams({ annee, trimestre })}`)
      ));
      setMissionsParTrimestre({ 1: resultats[0], 2: resultats[1], 3: resultats[2], 4: resultats[3] });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [api, annee]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    let annule = false;
    api('/api/stations')
      .then((reponse) => { if (!annule) setStations(ordonnerStations(reponse)); })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [api]);

  useEffect(() => { setAnneeSaisie(String(annee)); }, [annee]);

  function saisirAnnee(valeur) {
    setAnneeSaisie(valeur);
    if (/^\d{4}$/.test(valeur) && Number(valeur) >= 2000 && Number(valeur) <= 2100) setAnnee(Number(valeur));
  }

  const reinitialiserMessages = () => { setErreur(''); setDetails([]); setMessage(''); };

  function ouvrirNouvelle(station = null, trimestre = null) {
    reinitialiserMessages();
    setFormulaire({ ...FORMULAIRE_VIDE, numeroStation: station ? String(station.numero_station) : '' });
    setTrimestreCible(trimestre);
    setAffectation(null);
    setEdition('nouvelle');
  }

  function ouvrirModification(mission) {
    if (estVerrouillee(mission)) return;
    reinitialiserMessages();
    setFormulaire({ numeroStation: String(mission.numeroStation), dateDebut: mission.dateDebut, dateFin: mission.dateFin });
    setTrimestreCible(mission.trimestre);
    setAffectation(null);
    setEdition(mission.numeroMission);
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    reinitialiserMessages();
    const corps = { ...formulaire, numeroStation: Number(formulaire.numeroStation) };
    try {
      const mission = edition === 'nouvelle'
        ? await api('/api/missions', { methode: 'POST', corps })
        : await api(`/api/missions/${edition}`, { methode: 'PUT', corps });
      setMessage(edition === 'nouvelle' ? 'Mission créée' : 'Mission modifiée');
      setEdition(null);
      setTrimestreCible(null);
      if (mission.annee !== annee) setAnnee(mission.annee);
      else await charger();
    } catch (e) {
      setErreur(e.message);
      setDetails(e.details || []);
    }
  }

  async function supprimer(mission) {
    if (estVerrouillee(mission)) return;
    if (!window.confirm(`Supprimer la mission ${mission.nomStation} ${formaterPeriode(mission.dateDebut, mission.dateFin)} ?`)) return;
    reinitialiserMessages();
    try {
      await api(`/api/missions/${mission.numeroMission}`, { methode: 'DELETE' });
      setMessage('Mission supprimée');
      if (affectation === mission.numeroMission) setAffectation(null);
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function exporter() {
    setErreur('');
    setExportEnCours(true);
    try {
      const fichier = await telecharger(`/api/missions/export?${new URLSearchParams({ annee })}`);
      const adresse = URL.createObjectURL(fichier);
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = `planning_missions_${annee}.xlsx`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(adresse);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setExportEnCours(false);
    }
  }

  const champ = (nom) => ({
    id: nom,
    value: formulaire[nom],
    onChange: (e) => setFormulaire((precedent) => ({ ...precedent, [nom]: e.target.value })),
  });
  const bornes = bornesTrimestre(annee, trimestreCible);
  const missions = missionsParTrimestre;

  return (
    <>
      <section className="carte">
        <h1>Planning des missions</h1>
        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
        {details.length > 0 && <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>}
        {message && <p role="status" className="alerte succes">{message}</p>}

        <div className="barre-semaine barre-planning-annuel">
          <div className="grille annee">
            <div>
              <label htmlFor="annee">Année</label>
              <input id="annee" type="number" min="2000" max="2100" value={anneeSaisie}
                onChange={(e) => saisirAnnee(e.target.value)}
                onBlur={() => setAnneeSaisie(String(annee))} />
            </div>
          </div>
          <div className="actions-planning-annuel">
            <button type="button" className="secondaire" onClick={exporter} disabled={exportEnCours}>
              {exportEnCours ? 'Exportation…' : 'Exporter le planning Excel'}
            </button>
            {estChef && <button type="button" onClick={() => ouvrirNouvelle()}>Nouvelle mission</button>}
          </div>
        </div>
        <p className="sous-titre">
          Chaque station possède un emplacement par trimestre. Une mission commencée est affichée en vert et verrouillée.
          Chaque unité peut affecter un seul cadre ou son chef de service.
        </p>

        {edition !== null && (
          <form className="grille formulaire-mission" onSubmit={enregistrer}>
            <h2 className="pleine-largeur">{edition === 'nouvelle' ? 'Nouvelle mission' : 'Modifier la mission'}</h2>
            <div>
              <label htmlFor="numeroStation">Station</label>
              <select required {...champ('numeroStation')}>
                <option value="">Choisir…</option>
                {stations.map((s) => <option key={s.numero_station} value={s.numero_station}>{s.nom_station}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dateDebut">Date de début</label>
              <input type="date" required min={bornes.min} max={bornes.max} {...champ('dateDebut')} />
            </div>
            <div>
              <label htmlFor="dateFin">Date de fin</label>
              <input type="date" required min={formulaire.dateDebut || bornes.min} max={bornes.max} {...champ('dateFin')} />
            </div>
            <div className="action">
              <button type="submit">Enregistrer</button>
              <button type="button" className="secondaire" onClick={() => { setEdition(null); setTrimestreCible(null); }}>Annuler</button>
            </div>
            {trimestreCible && <p className="sous-titre pleine-largeur">Mission prévue au trimestre {trimestreCible} de {annee}.</p>}
          </form>
        )}
      </section>

      <section className="planning-annuel" aria-label={`Planning annuel des missions ${annee}`}>
        {[1, 3, 2, 4].map((trimestre) => (
          <article className="carte tableau-trimestre" key={trimestre}>
            <h2>Trimestre {trimestre} · {annee}</h2>
            <div className="defilement">
              <table className="tableau-missions-annuel">
                <thead>
                  <tr>
                    <th>Station</th><th>Période</th>
                    {CODES_UNITES.map((code) => <th key={code}>{code}</th>)}
                    {estChef && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {stations.map((station) => {
                    const mission = missions[trimestre].find((m) => Number(m.numeroStation) === Number(station.numero_station));
                    const verrouillee = estVerrouillee(mission);
                    return (
                      <tr key={station.numero_station} className={verrouillee ? 'mission-demarree' : ''}>
                        <td>{station.nom_station}</td>
                        <td>{mission ? formaterPeriode(mission.dateDebut, mission.dateFin) : <span className="vide">—</span>}</td>
                        {CODES_UNITES.map((code) => {
                          const agent = intervenantUnite(mission, code);
                          return <td key={code} title={agent ? `${agent.prenom} ${agent.nom}` : ''}>{agent ? (agent.identifiant || `${agent.prenom} ${agent.nom}`) : '—'}</td>;
                        })}
                        {estChef && (
                          <td className="actions actions-mission">
                            {!mission ? (
                              trimestreEstEchu(annee, trimestre)
                                ? <span className="vide">Trimestre terminé</span>
                                : <button type="button" className="secondaire" onClick={() => ouvrirNouvelle(station, trimestre)}>Planifier</button>
                            ) : verrouillee ? (
                              <span className="mission-verrouillee-label">Verrouillée</span>
                            ) : (
                              <>
                                <button type="button" aria-label={`Affecter mon unité ${station.nom_station} T${trimestre}`}
                                  onClick={() => { reinitialiserMessages(); setEdition(null); setAffectation(mission.numeroMission); }}>Mon unité</button>
                                <button type="button" className="secondaire" aria-label={`Modifier la mission ${station.nom_station} T${trimestre}`}
                                  onClick={() => ouvrirModification(mission)}>Modifier</button>
                                <button type="button" className="danger" aria-label={`Supprimer la mission ${station.nom_station} T${trimestre}`}
                                  onClick={() => supprimer(mission)}>Supprimer</button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!chargement && stations.length === 0 && (
                    <tr><td colSpan={estChef ? 6 : 5} className="vide">Aucune station configurée. Ajoutez les stations dans Référentiels.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </section>

      {estChef && affectation !== null && (
        <PanneauIntervenants key={affectation} numeroMission={affectation}
          onFerme={() => setAffectation(null)}
          onEnregistre={async () => { setAffectation(null); setMessage('Intervenant enregistré'); await charger(); }} />
      )}
    </>
  );
}

// Sélection unique : un chef de service affecte un seul cadre (ou lui-même) de son unité.
function PanneauIntervenants({ numeroMission, onFerme, onEnregistre }) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState('');
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let annule = false;
    api(`/api/missions/${numeroMission}/candidats`)
      .then((reponse) => {
        if (annule) return;
        setDonnees(reponse);
        const matricule = reponse.matriculeAffecte || reponse.agents.find((a) => a.affecte)?.matricule || '';
        setSelection(matricule);
        const agent = reponse.agents.find((a) => a.matricule === matricule);
        setSaisie(agent?.identifiant || '');
      })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [api, numeroMission]);

  const agents = donnees?.agents || [];
  const agentSelectionne = agents.find((a) => a.matricule === selection);

  async function enregistrer() {
    setErreur('');
    setDetails([]);
    setEnvoi(true);
    try {
      await api(`/api/missions/${numeroMission}/intervenants`, {
        methode: 'PUT', corps: { matricules: selection ? [selection] : [] },
      });
      await onEnregistre();
    } catch (e) {
      setErreur(e.message);
      setDetails(e.details || []);
      setEnvoi(false);
    }
  }

  if (!donnees) return <section className="carte">{erreur ? <p role="alert" className="alerte erreur">{erreur}</p> : <p>Chargement…</p>}</section>;

  const { mission } = donnees;
  return (
    <section className="carte panneau-intervenants-mission">
      <h2>Intervenant de votre unité · {mission.nomStation} · T{mission.trimestre}</h2>
      <p className="sous-titre">Un seul cadre de maintenance ou chef de service par unité. Les personnes indisponibles sont signalées et ne peuvent pas être sélectionnées.</p>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {details.length > 0 && <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>}

      <div className="champ-intervenant-mission">
        <label htmlFor="identifiantIntervenant">Rechercher par identifiant</label>
        <SaisieIdentifiant
          id="identifiantIntervenant"
          valeur={saisie}
          agents={agents}
          indisponibilite={(agent) => (!agent.disponible ? agent.conflits?.[0] : null)}
          onSaisie={(valeur) => { setSaisie(valeur); setSelection(''); }}
          onChoisir={(matricule) => {
            const agent = agents.find((a) => a.matricule === matricule);
            setSelection(matricule);
            setSaisie(agent?.identifiant || '');
          }}
        />
        {agentSelectionne && (
          <p className="sous-titre selection-intervenant">
            Sélectionné : <strong>{agentSelectionne.identifiant}</strong> — {agentSelectionne.prenom} {agentSelectionne.nom} ({agentSelectionne.fonction})
          </p>
        )}
        {selection && <button type="button" className="secondaire" onClick={() => { setSelection(''); setSaisie(''); }}>Retirer cet intervenant</button>}
      </div>

      <div className="liste-candidats-mission">
        <h3>Personnel de votre unité</h3>
        <ul className="agents-liste">
          {agents.map((agent) => (
            <li key={agent.matricule}>
              <span><strong>{agent.identifiant}</strong> — {agent.prenom} {agent.nom} <small>({agent.fonction})</small></span>
              {!agent.disponible && <div className="indispo">Indisponible : {agent.conflits.map((c) => c.detail).join(' ; ')}</div>}
            </li>
          ))}
          {agents.length === 0 && <li className="vide">Aucun cadre ou chef dans votre unité</li>}
        </ul>
      </div>

      <div className="barre-actions">
        <span className="sous-titre">{selection ? '1 intervenant sélectionné' : 'Aucun intervenant sélectionné'}</span>
        <span>
          <button type="button" className="secondaire" onClick={onFerme}>Fermer</button>{' '}
          <button type="button" onClick={enregistrer} disabled={envoi || Boolean(selection && !agentSelectionne?.disponible)}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </span>
      </div>
    </section>
  );
}
