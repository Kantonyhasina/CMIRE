import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr } from '../utils/dates.js';

// Boundary : FormPermanenceCadre (cas « Planifier la permanence des cadres »)
// Une case cochée = l'agent assure ce créneau. Une case grisée = agent en congé validé ou en mission ce jour-là (RG1/RG2).
const cle = (matricule, jour, creneau) => `${matricule}|${jour}|${creneau}`;

export default function GrilleCadres({ date, numeroUnite, onModifie, onSemaine }) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [modifie, setModifie] = useState(false);
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function appliquer(reponse) {
    setDonnees(reponse);
    setSelection(new Set(reponse.affectations.map((a) => cle(a.matricule, a.jour, a.creneau))));
    onSemaine(reponse.semaine);
  }

  useEffect(() => {
    let annule = false;
    api(`/api/permanences/cadres?${new URLSearchParams({ date, numeroUnite })}`)
      .then((reponse) => { if (!annule) appliquer(reponse); })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date, numeroUnite]);

  function basculer(matricule, jour, creneau) {
    const suivante = new Set(selection);
    const k = cle(matricule, jour, creneau);
    if (suivante.has(k)) suivante.delete(k); else suivante.add(k);
    setSelection(suivante);
    setModifie(true);
    onModifie(true);
    setMessage('');
  }

  async function enregistrer() {
    setErreur('');
    setDetails([]);
    setMessage('');
    setEnvoi(true);
    try {
      const affectations = [...selection].map((k) => {
        const [matricule, jour, creneau] = k.split('|');
        return { matricule, jour, creneau };
      });
      appliquer(await api('/api/permanences/cadres', {
        methode: 'PUT',
        corps: { date, numeroUnite: Number(numeroUnite), affectations },
      }));
      setModifie(false);
      onModifie(false);
      setMessage('Planning enregistré');
    } catch (e) {
      setErreur(e.message);
      setDetails(e.details || []);
    } finally {
      setEnvoi(false);
    }
  }

  if (!donnees) return erreur ? <p role="alert" className="alerte erreur">{erreur}</p> : <p>Chargement…</p>;

  const blocage = (agent, jourDate) =>
    agent.indisponibilites.find((i) => i.dateDebut <= jourDate && jourDate <= i.dateFin);
  const nbCreneaux = donnees.jours.length * donnees.creneaux.length;
  const nonCouverts = donnees.jours.flatMap((j) => donnees.creneaux.map((c) => [j.nom, c]))
    .filter(([jour, creneau]) => !donnees.agents.some((a) => selection.has(cle(a.matricule, jour, creneau)))).length;

  return (
    <>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {details.length > 0 && (
        <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>
      )}
      {message && <p role="status" className="alerte succes">{message}</p>}

      {donnees.agents.length === 0 ? (
        <p className="vide">Aucun cadre de maintenance dans cette unité.</p>
      ) : (
        <div className="defilement">
          <table className="grille-perm">
            <thead>
              <tr>
                <th rowSpan="2">Agent</th>
                {donnees.jours.map((j) => (
                  <th key={j.nom} colSpan={donnees.creneaux.length} className="jour">
                    {j.nom}<br /><small>{formaterDateFr(j.date).slice(0, 5)}</small>
                  </th>
                ))}
              </tr>
              <tr>
                {donnees.jours.flatMap((j) => donnees.creneaux.map((c) => (
                  <th key={`${j.nom}${c}`} className="creneau" title={c}>{c.split('-')[0]}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {donnees.agents.map((agent) => (
                <tr key={agent.matricule}>
                  <th scope="row" className="agent">
                    {agent.prenom} {agent.nom}
                    {agent.numeroTelephone && <small> · {agent.numeroTelephone}</small>}
                  </th>
                  {donnees.jours.flatMap((j) => donnees.creneaux.map((c) => {
                    const coche = selection.has(cle(agent.matricule, j.nom, c));
                    const bloque = blocage(agent, j.date);
                    return (
                      <td key={`${j.nom}${c}`} className={bloque ? (coche ? 'case conflit' : 'case bloque') : 'case'}>
                        <input type="checkbox" checked={coche} disabled={Boolean(bloque) && !coche}
                               title={bloque ? `Indisponible : ${bloque.detail}` : undefined}
                               aria-label={`${agent.prenom} ${agent.nom} ${j.nom} ${c}`}
                               onChange={() => basculer(agent.matricule, j.nom, c)} />
                      </td>
                    );
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="barre-actions">
        <span className="sous-titre">
          {nonCouverts > 0 ? `${nonCouverts} créneau(x) sur ${nbCreneaux} sans cadre de cette unité` : 'Tous les créneaux ont un cadre'}
        </span>
        <button type="button" onClick={enregistrer} disabled={envoi || !modifie}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le planning'}
        </button>
      </div>
    </>
  );
}
