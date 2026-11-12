import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ajouterMois, bornesDuMois, joursDuMois, moisCourant, nomMois } from '../utils/dates.js';
import { ROLES } from '../roles.js';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

const INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const jourSemaine = (iso) => { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j).getDay(); };

const IconeLoupe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export default function CalendrierConges() {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const [mois, setMois] = useState(() => moisCourant());
  const [donnees, setDonnees] = useState(null);
  
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [termeRecherche, setTermeRecherche] = useState('');

  const jours = useMemo(() => joursDuMois(mois), [mois]);
  const anneeActuelle = new Date().getFullYear();
  const optionsAnnees = Array.from({ length: 5 }, (_, i) => anneeActuelle - 2 + i);

  useEffect(() => {
    let annule = false;
    const [dateDebut, dateFin] = bornesDuMois(mois);
    setDonnees(null);
    api(`/api/conges/calendrier?${new URLSearchParams({ dateDebut, dateFin })}`)
      .then((reponse) => { if (!annule) setDonnees(reponse); })
      .catch((e) => { if (!annule) ajouterToast(e.message, 'erreur'); });
    return () => { annule = true; };
  }, [api, mois]);

  const changerAnnee = (e) => {
    const nouvelleAnnee = Number(e.target.value);
    const [annee, moisIndex] = mois.split('-');
    setMois(`${nouvelleAnnee}-${moisIndex}`);
  };

  const agentsAffiches = useMemo(() => {
    if (!donnees?.agents) return [];
    let resultat = [...donnees.agents];
    if (termeRecherche.trim()) {
      const terme = termeRecherche.toLowerCase().trim();
      resultat = resultat.filter(a => 
        a.nom.toLowerCase().includes(terme) ||
        a.prenom.toLowerCase().includes(terme) ||
        (a.identifiant && a.identifiant.toLowerCase().includes(terme))
      );
    }
    return resultat.sort((a, b) => {
      if (a.fonction === ROLES.CHEF && b.fonction !== ROLES.CHEF) return -1;
      if (b.fonction === ROLES.CHEF && a.fonction !== ROLES.CHEF) return 1;
      return `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`);
    });
  }, [donnees, termeRecherche]);

  const getBarresAgent = (agent) => {
    if (!donnees?.conges) return [];
    const congesAgent = donnees.conges.filter(c => c.matricule === agent.matricule);
    return congesAgent.map(conge => {
      const indexDebut = jours.indexOf(conge.dateDebut);
      const indexFin = jours.indexOf(conge.dateFin);
      if (indexFin < 0 || indexDebut >= jours.length) return null;
      const debutVisible = Math.max(0, indexDebut);
      const finVisible = Math.min(jours.length - 1, indexFin);
      const largeur = finVisible - debutVisible + 1;
      const pourcentageGauche = (debutVisible / jours.length) * 100;
      const pourcentageLargeur = (largeur / jours.length) * 100;
      return {
        ...conge,
        style: { left: `${pourcentageGauche}%`, width: `${pourcentageLargeur}%` },
        classeStatut: conge.statut === 'En pause' ? 'barre-pause' : conge.statut === 'Repris' ? 'barre-repris' : conge.statut === 'Validé' ? 'barre-valide' : 'barre-attente',
        libelle: `${agent.prenom} ${agent.nom} : ${conge.type ?? 'Congé'} (${conge.statut})`
      };
    }).filter(Boolean);
  };

  return (
    <section className="carte">
      <ToastsContainer toasts={toasts} />

      <div className="entete-calendrier-pro">
        <div className="titre-calendrier-gauche"></div>
        <h1 className="titre-centre-absolu">Calendrier des congés</h1>
        <div className="actions-entete">
          <div className={`barre-recherche ${rechercheOuverte ? 'ouverte' : ''}`}>
            {!rechercheOuverte ? (
              <button type="button" className="btn-icone-search" onClick={() => setRechercheOuverte(true)} title="Rechercher un agent">
                <IconeLoupe />
              </button>
            ) : (
              <div className="champ-recherche-actif">
                <input type="text" placeholder="Nom, Prénom ou Identifiant..." value={termeRecherche} onChange={(e) => setTermeRecherche(e.target.value)} autoFocus />
                <button type="button" className="btn-effacer-recherche" onClick={() => { setTermeRecherche(''); setRechercheOuverte(false); }}>✕</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="barre-navigation-calendrier">
        <button type="button" className="btn-fleche" onClick={() => setMois(ajouterMois(mois, -1))}>◀</button>
        <div className="titre-calendrier-centre">
          <strong>{nomMois(mois)}</strong>
          <select className="select-annee" value={mois.split('-')[0]} onChange={changerAnnee}>
            {optionsAnnees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button type="button" className="btn-fleche" onClick={() => setMois(ajouterMois(mois, 1))}>▶</button>
      </div>

      {donnees && (
        <>
          <div className="defilement">
            <table className="calendrier-pro">
              <thead>
                <tr>
                  <th className="agent">Agent</th>
                  {jours.map((j) => (
                    <th key={j} className={[0, 6].includes(jourSemaine(j)) ? 'weekend' : ''}>
                      {j.slice(8)}<br /><small>{INITIALES[jourSemaine(j)]}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentsAffiches.map((agent) => {
                  const barres = getBarresAgent(agent);
                  return (
                    <tr key={agent.matricule}>
                      <th scope="row" className="agent cellule-agent-pro">
                        <div className="agent-identifiant">
                          {agent.identifiant || agent.matricule}
                          {agent.fonction === ROLES.CHEF && <span className="badge-chef">Chef</span>}
                        </div>
                        <div className="agent-nom-complet">{agent.prenom} {agent.nom}</div>
                      </th>
                      <td colSpan={jours.length} className="cellule-barres">
                        <div className="ligne-barres">
                          {jours.map((j) => (
                            <div key={j} className={`fond-jour ${[0, 6].includes(jourSemaine(j)) ? 'weekend' : ''}`} />
                          ))}
                          {barres.map((barre, index) => (
                            <div key={index} className={`barre-conge ${barre.classeStatut}`} style={barre.style} title={barre.libelle} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {agentsAffiches.length === 0 && (
                  <tr><td colSpan={jours.length + 1} className="vide">Aucun agent ne correspond à votre recherche</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="legende" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span><span className="echantillon barre-valide" /> Congé validé</span>
            <span><span className="echantillon barre-attente" /> Demande en attente</span>
            <span><span className="echantillon barre-pause" /> Personnel en pause</span>
            <span><span className="echantillon barre-repris" /> Historique de pause</span>
          </p>
        </>
      )}
    </section>
  );
}