import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr } from '../utils/dates.js';
import SaisieIdentifiant from '../components/SaisieIdentifiant.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

const DESIGNATIONS_SPECIALES = ['TECH ELB', 'TECH CNS'];
const cle = (numeroPoste, jour, plage) => `${numeroPoste}|${jour}|${plage}`;
const libellePlage = (plage) => {
  const [debut, fin] = plage.split('-');
  return `De ${debut} à ${fin}`;
};

export default function GrilleSurveillants({ date, onModifie,lectureSeule = false, onSemaine }) {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState({});
  const [saisies, setSaisies] = useState({});
  const [modifie, setModifie] = useState(false);
  const [details, setDetails] = useState([]);
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
    api(`/api/permanences/surveillants?${new URLSearchParams({ date })}`)
      .then((reponse) => { if (!annule) appliquer(reponse); })
      .catch((e) => { if (!annule) ajouterToast(e.message, 'erreur'); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date]);

  function marquerModifie() {
    setModifie(true);
    onModifie(true);
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
    setDetails([]);
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
      ajouterToast('Planning enregistré avec succès', 'succes');
    } catch (e) {
      ajouterToast(e.message, 'erreur');
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
    return <p>Chargement…</p>;
  }

  return (
    <>
      <ToastsContainer toasts={toasts} />

      {details.length > 0 && (
        <ul className="alerte erreur details">{details.map((d) => <li key={d}>{d}</li>)}</ul>
      )}

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
                  lectureSeule={lectureSeule}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="barre-actions">
        <span className="sous-titre">{Object.keys(selection).length} créneau(x) pourvu(s)</span>
        {!lectureSeule && (
  <button type="button" onClick={enregistrer} disabled={envoi || !modifie}>
    {envoi ? 'Enregistrement…' : 'Enregistrer le planning'}
  </button>
)}
      </div>
    </>
  );
}

function PosteLignes({ poste, donnees, valeurCellule, bloque, saisir, choisirAgent, choisirDesignation, lectureSeule = false }) {
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
                  desactive={lectureSeule}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}