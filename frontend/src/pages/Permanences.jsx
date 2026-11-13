import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { ajouterJours, formaterDateFr, lundiDe, semaineCourante } from '../utils/dates.js';
import GrilleCadres from './GrilleCadres.jsx';
import GrilleSurveillants from './GrilleSurveillants.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

export default function Permanences() {
  const { api, telecharger, utilisateur } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const estChef = utilisateur?.fonction === ROLES.CHEF;

  const [onglet, setOnglet] = useState('cadres');
  const [date, setDate] = useState(() => semaineCourante()[0]);
  const [unites, setUnites] = useState([]);
  const [numeroUnite, setNumeroUnite] = useState(String(utilisateur?.numeroUnite ?? ''));
  const [semaine, setSemaine] = useState(null);
  const [modifie, setModifie] = useState(false);
  const [export_, setExport] = useState(false);

  const lectureSeule = !estChef || Number(numeroUnite) !== Number(utilisateur?.numeroUnite);

  useEffect(() => {
    let annule = false;
    api('/api/unites')
      .then((resultat) => {
        if (!annule) setUnites(resultat);
      })
      .catch((e) => {
        if (!annule) ajouterToast(e.message, 'erreur');
      });
    return () => { annule = true; };
  }, [api]);

  function confirmerAbandon() {
    if (!modifie) return true;
    if (!window.confirm('Des modifications ne sont pas enregistrées. Continuer sans les enregistrer ?')) {
      return false;
    }
    setModifie(false);
    return true;
  }

  const allerA = (nouvelleDate) => {
    if (confirmerAbandon()) setDate(lundiDe(nouvelleDate));
  };

  const changerOnglet = (nom) => {
    if (nom !== onglet && confirmerAbandon()) setOnglet(nom);
  };

  const changerUnite = (valeur) => {
    if (valeur !== numeroUnite && confirmerAbandon()) {
      setNumeroUnite(valeur);
      setSemaine(null);
    }
  };

  async function exporter() {
    setExport(true);
    try {
      const fichier = await telecharger(`/api/permanences/export?${new URLSearchParams({ date })}`);
      const adresse = URL.createObjectURL(fichier);
      const lien = document.createElement('a');
      lien.href = adresse;
      lien.download = `tableau-permanence-S${semaine.numeroIso}-${semaine.annee}.xlsx`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(adresse);
      ajouterToast('Exportation Excel réussie', 'succes');
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setExport(false);
    }
  }

  const anneeAffichee = semaine?.annee || new Date().getFullYear();
  const optionsAnnees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const changerAnnee = (e) => {
    const anneeChoisie = Number(e.target.value);
    const differenceAnnees = anneeChoisie - anneeAffichee;
    allerA(ajouterJours(date, differenceAnnees * 364));
  };

  return (
    <>
      <ToastsContainer toasts={toasts} />

      <section className="carte">
        {/* TITRE CENTRÉ */}
        <h1 className="titre-centre-planning" style={{ marginBottom: '1.5rem' }}>Permanences</h1>

        {/* NAVIGATION SEMAINE */}
        <div className="barre-navigation-planning">
          <button type="button" className="btn-fleche" onClick={() => allerA(ajouterJours(date, -7))}>◀</button>
          
          <div className="centre-planning">
            <div className="conteneur-titre-semaine">
              {semaine ? (
                <>
                  <strong className="ligne-semaine">Semaine {semaine.numeroIso}</strong>
                  <span className="ligne-dates">du {formaterDateFr(semaine.dateDebut)} au {formaterDateFr(semaine.dateFin)}</span>
                </>
              ) : (
                <strong>Chargement…</strong>
              )}
            </div>
            <select className="select-annee-planning" value={anneeAffichee} onChange={changerAnnee}>
              {optionsAnnees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          
          <button type="button" className="btn-fleche" onClick={() => allerA(ajouterJours(date, 7))}>▶</button>
        </div>

        {/* SÉLECTION DATE LIBRE */}
        <div className="barre-actions-planning" style={{ justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <label htmlFor="semaineDu" style={{ display: 'inline-block', marginRight: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Aller à la semaine du</label>
            <input
              id="semaineDu"
              type="date"
              value={date}
              onChange={(e) => e.target.value && allerA(e.target.value)}
              style={{ width: 'auto', display: 'inline-block' }}
            />
          </div>
        </div>

                {/* ONGLETS ET SÉLECTEUR D'UNITÉ + BOUTON EXPORT */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
          <div className="onglets" role="tablist" style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>
            <button
              type="button"
              role="tab"
              aria-selected={onglet === 'cadres'}
              onClick={() => changerOnglet('cadres')}
            >
              Cadres de maintenance
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={onglet === 'surveillants'}
              onClick={() => changerOnglet('surveillants')}
            >
              Surveillants
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {onglet === 'cadres' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="unite" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Unité :</label>
                <select
                  id="unite"
                  value={numeroUnite}
                  onChange={(e) => changerUnite(e.target.value)}
                  className="select-annee-planning"
                  style={{ width: 'auto', minWidth: '150px' }}
                >
                  {unites.map((u) => (
                    <option key={u.numero_unite} value={u.numero_unite}>
                      {u.nom_unite}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* BOUTON EXPORT : UNIQUEMENT POUR LE CHEF DE SERVICE */}
            {estChef && (
              <button
                type="button"
                className="btn-secondaire"
                onClick={exporter}
                disabled={export_ || modifie || !semaine}
                title={modifie ? 'Enregistrez le planning avant de l’exporter' : undefined}
              >
                {export_ ? 'Génération…' : 'Exporter Excel'}
              </button>
            )}
          </div>
        </div>

        {lectureSeule && (
          <p className="information" role="status" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#b45309', background: '#fef3c7', padding: '0.5rem', borderRadius: '6px' }}>
            Consultation uniquement : vous pouvez consulter le planning de cette unité, mais vous ne pouvez modifier que celui de votre propre unité.
          </p>
        )}
      </section>

      <section className="carte">
        {onglet === 'cadres'
          ? (
            <GrilleCadres
              key={`${date}-${numeroUnite}`}
              date={date}
              numeroUnite={numeroUnite}
              lectureSeule={lectureSeule}
              onModifie={setModifie}
              onSemaine={setSemaine}
            />
          )
          : (
            <GrilleSurveillants
              key={date}
              date={date}
              lectureSeule={lectureSeule}
              onModifie={setModifie}
              onSemaine={setSemaine}
            />
          )}
      </section>
    </>
  );
}