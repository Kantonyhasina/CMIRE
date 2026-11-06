import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr } from '../utils/dates.js';
import SaisieIdentifiant from '../components/SaisieIdentifiant.jsx';

// Un seul surveillant par poste, jour et plage ; le même surveillant peut
// tenir deux postes à la même plage. L'API reçoit toujours le matricule.
const cle = (numeroPoste, jour, plage) => `${numeroPoste}|${jour}|${plage}`;
const libellePlage = (plage) => {
  const [debut, fin] = plage.split('-');
  return `De ${debut} à ${fin}`;
};

const CATEGORIES = [
  { code: 'ELB', libelle: 'TECH ELB' },
  { code: 'CNS', libelle: 'TECH CNS' },
];

function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase();
}

function appartientCategorie(agent, code) {
  // Les groupes TECH ELB et TECH CNS sont déterminés à partir du libellé
  // de l'unité de rattachement du personnel.
  return normaliser(agent.nomUnite).includes(code);
}

export default function GrilleSurveillants({ date, onModifie, onSemaine }) {
  const { api } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [selection, setSelection] = useState({}); // cle -> matricule
  const [saisies, setSaisies] = useState({}); // cle -> texte temporaire saisi
  const [categorie, setCategorie] = useState('ELB');
  const [modifie, setModifie] = useState(false);
  const [erreur, setErreur] = useState('');
  const [details, setDetails] = useState([]);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function appliquer(reponse) {
    setDonnees(reponse);
    setSelection(Object.fromEntries(
      reponse.affectations.map((a) => [cle(a.numeroPoste, a.jour, a.plage), a.matricule])
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

  function choisir(k, matricule) {
    setSaisies((precedent) => {
      const suivante = { ...precedent };
      delete suivante[k];
      return suivante;
    });
    setSelection((precedent) => {
      const suivante = { ...precedent };
      if (matricule) suivante[k] = matricule;
      else delete suivante[k];
      return suivante;
    });
    marquerModifie();
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

  const agentsCategorie = useMemo(
    () => (donnees?.agents || []).filter((agent) => appartientCategorie(agent, categorie)),
    [donnees, categorie]
  );

  const agentsParMatricule = useMemo(
    () => new Map((donnees?.agents || []).map((agent) => [agent.matricule, agent])),
    [donnees]
  );

  const bloque = (agent, jourDate) =>
    agent.indisponibilites?.find((i) => i.dateDebut <= jourDate && jourDate <= i.dateFin);

  function valeurCellule(k) {
    if (Object.prototype.hasOwnProperty.call(saisies, k)) return saisies[k];
    const matricule = selection[k];
    return matricule ? (agentsParMatricule.get(matricule)?.identifiant || '') : '';
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

      <div className="choix-categorie-surveillance" role="group" aria-label="Catégorie de surveillance">
        {CATEGORIES.map((item) => {
          const nombre = donnees.agents.filter((agent) => appartientCategorie(agent, item.code)).length;
          return (
            <button
              key={item.code}
              type="button"
              className={categorie === item.code ? '' : 'secondaire'}
              aria-pressed={categorie === item.code}
              onClick={() => setCategorie(item.code)}
            >
              {item.libelle} <span className="compteur-agents">({nombre})</span>
            </button>
          );
        })}
      </div>

      {agentsCategorie.length === 0 && (
        <p className="alerte attention">
          Aucun personnel ayant la fonction « Surveillant » n'est rattaché à l'unité {categorie}.
          Vérifie l'unité attribuée à ces personnels dans la gestion des comptes.
        </p>
      )}

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
                  agentsCategorie={agentsCategorie}
                  bloque={bloque}
                  saisir={saisir}
                  choisir={choisir}
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

function PosteLignes({
  poste,
  donnees,
  selection,
  valeurCellule,
  agentsCategorie,
  bloque,
  saisir,
  choisir,
}) {
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
            const agentsDisponibles = agentsCategorie;
            const id = `${poste.nom_poste} ${j.nom} ${plage}`;
            return (
              <td key={j.nom} className="case-select">
                <SaisieIdentifiant
                  id={id}
                  valeur={valeurCellule(k)}
                  agents={agentsDisponibles}
                  indisponibilite={(agent) => bloque(agent, j.date)}
                  onSaisie={(valeur) => saisir(k, valeur)}
                  onChoisir={(matricule) => choisir(k, matricule)}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
