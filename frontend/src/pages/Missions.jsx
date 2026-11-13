import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { formaterPeriode, formaterDateFr } from '../utils/dates.js';
import SaisieIdentifiant from '../components/SaisieIdentifiant.jsx';
import Modal from '../components/Modal.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

const FORMULAIRE_VIDE = { numeroStation: '', dateDebut: '', dateFin: '' };
const CODES_UNITES = ['CNS', 'RSI', 'ELB'];
const ORDRE_STATIONS = [
  'ANTSIRANANA', 'NOSY BE', 'ANTALAHA', 'MAINTIRANO', 'MANANJARY',
  'MORONDAVA', 'TOLIARY', 'TOLAGNARO', 'MORONI',
];

// --- ICÔNES SVG ---
const IconeAjouter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const IconeLoupe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

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
  const { toasts, ajouterToast } = useToasts();
  
  const estChef = utilisateur?.fonction === ROLES.CHEF;
  const courant = trimestreCourantMadagascar();

  const [annee, setAnnee] = useState(courant.annee);
  const [trimestre, setTrimestre] = useState(courant.trimestre);
  const [missions, setMissions] = useState([]);
  const [stations, setStations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);

  // États de la recherche
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [termeRecherche, setTermeRecherche] = useState('');

  // États des modals
  const [modalEdition, setModalEdition] = useState(false);
  const [edition, setEdition] = useState(null);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [trimestreCible, setTrimestreCible] = useState(null);

  const [modalAffectation, setModalAffectation] = useState(null);
  const [modalSuppression, setModalSuppression] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const reponse = await api(`/api/missions?${new URLSearchParams({ annee, trimestre })}`);
      setMissions(reponse || []);
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setChargement(false);
    }
  }, [api, annee, trimestre]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    let annule = false;
    api('/api/stations')
      .then((reponse) => { if (!annule) setStations(ordonnerStations(reponse || [])); })
      .catch((e) => { if (!annule) ajouterToast(e.message, 'erreur'); });
    return () => { annule = true; };
  }, [api]);

  // Navigation trimestre
  const trimestrePrecedent = () => {
    if (trimestre === 1) { setAnnee(annee - 1); setTrimestre(4); }
    else setTrimestre(trimestre - 1);
  };
  const trimestreSuivant = () => {
    if (trimestre === 4) { setAnnee(annee + 1); setTrimestre(1); }
    else setTrimestre(trimestre + 1);
  };
  const changerAnnee = (e) => setAnnee(Number(e.target.value));

      // --- LOGIQUE DE RECHERCHE ET FILTRAGE ---
  const stationsFiltrees = useMemo(() => {
    if (!termeRecherche.trim()) return stations;
    
    // On normalise la saisie : minuscules, sans accents
    const terme = termeRecherche.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return stations.filter(station => {
      const mission = missions.find(m => Number(m.numeroStation) === Number(station.numero_station));
      
      // 1. Recherche par nom de station (partielle et sans accents)
      const nomStationNormalise = station.nom_station.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (nomStationNormalise.includes(terme)) return true;

      // 2. Si une mission existe, on cherche dans ses détails
      if (mission) {
        // 2a. Recherche par agent (identifiant, prénom ou nom)
        if (mission.intervenants?.some(a => {
          const agentStr = `${a.identifiant || ''} ${a.prenom} ${a.nom}`.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return agentStr.includes(terme);
        })) return true;

        // 2b. Recherche par date ou intervalle
        // On essaie de comprendre ce que l'utilisateur a tapé
        let dateRecherche = null;
        
        // Format JJ/MM/AAAA ou JJ-MM-AAAA
        const matchFr = terme.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
        if (matchFr) {
          const [_, j, m, a] = matchFr;
          dateRecherche = `${a}-${m}-${j}`;
        } 
        // Format AAAA-MM-JJ
        else if (/^\d{4}-\d{2}-\d{2}$/.test(terme)) {
          dateRecherche = terme;
        }

        // Si on a une date valide, on vérifie si elle est dans l'intervalle
        if (dateRecherche) {
          if (mission.dateDebut <= dateRecherche && dateRecherche <= mission.dateFin) {
            return true;
          }
        }

        // 2c. Recherche textuelle sur la période formatée (ex: "novembre", "du 01/11")
        const periodeStr = formaterPeriode(mission.dateDebut, mission.dateFin).toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (periodeStr.includes(terme)) return true;
      }
      
      return false;
    });
  }, [stations, missions, termeRecherche]);

  // --- ACTIONS MODALS ---
  function ouvrirCreation(station = null) {
    setFormulaire({ ...FORMULAIRE_VIDE, numeroStation: station ? String(station.numero_station) : '' });
    setTrimestreCible(trimestre);
    setEdition('nouvelle');
    setModalEdition(true);
  }

  function ouvrirModification(mission) {
    if (estVerrouillee(mission)) return;
    setFormulaire({ numeroStation: String(mission.numeroStation), dateDebut: mission.dateDebut, dateFin: mission.dateFin });
    setTrimestreCible(mission.trimestre);
    setEdition(mission.numeroMission);
    setModalEdition(true);
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    const corps = { ...formulaire, numeroStation: Number(formulaire.numeroStation) };
    try {
      const mission = edition === 'nouvelle'
        ? await api('/api/missions', { methode: 'POST', corps })
        : await api(`/api/missions/${edition}`, { methode: 'PUT', corps });
      
      ajouterToast(edition === 'nouvelle' ? 'Mission créée' : 'Mission modifiée', 'succes');
      setModalEdition(false);
      setEdition(null);
      
      if (mission.annee !== annee || mission.trimestre !== trimestre) {
        setAnnee(mission.annee);
        setTrimestre(mission.trimestre);
      } else {
        await charger();
      }
    } catch (e) {
      ajouterToast(e.message, 'erreur');
      if (e.details) ajouterToast(e.details.join(' ; '), 'erreur');
    }
  }

  async function confirmerSuppression() {
    if (!modalSuppression) return;
    try {
      await api(`/api/missions/${modalSuppression.numeroMission}`, { methode: 'DELETE' });
      ajouterToast('Mission supprimée', 'succes');
      setModalSuppression(null);
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }

  async function exporter() {
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
      ajouterToast(e.message, 'erreur');
    } finally {
      setExportEnCours(false);
    }
  }

  const champ = (nom) => ({
    id: nom,
    value: formulaire[nom] || '',
    onChange: (e) => setFormulaire((precedent) => ({ ...precedent, [nom]: e.target.value })),
  });
  
  const bornes = bornesTrimestre(annee, trimestreCible);
  const optionsAnnees = Array.from({ length: 5 }, (_, i) => courant.annee - 2 + i);
  const estValide = Boolean(formulaire.numeroStation && formulaire.dateDebut && formulaire.dateFin);

  return (
    <>
      <ToastsContainer toasts={toasts} />

      <section className="carte">
        {/* TITRE ET ACTIONS (Recherche + Nouvelle mission) */}
        <div className="entete-section-titre" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, textAlign: 'center' }}>Planning des missions</h1>
          
          <div className="actions-entete" style={{ justifyContent: 'flex-end', gap: '1rem' }}>
            {/* BARRE DE RECHERCHE */}
            <div className={`barre-recherche ${rechercheOuverte ? 'ouverte' : ''}`}>
              {!rechercheOuverte ? (
                <button 
                  type="button" 
                  className="btn-icone-search" 
                  onClick={() => setRechercheOuverte(true)}
                  title="Rechercher une station, une date..."
                >
                  <IconeLoupe />
                </button>
              ) : (
                <div className="champ-recherche-actif">
                  <input 
                    type="text" 
                    placeholder="Station, date, agent..." 
                    value={termeRecherche}
                    onChange={(e) => setTermeRecherche(e.target.value)}
                    autoFocus
                  />
                  <button 
                    type="button" 
                    className="btn-effacer-recherche"
                    onClick={() => {
                      setTermeRecherche('');
                      setRechercheOuverte(false);
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {estChef && (
              <button type="button" className="btn-primaire" onClick={() => ouvrirCreation()}>
                <IconeAjouter /> Nouvelle mission
              </button>
            )}
          </div>
        </div>

        {/* NAVIGATION TRIMESTRE */}
        <div className="barre-navigation-planning">
          <button type="button" className="btn-fleche" onClick={trimestrePrecedent}>◀</button>
          
          <div className="centre-planning">
            <div className="conteneur-titre-semaine">
              <strong className="ligne-semaine">Trimestre {trimestre}</strong>
              <span className="ligne-dates">Année {annee}</span>
            </div>
            <select className="select-annee-planning" value={annee} onChange={changerAnnee}>
              {optionsAnnees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          
          <button type="button" className="btn-fleche" onClick={trimestreSuivant}>▶</button>
        </div>

        <div className="barre-actions-planning">
          <div className="actions-planning-annuel">
                        {estChef && (
              <button type="button" className="secondaire" onClick={exporter} disabled={exportEnCours}>
                {exportEnCours ? 'Exportation…' : 'Exporter le planning Excel'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* TABLEAU UNIQUE */}
      <section className="carte" aria-label={`Planning des missions T${trimestre} ${annee}`}>
        <h2>Trimestre {trimestre} · {annee}</h2>
        <div className="defilement">
          <table className="tableau-missions-annuel tableau-moderne">
            <thead>
              <tr>
                <th>Station</th><th>Période</th>
                {CODES_UNITES.map((code) => <th key={code} className="text-center">{code}</th>)}
                {estChef && <th className="text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {stationsFiltrees.map((station) => {
                const mission = missions.find((m) => Number(m.numeroStation) === Number(station.numero_station));
                const verrouillee = estVerrouillee(mission);
                const aUnIntervenant = mission?.intervenants?.length > 0;

                return (
                  <tr key={station.numero_station} className={verrouillee ? 'mission-demarree' : ''}>
                    <td className="font-bold">{station.nom_station}</td>
                    <td>{mission ? formaterPeriode(mission.dateDebut, mission.dateFin) : <span className="vide">—</span>}</td>
                    {CODES_UNITES.map((code) => {
                      const agent = intervenantUnite(mission, code);
                      return <td key={code} className="text-center" title={agent ? `${agent.prenom} ${agent.nom}` : ''}>{agent ? (agent.identifiant || `${agent.prenom} ${agent.nom}`) : '—'}</td>;
                    })}
                    {estChef && (
                      <td className="actions-cellules">
                        {!mission ? (
                          trimestreEstEchu(annee, trimestre)
                            ? <span className="vide">Terminé</span>
                            : <button type="button" className="btn-primaire btn-petit" onClick={() => ouvrirCreation(station)}>Planifier</button>
                        ) : verrouillee ? (
                          <span className="mission-verrouillee-label">Verrouillée</span>
                        ) : (
                          <>
                            <button 
                              type="button" 
                              className={aUnIntervenant ? "btn-secondaire btn-petit" : "btn-primaire btn-petit"}
                              aria-label={`Affecter mon unité ${station.nom_station}`}
                              onClick={() => setModalAffectation(mission.numeroMission)}
                            >
                              {aUnIntervenant ? 'Modifier l\'affectation' : 'Mon unité'}
                            </button>
                            <button type="button" className="btn-secondaire btn-petit" aria-label={`Modifier ${station.nom_station}`}
                              onClick={() => ouvrirModification(mission)}>Modifier</button>
                            <button type="button" className="btn-icone btn-icone-danger" aria-label={`Supprimer ${station.nom_station}`}
                              onClick={() => setModalSuppression(mission)}>✕</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!chargement && stationsFiltrees.length === 0 && (
                <tr><td colSpan={estChef ? 6 : 5} className="vide">Aucune mission ne correspond à votre recherche</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODALS */}
      <Modal estOuvert={modalEdition} onFermer={() => setModalEdition(false)} titre={edition === 'nouvelle' ? 'Nouvelle mission' : 'Modifier la mission'}>
        <form className="formulaire-login" onSubmit={enregistrer}>
          <div className="grille-formulaire">
            <div className="groupe-champ pleine-largeur">
              <label htmlFor="numeroStation">Station</label>
              <div className="champ-avec-icone">
                <select id="numeroStation" required {...champ('numeroStation')} className="select-ligne">
                  <option value="">Choisir…</option>
                  {stations.map((s) => <option key={s.numero_station} value={s.numero_station}>{s.nom_station}</option>)}
                </select>
              </div>
            </div>
            <div className="groupe-champ">
              <label htmlFor="dateDebut">Date de début</label>
              <div className="champ-avec-icone">
                <input id="dateDebut" type="date" required min={bornes.min} max={bornes.max} {...champ('dateDebut')} />
              </div>
            </div>
            <div className="groupe-champ">
              <label htmlFor="dateFin">Date de fin</label>
              <div className="champ-avec-icone">
                <input id="dateFin" type="date" required min={formulaire.dateDebut || bornes.min} max={bornes.max} {...champ('dateFin')} />
              </div>
            </div>
          </div>
          {trimestreCible && <p className="sous-titre" style={{ marginTop: '1rem', textAlign: 'center' }}>Mission prévue au trimestre {trimestreCible} de {annee}.</p>}
          
          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn-connexion" disabled={!estValide}>
              {edition === 'nouvelle' ? 'Créer la mission' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {modalAffectation && (
        <Modal estOuvert={!!modalAffectation} onFermer={() => setModalAffectation(null)} titre="Mon unité / Affectation">
          <PanneauIntervenants 
            numeroMission={modalAffectation}
            onFerme={() => setModalAffectation(null)}
            onEnregistre={async () => { 
              setModalAffectation(null); 
              ajouterToast('Intervenant enregistré', 'succes'); 
              await charger(); 
            }} 
          />
        </Modal>
      )}

      <Modal estOuvert={!!modalSuppression} onFermer={() => setModalSuppression(null)} titre="Confirmer la suppression">
        <div className="contenu-suppression" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p>Voulez-vous vraiment supprimer la mission <strong>{modalSuppression?.nomStation}</strong> du {formaterPeriode(modalSuppression?.dateDebut, modalSuppression?.dateFin)} ?</p>
          <p className="texte-danger" style={{ color: '#b91c1c', fontWeight: 'bold' }}>Cette action est irréversible.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" className="btn-connexion" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setModalSuppression(null)}>Annuler</button>
          <button type="button" className="btn-connexion" style={{ background: '#ef4444' }} onClick={confirmerSuppression}>Supprimer</button>
        </div>
      </Modal>
    </>
  );
}

// Composant PanneauIntervenants
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
        const matricule = reponse.matriculeAffecte || reponse.agents?.find((a) => a.affecte)?.matricule || '';
        setSelection(matricule);
        const agent = reponse.agents?.find((a) => a.matricule === matricule);
        setSaisie(agent?.identifiant || '');
      })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [api, numeroMission]);

  const agents = donnees?.agents || [];
  const agentSelectionne = agents.find((a) => a.matricule === selection);

  // 💡 RÈGLE D'IHM : On ne peut pas enregistrer si aucun agent n'est sélectionné, 
  // ou si l'agent sélectionné est indisponible.
  const estValide = Boolean(selection && agentSelectionne?.disponible);

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

  if (!donnees) return <div style={{ textAlign: 'center', padding: '2rem' }}>{erreur ? <p style={{ color: '#ef4444' }}>{erreur}</p> : <p>Chargement…</p>}</div>;

  const { mission } = donnees;

  return (
    <div>
      <p className="sous-titre" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {mission?.nomStation} · T{mission?.trimestre}<br/>
        Un seul cadre par unité.
      </p>
      
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {details.length > 0 && <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>}

      <div className="grille-formulaire">
        <div className="groupe-champ pleine-largeur">
          <label htmlFor="identifiantIntervenant">Rechercher par identifiant</label>
          <div className="champ-avec-icone">
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
          </div>
        </div>
      </div>

      {agentSelectionne && (
        <p className="sous-titre selection-intervenant" style={{ marginTop: '1rem', textAlign: 'center' }}>
          Sélectionné : <strong>{agentSelectionne.identifiant}</strong><br/>
          {agentSelectionne.prenom} {agentSelectionne.nom} ({agentSelectionne.fonction})
        </p>
      )}
      
      {selection && (
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button type="button" className="btn-secondaire btn-petit" onClick={() => { setSelection(''); setSaisie(''); }}>Retirer cet intervenant</button>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.5rem' }}>Personnel de votre unité</h3>
        <ul className="agents-liste" style={{ maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {agents.map((agent) => (
            <li key={agent.matricule} style={{ padding: '0.4rem 0' }}>
              <span><strong>{agent.identifiant}</strong> — {agent.prenom} {agent.nom}</span>
              {!agent.disponible && <div className="indispo" style={{ color: '#ef4444', fontSize: '0.8rem' }}>Indisponible : {agent.conflits.map((c) => c.detail).join(' ; ')}</div>}
            </li>
          ))}
          {agents.length === 0 && <li className="vide">Aucun cadre disponible</li>}
        </ul>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button type="button" className="btn-connexion" onClick={enregistrer} disabled={envoi || !estValide}>
          {envoi ? 'Enregistrement…' : 'Enregistrer l\'affectation'}
        </button>
      </div>
    </div>
  );
}