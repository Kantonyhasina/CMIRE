import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ajouterJours, formaterDateFr, formaterPeriode, lundiDe, semaineCourante } from '../utils/dates.js';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

export default function MonPlanning() {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const [date, setDate] = useState(() => semaineCourante()[0]);
  const [donnees, setDonnees] = useState(null);

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    api(`/api/permanences/mon-planning?${new URLSearchParams({ date })}`)
      .then((reponse) => { if (!annule) setDonnees(reponse); })
      .catch((e) => { if (!annule) ajouterToast(e.message, 'erreur'); });
    return () => { annule = true; };
  }, [api, date]);

  const allerA = (nouvelleDate) => setDate(lundiDe(nouvelleDate));
  
  const { semaine } = donnees ?? {};
  const missions = donnees?.missions ?? [];
  const conges = donnees?.conges ?? [];

  const anneeAffichee = semaine?.annee || new Date().getFullYear();
  const optionsAnnees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const changerAnnee = (e) => {
    const anneeChoisie = Number(e.target.value);
    const differenceAnnees = anneeChoisie - anneeAffichee;
    allerA(ajouterJours(date, differenceAnnees * 364));
  };

  return (
    <section className="carte">
      <ToastsContainer toasts={toasts} />

      <div className="entete-planning-pro">
        <h1 className="titre-centre-planning">Mon planning</h1>
      </div>

      <div className="barre-navigation-planning">
        <button type="button" className="btn-fleche" onClick={() => allerA(ajouterJours(date, -7))}>◀</button>
        
        <div className="centre-planning">
          {semaine ? (
            <div className="conteneur-titre-semaine">
              <strong className="ligne-semaine">Semaine {semaine.numeroIso}</strong>
              <span className="ligne-dates">du {formaterDateFr(semaine.dateDebut)} au {formaterDateFr(semaine.dateFin)}</span>
            </div>
          ) : (
            <strong>Chargement…</strong>
          )}
          <select className="select-annee-planning" value={anneeAffichee} onChange={changerAnnee}>
            {optionsAnnees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        
        <button type="button" className="btn-fleche" onClick={() => allerA(ajouterJours(date, 7))}>▶</button>
      </div>

      {donnees && (
        <div className="grille-planning">
          <div className="bloc-planning bloc-permanences">
            <h2 className="titre-bloc">Permanences</h2>
            <div className="defilement">
              <table className="tableau-moderne">
                <thead>
                  <tr><th>Jour</th><th>Horaire</th><th>Poste</th></tr>
                </thead>
                <tbody>
                  {donnees.permanences.map((p) => (
                    <tr key={`${p.date}${p.horaire}${p.poste}`}>
                      <td className="font-bold">{p.jour} {formaterDateFr(p.date).slice(0, 5)}</td>
                      <td>{p.horaire}</td>
                      <td>{p.poste ?? '—'}</td>
                    </tr>
                  ))}
                  {donnees.permanences.length === 0 && (
                    <tr><td colSpan="3" className="vide">Aucune permanence cette semaine</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bloc-planning bloc-evenements">
            <div className="sous-bloc">
              <h2 className="titre-bloc">Missions</h2>
              {missions.length > 0 ? (
                <ul className="liste-evenements">
                  {missions.map((m) => (
                    <li key={`${m.station}${m.dateDebut}`}>
                      <strong>{m.station}</strong>
                      <span>{formaterPeriode(m.dateDebut, m.dateFin)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vide">Aucune mission cette semaine</p>
              )}
            </div>

            <div className="sous-bloc">
              <h2 className="titre-bloc">Congés</h2>
              {conges.length > 0 ? (
                <ul className="liste-evenements">
                  {conges.map((c) => (
                    <li key={`${c.type}${c.dateDebut}`}>
                      <strong>{c.type}</strong>
                      <span>{formaterPeriode(c.dateDebut, c.dateFin)} <em className={`badge-statut ${c.statut === 'Validé' ? 'valide' : 'attente'}`}>({c.statut})</em></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vide">Aucun congé cette semaine</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}