import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ajouterMois, bornesDuMois, formaterDateFr, joursDuMois, moisCourant, nomMois } from '../utils/dates.js';

// Boundary : VueCalendrier (cas « Consulter le calendrier des congés »)
// Une ligne par agent de l'unité, une colonne par jour du mois.
const INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const jourSemaine = (iso) => { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j).getDay(); };

export default function CalendrierConges() {
  const { api } = useAuth();
  const [mois, setMois] = useState(() => moisCourant());
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const jours = useMemo(() => joursDuMois(mois), [mois]);

  useEffect(() => {
    let annule = false;
    const [dateDebut, dateFin] = bornesDuMois(mois);
    setDonnees(null);
    setErreur('');
    api(`/api/conges/calendrier?${new URLSearchParams({ dateDebut, dateFin })}`)
      .then((reponse) => { if (!annule) setDonnees(reponse); })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [api, mois]);

  const congeDu = (matricule, jour) =>
    donnees.conges.find((c) => c.matricule === matricule && c.dateDebut <= jour && jour <= c.dateFin);

  return (
    <section className="carte">
      <h1>Calendrier des congés</h1>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}

      <div className="barre-semaine">
        <button type="button" className="secondaire" onClick={() => setMois(ajouterMois(mois, -1))}>◀ Mois précédent</button>
        <div className="titre-semaine"><strong>{nomMois(mois)}</strong></div>
        <button type="button" className="secondaire" onClick={() => setMois(ajouterMois(mois, 1))}>Mois suivant ▶</button>
      </div>

      {donnees && (
        <>
          <div className="defilement">
            <table className="calendrier">
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
                {donnees.agents.map((agent) => (
                  <tr key={agent.matricule}>
                    <th scope="row" className="agent">{agent.prenom} {agent.nom}</th>
                    {jours.map((j) => {
                      const conge = congeDu(agent.matricule, j);
                      const libelle = conge
                        ? `${agent.prenom} ${agent.nom} ${formaterDateFr(j).slice(0, 5)} : ${conge.type ?? 'Congé'} (${conge.statut})`
                        : undefined;
                      return (
                        <td key={j} title={libelle} aria-label={libelle}
                            className={[
                              [0, 6].includes(jourSemaine(j)) ? 'weekend' : '',
                              conge ? (conge.statut === 'Validé' ? 'conge-valide' : 'conge-attente') : '',
                            ].join(' ').trim()} />
                      );
                    })}
                  </tr>
                ))}
                {donnees.agents.length === 0 && <tr><td colSpan={jours.length + 1} className="vide">Aucun agent dans cette unité</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="legende">
            <span className="echantillon conge-valide" /> Congé validé
            <span className="echantillon conge-attente" /> Demande en attente (visible du chef de service uniquement)
          </p>
        </>
      )}
    </section>
  );
}
