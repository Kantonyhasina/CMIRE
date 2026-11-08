import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr } from '../utils/dates.js';
import SaisieIdentifiant from '../components/SaisieIdentifiant.jsx';

// Un seul occupant par poste, jour et plage. L'occupant est soit un surveillant
// identifié par son matricule, soit une désignation libre TECH ELB / TECH CNS.
const DESIGNATIONS_SPECIALES = ['TECH ELB', 'TECH CNS'];
const cle = (numeroPoste, jour, plage) => `${numeroPoste}|${jour}|${plage}`;
const libellePlage = (plage) => {
  const [debut, fin] = plage.split('-');
  return `De ${debut} à ${fin}`;
};

export default function GrilleSurveillants({ date, onModifie, onSemaine }) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  // cle -> { matricule } OU { designationSpeciale }
  const [selection, setSelection] = useState({});
  const [saisies, setSaisies] = useState({});
  const [modifie, setModifie] = useState(false);
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function appliquer(reponse) {
    setDonnees(reponse);
    setSelection(Object.fromEntries(
      reponse.affectations.map((a) => [
        cle(a.numeroPoste, a.jour, a.plage),
        a.designationSpeciale
          ? { designationSpeciale: a.designationSpeciale }
          : { matricule: a.matricule },
      ])
    ));
    setSaisies({});
    onSemaine(reponse.semaine);
  }

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setErreur('');
    api(`/api/permanences/surveillants?${new URLSearchParams({ date })}`)
      .then((reponse) => { if (!annule) appliquer(reponse); })
      .catch((e) => { if (!annule) setErreur(e.message); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date]);

  function marquerModifie() {
    setModifie(true);
    onModifie(true);
    setMessage('');
  }

  function saisir(k, valeur) {
    setSaisies((precedent) => ({ ...precedent, [k]: valeur }));
    setSelection((precedent) => {
      const suivante = { ...precedent };
      delete suivante[k];
      return suivante;
    });
    marquerModifie();
  }

  function appliquerChoix(k, affectation) {
    setSaisies((precedent) => {
      const suivante = { ...precedent };
      delete suivante[k];
      return suivante;
    });
    setSelection((precedent) => ({ ...precedent, [k]: affectation }));
    marquerModifie();
  }

  function choisirAgent(k, matricule) {
    appliquerChoix(k, matricule ? { matricule } : null);
  }

  function choisirDesignation(k, designationSpeciale) {
    appliquerChoix(k, { designationSpeciale });
  }

  async function enregistrer() {
    setErreur('');
    setDetails([]);
    setMessage('');
    setEnvoi(true);
    try {
      const affectations = Object.entries(selection).map(([k, valeur]) => {
        const [numeroPoste, jour, plage] = k.split('|');
        return {
          numeroPoste: Number(numeroPoste),
          jour,
          plage,
          ...(valeur.matricule ? { matricule: valeur.matricule } : {}),
          ...(valeur.designationSpeciale ? { designationSpeciale: valeur.designationSpeciale } : {}),
        };
      });
      appliquer(await api('/api/permanences/surveillants', {
        methode: 'PUT',
        corps: { date, affectations },
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

  const agentsParMatricule = useMemo(
    () => new Map((donnees?.agents || []).map((agent) => [agent.matricule, agent])),
    [donnees]
  );

  const bloque = (agent, jourDate) =>
    agent.indisponibilites?.find((i) => i.dateDebut <= jourDate && jourDate <= i.dateFin);

  function valeurCellule(k) {
    if (Object.prototype.hasOwnProperty.call(saisies, k)) return saisies[k];
    const affectation = selection[k];
    if (!affectation) return '';
    if (affectation.designationSpeciale) return affectation.designationSpeciale;
    return agentsParMatricule.get(affectation.matricule)?.identifiant || '';
  }

  if (!donnees) {
    return erreur ? <p role="alert" className="alerte erreur">{erreur}</p> : <p>Chargement…</p>;
  }

  return (
    <>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {details.length > 0 && (
        <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>
      )}
      {message && <p role="status" className="alerte succes">{message}</p>}

      <p className="sous-titre aide-designations">
        Saisissez l'identifiant d'un surveillant ou choisissez directement TECH ELB / TECH CNS.
        Ces deux désignations sont enregistrées telles quelles : aucun technicien n'est sélectionné par le système.
      </p>

      {donnees.postes.length === 0 ? (
        <p className="vide">Aucun poste de surveillance : ajoutez-en dans « Référentiels ».</p>
      ) : (
        <div className="defilement">
          <table className="grille-perm surveillants">
            <thead>
              <tr>
                <th>Poste / plage</th>
                {donnees.jours.map((j) => (
                  <th key={j.nom} className="jour">
                    {j.nom}<br /><small>{formaterDateFr(j.date).slice(0, 5)}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donnees.postes.map((poste) => (
                <PosteLignes
                  key={poste.numero_poste}
                  poste={poste}
                  donnees={donnees}
                  selection={selection}
                  valeurCellule={valeurCellule}
                  bloque={bloque}
                  saisir={saisir}
                  choisirAgent={choisirAgent}
                  choisirDesignation={choisirDesignation}
                />
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

function PosteLignes({ poste, donnees, valeurCellule, bloque, saisir, choisirAgent, choisirDesignation }) {
  return (
    <>
      <tr className="bandeau">
        <th colSpan={donnees.jours.length + 1}>{poste.nom_poste}</th>
      </tr>
      {donnees.plages.map((plage) => (
        <tr key={plage}>
          <th scope="row" className="agent">{libellePlage(plage)}</th>
          {donnees.jours.map((j) => {
            const k = cle(poste.numero_poste, j.nom, plage);
            const id = `${poste.nom_poste} ${j.nom} ${plage}`;
            return (
              <td key={j.nom} className="case-select">
                <SaisieIdentifiant
                  id={id}
                  valeur={valeurCellule(k)}
                  agents={donnees.agents}
                  optionsSpeciales={DESIGNATIONS_SPECIALES}
                  indisponibilite={(agent) => bloque(agent, j.date)}
                  onSaisie={(valeur) => saisir(k, valeur)}
                  onChoisir={(matricule) => choisirAgent(k, matricule)}
                  onChoisirSpeciale={(designation) => choisirDesignation(k, designation)}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
