import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr } from '../utils/dates.js';

// Boundary : FormPermanenceSurveillant (cas « Planifier la permanence des surveillants »)
// Un seul surveillant par poste, jour et plage ; le même surveillant peut tenir deux postes à la même plage.
const cle = (numeroPoste, jour, plage) => `${numeroPoste}|${jour}|${plage}`;
const libellePlage = (plage) => { const [d, f] = plage.split('-'); return `De ${d} à ${f}`; };

export default function GrilleSurveillants({ date, onModifie, onSemaine }) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState({}); // cle -> matricule
  const [modifie, setModifie] = useState(false);
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function appliquer(reponse) {
    setDonnees(reponse);
    setSelection(Object.fromEntries(reponse.affectations.map((a) => [cle(a.numeroPoste, a.jour, a.plage), a.matricule])));
    onSemaine(reponse.semaine);
  }

  useEffect(() => {
    let annule = false;
    api(`/api/permanences/surveillants?${new URLSearchParams({ date })}`)
      .then((reponse) => { if (!annule) appliquer(reponse); })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date]);

  function choisir(k, matricule) {
    const suivante = { ...selection };
    if (matricule) suivante[k] = matricule; else delete suivante[k];
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
      const affectations = Object.entries(selection).map(([k, matricule]) => {
        const [numeroPoste, jour, plage] = k.split('|');
        return { numeroPoste: Number(numeroPoste), jour, plage, matricule };
      });
      appliquer(await api('/api/permanences/surveillants', { methode: 'PUT', corps: { date, affectations } }));
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

  const bloque = (agent, jourDate) =>
    agent.indisponibilites.find((i) => i.dateDebut <= jourDate && jourDate <= i.dateFin);

  return (
    <>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {details.length > 0 && (
        <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>
      )}
      {message && <p role="status" className="alerte succes">{message}</p>}

      {donnees.postes.length === 0 ? (
        <p className="vide">Aucun poste de surveillance : ajoutez-en dans « Référentiels ».</p>
      ) : (
        <div className="defilement">
          <table className="grille-perm surveillants">
            <thead>
              <tr>
                <th>Poste / plage</th>
                {donnees.jours.map((j) => (
                  <th key={j.nom} className="jour">{j.nom}<br /><small>{formaterDateFr(j.date).slice(0, 5)}</small></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnees.postes.map((poste) => (
                <PosteLignes key={poste.numero_poste} poste={poste} donnees={donnees}
                             selection={selection} bloque={bloque} choisir={choisir} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="barre-actions">
        <span className="sous-titre">{Object.keys(selection).length} créneau(x) pourvu(s)</span>
        <button type="button" onClick={enregistrer} disabled={envoi || !modifie}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le planning'}
        </button>
      </div>
    </>
  );
}

function PosteLignes({ poste, donnees, selection, bloque, choisir }) {
  return (
    <>
      <tr className="bandeau"><th colSpan={donnees.jours.length + 1}>{poste.nom_poste}</th></tr>
      {donnees.plages.map((plage) => (
        <tr key={plage}>
          <th scope="row" className="agent">{libellePlage(plage)}</th>
          {donnees.jours.map((j) => {
            const k = cle(poste.numero_poste, j.nom, plage);
            return (
              <td key={j.nom} className="case-select">
                <select value={selection[k] ?? ''} aria-label={`${poste.nom_poste} ${j.nom} ${plage}`}
                        onChange={(e) => choisir(k, e.target.value)}>
                  <option value="">—</option>
                  {donnees.agents.map((agent) => {
                    const conflit = bloque(agent, j.date);
                    return (
                      <option key={agent.matricule} value={agent.matricule}
                              disabled={Boolean(conflit) && selection[k] !== agent.matricule}
                              title={conflit ? conflit.detail : undefined}>
                        {agent.prenom} {agent.nom}{conflit ? ' (indisponible)' : ''}
                      </option>
                    );
                  })}
                </select>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
