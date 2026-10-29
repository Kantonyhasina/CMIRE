import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

// Boundary : FormUnite / FormStation (cas « Gérer les unités et postes », « Gérer les stations VSAT/VHF »)
function Section({ titre, singulier, chemin, cle, libelle }) {
  const { api } = useAuth();
  const [elements, setElements] = useState([]);
  const [nouveau, setNouveau] = useState('');
  const [edition, setEdition] = useState(null); // { id, valeur }
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      setElements(await api(chemin));
    } catch (e) {
      setErreur(e.message);
    }
  }, [api, chemin]);

  useEffect(() => { charger(); }, [charger]);

  async function executer(action) {
    setErreur('');
    try {
      await action();
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  const ajouter = (evenement) => {
    evenement.preventDefault();
    executer(async () => {
      await api(chemin, { methode: 'POST', corps: { nom: nouveau } });
      setNouveau('');
    });
  };

  const enregistrer = () =>
    executer(async () => {
      await api(`${chemin}/${edition.id}`, { methode: 'PUT', corps: { nom: edition.valeur } });
      setEdition(null);
    });

  const supprimer = (element) => {
    if (!window.confirm(`Supprimer « ${element[libelle]} » ?`)) return;
    executer(() => api(`${chemin}/${element[cle]}`, { methode: 'DELETE' }));
  };

  return (
    <section className="carte">
      <h2>{titre}</h2>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}

      <form className="ligne" onSubmit={ajouter}>
        <input aria-label={`Nom du nouvel élément (${singulier})`} placeholder={`Nouveau : ${singulier}`}
               value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        <button type="submit" disabled={!nouveau.trim()}>Ajouter</button>
      </form>

      <table>
        <tbody>
          {elements.map((el) => (
            <tr key={el[cle]}>
              <td>
                {edition?.id === el[cle] ? (
                  <input aria-label={`Nouveau nom pour ${el[libelle]}`} value={edition.valeur}
                         onChange={(e) => setEdition({ ...edition, valeur: e.target.value })} />
                ) : el[libelle]}
              </td>
              <td className="actions">
                {edition?.id === el[cle] ? (
                  <>
                    <button type="button" onClick={enregistrer}>Enregistrer</button>
                    <button type="button" className="secondaire" onClick={() => setEdition(null)}>Annuler</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="secondaire"
                            onClick={() => setEdition({ id: el[cle], valeur: el[libelle] })}>Renommer</button>
                    <button type="button" className="danger" onClick={() => supprimer(el)}>Supprimer</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {elements.length === 0 && <tr><td className="vide">Aucun élément</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

export default function Referentiels() {
  return (
    <>
      <h1 className="titre-page">Référentiels</h1>
      <Section titre="Unités" singulier="unité" chemin="/api/unites" cle="numero_unite" libelle="nom_unite" />
      <Section titre="Postes de surveillance" singulier="poste" chemin="/api/postes" cle="numero_poste" libelle="nom_poste" />
      <Section titre="Stations VSAT/VHF" singulier="station" chemin="/api/stations" cle="numero_station" libelle="nom_station" />
    </>
  );
}
