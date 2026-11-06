import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ajouterJours, formaterDateFr, formaterPeriode, lundiDe, semaineCourante } from '../utils/dates.js';

// Boundary : VuePlanning (cas « Consulter le planning de permanence ») + missions et congés de la semaine
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
  const missions = donnees?.missions ?? [];
  const conges = donnees?.conges ?? [];

  return (
    <section className="carte">
      <h1>Mon planning</h1>
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
        <>
          <h2>Permanences</h2>
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

          {missions.length > 0 && (
            <>
              <h2>Missions</h2>
              <ul>
                {missions.map((m) => (
                  <li key={`${m.station}${m.dateDebut}`}>{m.station} · {formaterPeriode(m.dateDebut, m.dateFin)}</li>
                ))}
              </ul>
            </>
          )}

          {conges.length > 0 && (
            <>
              <h2>Congés</h2>
              <ul>
                {conges.map((c) => (
                  <li key={`${c.type}${c.dateDebut}`}>
                    {c.type} · {formaterPeriode(c.dateDebut, c.dateFin)} <em>({c.statut})</em>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
