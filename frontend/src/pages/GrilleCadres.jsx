import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { formaterDateFr } from '../utils/dates.js';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

const cle = (matricule, jour, creneau) => `${matricule}|${jour}|${creneau}`;

export default function GrilleCadres({
  date,
  numeroUnite,
  lectureSeule = false,
  onModifie,
  onSemaine,
}) {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [modifie, setModifie] = useState(false);
  const [details, setDetails] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  function appliquer(reponse) {
    setDonnees(reponse);
    setSelection(new Set(
      reponse.affectations.map((a) => cle(a.matricule, a.jour, a.creneau))
    ));
    setModifie(false);
    onModifie(false);
    onSemaine(reponse.semaine);
  }

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setDetails([]);

    api(`/api/permanences/cadres?${new URLSearchParams({ date, numeroUnite })}`)
      .then((reponse) => {
        if (!annule) appliquer(reponse);
      })
      .catch((e) => {
        if (!annule) ajouterToast(e.message, 'erreur');
      });

    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date, numeroUnite]);

  function basculer(matricule, jour, creneau) {
    if (lectureSeule || envoi) return;

    const suivante = new Set(selection);
    const k = cle(matricule, jour, creneau);
    if (suivante.has(k)) suivante.delete(k);
    else suivante.add(k);

    setSelection(suivante);
    setModifie(true);
    onModifie(true);
  }

  async function enregistrer() {
    if (lectureSeule || !modifie || envoi) return;

    setDetails([]);
    setEnvoi(true);

    try {
      const affectations = [...selection].map((k) => {
        const [matricule, jour, creneau] = k.split('|');
        return { matricule, jour, creneau };
      });

      const reponse = await api('/api/permanences/cadres', {
        methode: 'PUT',
        corps: { date, numeroUnite: Number(numeroUnite), affectations },
      });

      appliquer(reponse);
      ajouterToast('Planning enregistré avec succès', 'succes');
    } catch (e) {
      ajouterToast(e.message, 'erreur');
      setDetails(e.details || []);
    } finally {
      setEnvoi(false);
    }
  }

  if (!donnees) {
    return <p>Chargement…</p>;
  }

  const blocage = (agent, jourDate) =>
    agent.indisponibilites.find((i) => i.dateDebut <= jourDate && jourDate <= i.dateFin);

  const nbCreneaux = donnees.jours.length * donnees.creneaux.length;
  const nonCouverts = donnees.jours
    .flatMap((j) => donnees.creneaux.map((c) => [j.nom, c]))
    .filter(([jour, creneau]) => !donnees.agents.some(
      (a) => selection.has(cle(a.matricule, jour, creneau))
    )).length;

  return (
    <>
      <ToastsContainer toasts={toasts} />

      {details.length > 0 && (
        <ul className="alerte erreur details">
          {details.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}

      {donnees.agents.length === 0 ? (
        <p className="vide">Aucun chef de service ou cadre de maintenance dans cette unité.</p>
      ) : (
        <div className="defilement">
          <table className="grille-perm">
            <thead>
              <tr>
                <th rowSpan="2">Personnel</th>
                {donnees.jours.map((j) => (
                  <th key={j.nom} colSpan={donnees.creneaux.length} className="jour">
                    {j.nom}<br />
                    <small>{formaterDateFr(j.date).slice(0, 5)}</small>
                  </th>
                ))}
              </tr>
              <tr>
                {donnees.jours.flatMap((j) => donnees.creneaux.map((c) => (
                  <th key={`${j.nom}${c}`} className="creneau" title={c}>
                    {c.split('-')[0]}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody>
              {donnees.agents.map((agent) => (
                <tr key={agent.matricule}>
                  <th scope="row" className="agent">
                    {agent.prenom} {agent.nom}
                    {agent.fonction === ROLES.CHEF && (
                      <small className="fonction-agent">Chef de service</small>
                    )}
                    {agent.actif === false && <small className="statut-inactif">Compte désactivé · historique</small>}
                    {agent.numeroTelephone && <small> · {agent.numeroTelephone}</small>}
                  </th>
                  {donnees.jours.flatMap((j) => donnees.creneaux.map((c) => {
                    const coche = selection.has(cle(agent.matricule, j.nom, c));
                    const bloque = blocage(agent, j.date);
                    return (
                      <td
                        key={`${j.nom}${c}`}
                        className={bloque ? (coche ? 'case conflit' : 'case bloque') : 'case'}
                      >
                        <input
                          type="checkbox"
                          checked={coche}
                          disabled={lectureSeule || envoi || (agent.actif === false && !coche) || (Boolean(bloque) && !coche)}
                          title={bloque ? `Indisponible : ${bloque.detail}` : undefined}
                          aria-label={`${agent.prenom} ${agent.nom} ${j.nom} ${c}`}
                          onChange={() => basculer(agent.matricule, j.nom, c)}
                        />
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
          {nonCouverts > 0
            ? `${nonCouverts} créneau(x) sur ${nbCreneaux} sans personnel de cette unité`
            : 'Tous les créneaux ont au moins un personnel affecté'}
        </span>
        {!lectureSeule && (
          <button type="button" onClick={enregistrer} disabled={envoi || !modifie}>
            {envoi ? 'Enregistrement…' : 'Enregistrer le planning'}
          </button>
        )}
      </div>
    </>
  );
}