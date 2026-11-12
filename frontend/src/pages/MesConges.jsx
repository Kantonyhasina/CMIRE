import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterPeriode } from '../utils/dates.js';
import Modal from '../components/Modal.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

// --- ICÔNES SVG ---
const IconeAjouter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ELEMENTS_PAR_PAGE = 5;

export default function MesConges() {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();

  const [types, setTypes] = useState([]);
  const [demandes, setDemandes] = useState([]);
  
  const [modalOuvert, setModalOuvert] = useState(false);
  const [type, setType] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [alertes, setAlertes] = useState([]);

  const [filtre, setFiltre] = useState('Tous');
  const [pageActuelle, setPageActuelle] = useState(1);

  const charger = useCallback(async () => {
    try {
      const reponse = await api('/api/conges/mes-demandes');
      setTypes(reponse.types);
      setDemandes(reponse.demandes);
      setType((actuel) => actuel || reponse.types[0] || '');
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }, [api]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setPageActuelle(1); }, [filtre, demandes.length]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setAlertes([]);
    setEnvoi(true);
    try {
      const reponse = await api('/api/conges', { methode: 'POST', corps: { type, dateDebut, dateFin } });
      ajouterToast('Demande envoyée à votre chef de service', 'succes');
      
      if (reponse.alertes?.length > 0) {
        setAlertes(reponse.alertes);
      } else {
        fermerModal();
      }
      
      setDateDebut('');
      setDateFin('');
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  function fermerModal() {
    setModalOuvert(false);
    setAlertes([]);
  }

  const demandesFiltrees = useMemo(() => {
    if (filtre === 'Tous') return demandes;
    return demandes.filter(d => d.statut === filtre);
  }, [demandes, filtre]);

  const indexDernier = pageActuelle * ELEMENTS_PAR_PAGE;
  const indexPremier = indexDernier - ELEMENTS_PAR_PAGE;
  const demandesPagines = demandesFiltrees.slice(indexPremier, indexDernier);
  const nombreTotalPages = Math.ceil(demandesFiltrees.length / ELEMENTS_PAR_PAGE);

  const estValide = type !== '' && dateDebut !== '' && dateFin !== '';

  return (
    <>
      <ToastsContainer toasts={toasts} />

      {/* EN-TÊTE : TITRE ET BOUTON CÔTE À CÔTE ET CENTRÉS */}
      <div className="entete-centre-flex">
        <h1 className="titre-page" style={{ margin: 0 }}>Mes congés</h1>
        <button type="button" className="btn-primaire" onClick={() => setModalOuvert(true)}>
          <IconeAjouter /> Nouvelle demande
        </button>
      </div>

      <section className="carte">
        <div className="onglets" role="tablist" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          {['Tous', 'En attente', 'Validé', 'Refusé'].map((statut) => (
            <button 
              key={statut} 
              type="button" 
              role="tab" 
              aria-selected={filtre === statut} 
              onClick={() => setFiltre(statut)}
              className={filtre === statut ? 'onglet-actif' : ''}
            >
              {statut}
            </button>
          ))}
        </div>

        <div className="defilement">
          <table className="tableau-moderne">
            <thead>
              <tr>
                <th>Période</th>
                <th>Type</th>
                <th>Statut</th>
                {/* Colonne Actions supprimée */}
              </tr>
            </thead>
            <tbody>
              {demandesPagines.map((d) => (
                <tr key={d.id}>
                  <td className="font-bold">
                    {d.statut === 'En pause' && !d.dateDebut && !d.dateFin 
                      ? 'Sans durée connue — EN PAUSE' 
                      : formaterPeriode(d.dateDebut, d.dateFin)}
                  </td>
                  <td>{d.type}</td>
                  <td>
                    <span className={`badge-statut ${d.statut === 'Validé' ? 'valide' : d.statut === 'Refusé' ? 'refuse' : 'attente'}`}>
                      {d.statut}
                    </span>
                  </td>
                </tr>
              ))}
              {demandesPagines.length === 0 && (
                <tr><td colSpan="3" className="vide">Aucune demande dans cette catégorie</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {nombreTotalPages > 1 && (
          <div className="pagination-moderne">
            <span className="pagination-info">
              Affichage de {indexPremier + 1} à {Math.min(indexDernier, demandesFiltrees.length)} sur {demandesFiltrees.length}
            </span>
            <div className="pagination-boutons">
              <button type="button" disabled={pageActuelle === 1} onClick={() => setPageActuelle(pageActuelle - 1)}>&lt;</button>
              {[...Array(nombreTotalPages)].map((_, i) => (
                <button 
                  key={i} 
                  type="button"
                  className={pageActuelle === i + 1 ? 'actif' : ''}
                  onClick={() => setPageActuelle(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" disabled={pageActuelle === nombreTotalPages} onClick={() => setPageActuelle(pageActuelle + 1)}>&gt;</button>
            </div>
          </div>
        )}
      </section>

      <Modal estOuvert={modalOuvert} onFermer={fermerModal} titre="Demander un congé">
        {alertes.length > 0 && (
          <div className="alerte attention" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            <p style={{ marginTop: 0, fontWeight: 'bold' }}>Attention :</p>
            <p>Vous avez déjà du travail planifié sur cette période (votre chef de service en est informé) :</p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{alertes.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}

        <form className="formulaire-login" onSubmit={soumettre}>
          <div className="grille-formulaire">
            <div className="groupe-champ pleine-largeur">
              <label htmlFor="type">Type de congé</label>
              <div className="champ-avec-icone">
                <select id="type" required value={type} onChange={(e) => setType(e.target.value)} className="select-ligne">
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="groupe-champ">
              <label htmlFor="dateDebut">Du</label>
              <div className="champ-avec-icone">
                <input id="dateDebut" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
              </div>
            </div>

            <div className="groupe-champ">
              <label htmlFor="dateFin">Au</label>
              <div className="champ-avec-icone">
                <input id="dateFin" type="date" required value={dateFin} min={dateDebut || undefined} onChange={(e) => setDateFin(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn-connexion" disabled={envoi || !estValide}>
              {envoi ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}