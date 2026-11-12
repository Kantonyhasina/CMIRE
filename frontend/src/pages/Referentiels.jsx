import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

// --- ICÔNES SVG ---
const IconeAjouter = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const IconeModifier = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const IconeSupprimer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

function Section({ titre, singulier, chemin, cle, libelle }) {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const [elements, setElements] = useState([]);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState(null); // null = ajout, sinon = objet de l'élément
  const [valeurSaisie, setValeurSaisie] = useState('');
  const [elementASupprimer, setElementASupprimer] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      setElements(await api(chemin));
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }, [api, chemin]);

  useEffect(() => { charger(); }, [charger]);

  function ouvrirAjout() {
    setEnEdition(null);
    setValeurSaisie('');
    setModalOuvert(true);
  }

  function ouvrirEdition(el) {
    setEnEdition(el);
    setValeurSaisie(el[libelle]);
    setModalOuvert(true);
  }

  function fermerModal() {
    setModalOuvert(false);
    setValeurSaisie('');
    setEnEdition(null);
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    try {
      if (enEdition) {
        await api(`${chemin}/${enEdition[cle]}`, { methode: 'PUT', corps: { nom: valeurSaisie } });
        ajouterToast(`${singulier} modifié(e) avec succès`, 'succes');
      } else {
        await api(chemin, { methode: 'POST', corps: { nom: valeurSaisie } });
        ajouterToast(`${singulier} ajouté(e) avec succès`, 'succes');
      }
      fermerModal();
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  async function confirmerSuppression() {
    if (!elementASupprimer) return;
    try {
      await api(`${chemin}/${elementASupprimer[cle]}`, { methode: 'DELETE' });
      ajouterToast(`« ${elementASupprimer[libelle]} » supprimé(e)`, 'succes');
      setElementASupprimer(null);
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }

  return (
    <div className="colonne-referentiel">
      <ToastsContainer toasts={toasts} />
      
      <section className="carte carte-referentiel">
        <div className="entete-referentiel">
          <h2>{titre}</h2>
          <button type="button" className="btn-primaire btn-petit" onClick={ouvrirAjout} title={`Ajouter un ${singulier}`}>
            <IconeAjouter />
          </button>
        </div>

        <div className="defilement-referentiel">
          <table className="tableau-moderne tableau-referentiel">
            <tbody>
              {elements.map((el) => (
                <tr key={el[cle]}>
                  <td>{el[libelle]}</td>
                  <td className="actions-cellules">
                    <button type="button" className="btn-icone" title="Renommer" onClick={() => ouvrirEdition(el)}>
                      <IconeModifier />
                    </button>
                    <button type="button" className="btn-icone btn-icone-danger" title="Supprimer" onClick={() => setElementASupprimer(el)}>
                      <IconeSupprimer />
                    </button>
                  </td>
                </tr>
              ))}
              {elements.length === 0 && <tr><td colSpan="2" className="vide">Aucun élément</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL AJOUT / MODIFICATION */}
      <Modal 
        estOuvert={modalOuvert} 
        onFermer={fermerModal} 
        titre={enEdition ? `Modifier le ${singulier}` : `Nouveau ${singulier}`}
      >
        <form className="formulaire-login" onSubmit={soumettre}>
          <div className="groupe-champ">
            <label htmlFor="nom-element">Nom du {singulier}</label>
            <div className="champ-avec-icone">
              <input 
                id="nom-element"
                required 
                value={valeurSaisie} 
                onChange={(e) => setValeurSaisie(e.target.value)} 
                placeholder={`Saisir le nom du ${singulier}...`} 
                autoFocus
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button 
              type="submit" 
              className="btn-connexion" 
              disabled={envoi || !valeurSaisie.trim()} // Règle IHM
            >
              {envoi ? 'Enregistrement…' : enEdition ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL SUPPRESSION */}
      <Modal 
        estOuvert={!!elementASupprimer} 
        onFermer={() => setElementASupprimer(null)} 
        titre="Confirmer la suppression"
      >
        <div className="contenu-suppression" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p>Voulez-vous vraiment supprimer <strong>« {elementASupprimer?.[libelle]} »</strong> ?</p>
          <p className="texte-danger" style={{ color: '#b91c1c', fontWeight: 'bold' }}>Cette action est irréversible.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" className="btn-connexion" style={{ background: '#e2e8f0', color: '#1e293b' }} onClick={() => setElementASupprimer(null)}>
            Annuler
          </button>
          <button type="button" className="btn-connexion" style={{ background: '#ef4444' }} onClick={confirmerSuppression}>
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function Referentiels() {
  return (
    <div className="page-referentiels">
      <h1 className="titre-page">Référentiels</h1>
      
      {/* GRILLE 3 COLONNES */}
      <div className="grille-referentiels">
        <Section titre="Unités" singulier="unité" chemin="/api/unites" cle="numero_unite" libelle="nom_unite" />
        <Section titre="Postes" singulier="poste" chemin="/api/postes" cle="numero_poste" libelle="nom_poste" />
        <Section titre="Stations" singulier="station" chemin="/api/stations" cle="numero_station" libelle="nom_station" />
      </div>
    </div>
  );
}