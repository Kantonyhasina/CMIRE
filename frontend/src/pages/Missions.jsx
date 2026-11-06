import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { formaterPeriode, trimestreDe } from '../utils/dates.js';

// Boundary : FormMission, FormAffectation, VueMissions
// Cas « Planifier une mission trimestrielle », « Affecter des intervenants à une mission »
// et « Consulter le planning des missions » (un tableau par trimestre).
const FORMULAIRE_VIDE = { numeroStation: '', dateDebut: '', dateFin: '' };

function regrouperParUnite(intervenants) {
  const groupes = [];
  for (const i of intervenants) {
    let groupe = groupes.find((g) => g.nomUnite === i.nomUnite);
    if (!groupe) { groupe = { nomUnite: i.nomUnite, agents: [] }; groupes.push(groupe); }
    groupe.agents.push(`${i.prenom} ${i.nom}`);
  }
  return groupes;
}

export default function Missions() {
  const { api, utilisateur } = useAuth();
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const courant = trimestreDe();

  const [annee, setAnnee] = useState(courant.annee);
  const [anneeSaisie, setAnneeSaisie] = useState(String(courant.annee)); // texte en cours de frappe
  const [trimestre, setTrimestre] = useState(courant.trimestre);
  const [missions, setMissions] = useState([]);
  const [stations, setStations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [message, setMessage] = useState('');
  const [edition, setEdition] = useState(null);         // null, 'nouvelle' ou numéro de la mission modifiée
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [affectation, setAffectation] = useState(null); // numéro de la mission dont on affecte les agents

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setMissions(await api(`/api/missions?${new URLSearchParams({ annee, trimestre })}`));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [api, annee, trimestre]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (estChef) api('/api/stations').then(setStations).catch((e) => setErreur(e.message));
  }, [api, estChef]);

  // La valeur saisie n'est appliquée que lorsqu'elle forme une année valide (évite des requêtes sur « 2 », « 20 »…)
  useEffect(() => { setAnneeSaisie(String(annee)); }, [annee]);

  function saisirAnnee(valeur) {
    setAnneeSaisie(valeur);
    if (/^\d{4}$/.test(valeur) && Number(valeur) >= 2000 && Number(valeur) <= 2100) setAnnee(Number(valeur));
  }

  const reinitialiserMessages = () => { setErreur(''); setDetails([]); setMessage(''); };

  function ouvrirNouvelle() {
    reinitialiserMessages();
    setFormulaire(FORMULAIRE_VIDE);
    setAffectation(null);
    setEdition('nouvelle');
  }

  function ouvrirModification(mission) {
    reinitialiserMessages();
    setFormulaire({ numeroStation: String(mission.numeroStation), dateDebut: mission.dateDebut, dateFin: mission.dateFin });
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
      // On affiche le trimestre de la mission (il se déduit de sa date de début)
      if (mission.annee !== annee || mission.trimestre !== trimestre) {
        setAnnee(mission.annee);
        setTrimestre(mission.trimestre);
      } else {
        await charger();
      }
    } catch (e) {
      setErreur(e.message);
      setDetails(e.details || []);
    }
  }

  async function supprimer(mission) {
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

  const champ = (nom) => ({ id: nom, value: formulaire[nom], onChange: (e) => setFormulaire({ ...formulaire, [nom]: e.target.value }) });

  return (
    <>
      <section className="carte">
        <h1>Missions</h1>
        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
        {details.length > 0 && <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>}
        {message && <p role="status" className="alerte succes">{message}</p>}

        <div className="barre-semaine">
          <div className="grille annee">
            <div>
              <label htmlFor="annee">Année</label>
              <input id="annee" type="number" min="2000" max="2100" value={anneeSaisie}
                     onChange={(e) => saisirAnnee(e.target.value)}
                     onBlur={() => setAnneeSaisie(String(annee))} />
            </div>
          </div>
          <div className="onglets" role="tablist">
            {[1, 2, 3, 4].map((t) => (
              <button key={t} type="button" role="tab" aria-selected={trimestre === t} onClick={() => setTrimestre(t)}>
                Trimestre {t}
              </button>
            ))}
          </div>
          {estChef && <button type="button" onClick={ouvrirNouvelle}>Nouvelle mission</button>}
        </div>

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
            <div><label htmlFor="dateDebut">Du</label><input type="date" required {...champ('dateDebut')} /></div>
            <div>
              <label htmlFor="dateFin">Au</label>
              <input type="date" required min={formulaire.dateDebut || undefined} {...champ('dateFin')} />
            </div>
            <div className="action">
              <button type="submit">Enregistrer</button>
              <button type="button" className="secondaire" onClick={() => setEdition(null)}>Annuler</button>
            </div>
          </form>
        )}
      </section>

      <section className="carte">
        <h2>Missions du trimestre {trimestre} · {annee}</h2>
        <div className="defilement">
          <table>
            <thead>
              <tr>
                <th>Station</th><th>Période</th><th>Intervenants</th>
                {estChef && <th><span className="cache">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr key={m.numeroMission}>
                  <td>{m.nomStation}</td>
                  <td>{formaterPeriode(m.dateDebut, m.dateFin)}</td>
                  <td>
                    {m.intervenants.length === 0
                      ? <span className="vide">Aucun intervenant</span>
                      : regrouperParUnite(m.intervenants).map((g) => (
                          <div key={g.nomUnite} className="groupe-unite"><strong>{g.nomUnite}</strong> : {g.agents.join(', ')}</div>
                        ))}
                  </td>
                  {estChef && (
                    <td className="actions">
                      <button type="button" aria-label={`Mes intervenants ${m.nomStation} ${formaterPeriode(m.dateDebut, m.dateFin)}`}
                              onClick={() => { reinitialiserMessages(); setEdition(null); setAffectation(m.numeroMission); }}>
                        Mes intervenants
                      </button>
                      <button type="button" className="secondaire" aria-label={`Modifier la mission ${m.nomStation}`}
                              onClick={() => ouvrirModification(m)}>Modifier</button>
                      <button type="button" className="danger" aria-label={`Supprimer la mission ${m.nomStation}`}
                              onClick={() => supprimer(m)}>Supprimer</button>
                    </td>
                  )}
                </tr>
              ))}
              {!chargement && missions.length === 0 && (
                <tr><td colSpan={estChef ? 4 : 3} className="vide">Aucune mission ce trimestre</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {estChef && affectation !== null && (
        <PanneauIntervenants key={affectation} numeroMission={affectation}
                             onFerme={() => setAffectation(null)}
                             onEnregistre={async () => { setAffectation(null); setMessage('Intervenants enregistrés'); await charger(); }} />
      )}
    </>
  );
}

// Affectation des agents de l'unité du chef à une mission (RG1/RG2 : les agents indisponibles sont grisés)
function PanneauIntervenants({ numeroMission, onFerme, onEnregistre }) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let annule = false;
    api(`/api/missions/${numeroMission}/candidats`)
      .then((reponse) => {
        if (annule) return;
        setDonnees(reponse);
        setSelection(new Set(reponse.agents.filter((a) => a.affecte).map((a) => a.matricule)));
      })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [api, numeroMission]);

  function basculer(matricule) {
    const suivante = new Set(selection);
    if (suivante.has(matricule)) suivante.delete(matricule); else suivante.add(matricule);
    setSelection(suivante);
  }

  async function enregistrer() {
    setErreur('');
    setDetails([]);
    setEnvoi(true);
    try {
      await api(`/api/missions/${numeroMission}/intervenants`, { methode: 'PUT', corps: { matricules: [...selection] } });
      await onEnregistre();
    } catch (e) {
      setErreur(e.message);
      setDetails(e.details || []);
      setEnvoi(false);
    }
  }

  if (!donnees) return <section className="carte">{erreur ? <p role="alert" className="alerte erreur">{erreur}</p> : <p>Chargement…</p>}</section>;

  const { mission, agents } = donnees;
  return (
    <section className="carte">
      <h2>Mes intervenants · {mission.nomStation} {formaterPeriode(mission.dateDebut, mission.dateFin)}</h2>
      <p className="sous-titre">Seuls les agents de votre unité sont proposés. Un agent grisé est indisponible sur la période.</p>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {details.length > 0 && <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>}

      <ul className="agents-liste">
        {agents.map((a) => (
          <li key={a.matricule}>
            <label>
              <input type="checkbox" checked={selection.has(a.matricule)}
                     disabled={!a.disponible && !a.affecte}
                     onChange={() => basculer(a.matricule)} />
              <span>{a.prenom} {a.nom} <small>({a.fonction})</small></span>
            </label>
            {!a.disponible && (
              <div className="indispo">Indisponible : {a.conflits.map((c) => c.detail).join(' ; ')}</div>
            )}
          </li>
        ))}
        {agents.length === 0 && <li className="vide">Aucun agent dans votre unité</li>}
      </ul>

      <div className="barre-actions">
        <span className="sous-titre">{selection.size} intervenant(s) sélectionné(s)</span>
        <span>
          <button type="button" className="secondaire" onClick={onFerme}>Fermer</button>{' '}
          <button type="button" onClick={enregistrer} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
        </span>
      </div>
    </section>
  );
}
