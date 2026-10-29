import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ajouterJours, formaterDateFr, lundiDe, semaineCourante } from '../utils/dates.js';

// Boundary : VuePlanning (cas « Consulter le planning de permanence »)
export default function MonPlanning() {
  const { api } = useAuth();
  const [date, setDate] = useState(() => semaineCourante()[0]);
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setErreur('');
    api(`/api/permanences/mon-planning?${new URLSearchParams({ date })}`)
      .then((reponse) => { if (!annule) setDonnees(reponse); })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
  }, [api, date]);

  const allerA = (nouvelleDate) => setDate(lundiDe(nouvelleDate));
  const { semaine } = donnees ?? {};

  return (
    <section className="carte">
      <h1>Mon planning de permanence</h1>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}

      <div className="barre-semaine">
        <button type="button" className="secondaire" onClick={() => allerA(ajouterJours(date, -7))}>◀ Semaine précédente</button>
        <div className="titre-semaine">
          {semaine
            ? <><strong>Semaine {semaine.numeroIso} · {semaine.annee}</strong>
                <span>du {formaterDateFr(semaine.dateDebut)} au {formaterDateFr(semaine.dateFin)}</span></>
            : <strong>Chargement…</strong>}
        </div>
        <button type="button" className="secondaire" onClick={() => allerA(ajouterJours(date, 7))}>Semaine suivante ▶</button>
      </div>

      {donnees && (
        <table>
          <thead><tr><th>Jour</th><th>Horaire</th><th>Poste</th></tr></thead>
          <tbody>
            {donnees.permanences.map((p) => (
              <tr key={`${p.date}${p.horaire}${p.poste}`}>
                <td>{p.jour} {formaterDateFr(p.date).slice(0, 5)}</td>
                <td>{p.horaire}</td>
                <td>{p.poste ?? '—'}</td>
              </tr>
            ))}
            {donnees.permanences.length === 0 && (
              <tr><td colSpan="3" className="vide">Aucune permanence cette semaine</td></tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
