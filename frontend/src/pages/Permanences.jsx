import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { ajouterJours, formaterDateFr, lundiDe, semaineCourante } from '../utils/dates.js';
import GrilleCadres from './GrilleCadres.jsx';
import GrilleSurveillants from './GrilleSurveillants.jsx';

// Boundary : planification des permanences (cadres et surveillants) et export du tableau en PDF
export default function Permanences() {
  const { api, telecharger, utilisateur } = useAuth();
  const estChef = utilisateur.fonction === ROLES.CHEF; // RG8 : un chef reste sur son unité

  const [onglet, setOnglet] = useState('cadres');
  const [date, setDate] = useState(() => semaineCourante()[0]);
  const [unites, setUnites] = useState([]);
  const [numeroUnite, setNumeroUnite] = useState(String(utilisateur.numeroUnite));
  const [semaine, setSemaine] = useState(null);
  const [modifie, setModifie] = useState(false);
  const [erreur, setErreur] = useState('');
  const [export_, setExport] = useState(false);

  useEffect(() => {
    api('/api/unites').then(setUnites).catch((e) => setErreur(e.message));
  }, [api]);

  // Évite de perdre une saisie non enregistrée
  function confirmerAbandon() {
    if (!modifie) return true;
    if (!window.confirm('Des modifications ne sont pas enregistrées. Continuer sans les enregistrer ?')) return false;
    setModifie(false);
    return true;
  }

  const allerA = (nouvelleDate) => { if (confirmerAbandon()) setDate(lundiDe(nouvelleDate)); };
  const changerOnglet = (nom) => { if (nom !== onglet && confirmerAbandon()) setOnglet(nom); };
  const changerUnite = (valeur) => { if (confirmerAbandon()) setNumeroUnite(valeur); };

  async function exporter() {
    setErreur('');
    setExport(true);
    try {
      const fichier = await telecharger(`/api/permanences/export?${new URLSearchParams({ date })}`);
      const adresse = URL.createObjectURL(fichier);
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = `tableau-permanence-S${semaine.numeroIso}-${semaine.annee}.xlsx`;
      document.body.appendChild(lien); // nécessaire pour certains navigateurs (Firefox)
      lien.click();
      lien.remove();
      URL.revokeObjectURL(adresse);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setExport(false);
    }
  }

  return (
    <>
      <section className="carte">
        <h1>Permanences</h1>
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

        <div className="grille">
          <div>
            <label htmlFor="semaineDu">Aller à la semaine du</label>
            <input id="semaineDu" type="date" value={date}
                   onChange={(e) => e.target.value && allerA(e.target.value)} />
          </div>
          <div className="action">
            <button type="button" className="secondaire" onClick={exporter}
                    disabled={export_ || modifie || !semaine}
                    title={modifie ? 'Enregistrez le planning avant de l’exporter' : undefined}>
              {export_ ? 'Génération…' : 'Exporter le tableau (Excel)'}
            </button>
          </div>
        </div>

        <div className="onglets" role="tablist">
          <button type="button" role="tab" aria-selected={onglet === 'cadres'}
                  onClick={() => changerOnglet('cadres')}>Cadres de maintenance</button>
          <button type="button" role="tab" aria-selected={onglet === 'surveillants'}
                  onClick={() => changerOnglet('surveillants')}>Surveillants</button>
        </div>

        {onglet === 'cadres' && (
          <div className="grille unite-choix">
            <div>
              <label htmlFor="unite">Unité</label>
              <select id="unite" value={numeroUnite} disabled={estChef}
                      onChange={(e) => changerUnite(e.target.value)}>
                {unites.map((u) => <option key={u.numero_unite} value={u.numero_unite}>{u.nom_unite}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="carte">
        {onglet === 'cadres'
          ? <GrilleCadres key={`${date}-${numeroUnite}`} date={date} numeroUnite={numeroUnite}
                          onModifie={setModifie} onSemaine={setSemaine} />
          : <GrilleSurveillants key={date} date={date} onModifie={setModifie} onSemaine={setSemaine} />}
      </section>
    </>
  );
}
