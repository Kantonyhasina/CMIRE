import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr, formaterPeriode } from '../utils/dates.js';
import { EVENEMENT_CONGES } from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';
import SaisieIdentifiant from '../components/SaisieIdentifiant.jsx';

const AUJOURDHUI = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const periode = (c) => c.dateDebut && c.dateFin
  ? formaterPeriode(c.dateDebut, c.dateFin)
  : c.dateReprise ? `Pause sans durée connue — reprise le ${formaterDateFr(c.dateReprise)}`
    : 'Sans date de début ni de fin — jusqu’à la reprise';

const ELEMENTS_PAR_PAGE = 5;

const IconeAjouter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const IconeLoupe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export default function DemandesConges() {
  const { api } = useAuth();
  const { toasts, ajouterToast } = useToasts();

  const [onglet, setOnglet] = useState('En attente');
  const [conges, setConges] = useState([]);
  const [personnels, setPersonnels] = useState([]);
  const [chargement, setChargement] = useState(true);

  // Modal d'ajout
  const [modalOuvert, setModalOuvert] = useState(false);
  const [matriculeSaisi, setMatriculeSaisi] = useState('');
  const [saisieIdentifiant, setSaisieIdentifiant] = useState('');
  const [type, setType] = useState('Annuel');
  const [sansDuree, setSansDuree] = useState(false);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [alertes, setAlertes] = useState([]);

  // Gestion des dates de reprise
  const [datesReprise, setDatesReprise] = useState({});

  // Recherche et pagination
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [termeRecherche, setTermeRecherche] = useState('');
  const [pageActuelle, setPageActuelle] = useState(1);

  const chargerPersonnels = useCallback(async () => {
    try {
      const liste = await api('/api/conges/personnels-unite');
      setPersonnels(liste);
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }, [api]);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setConges(await api(`/api/conges/unite?${new URLSearchParams({ statut: onglet })}`));
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setChargement(false);
    }
  }, [api, onglet]);

  useEffect(() => { chargerPersonnels(); }, [chargerPersonnels]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setPageActuelle(1); }, [onglet, termeRecherche, conges.length]);

  // Filtrer les congés par recherche
  const congesFiltres = useMemo(() => {
    if (!termeRecherche.trim()) return conges;
    const terme = termeRecherche.toLowerCase().trim();
    return conges.filter(c => 
      (c.identifiant && c.identifiant.toLowerCase().includes(terme)) ||
      c.prenom.toLowerCase().includes(terme) ||
      c.nom.toLowerCase().includes(terme) ||
      c.type.toLowerCase().includes(terme)
    );
  }, [conges, termeRecherche]);

  // Pagination
  const indexDernier = pageActuelle * ELEMENTS_PAR_PAGE;
  const indexPremier = indexDernier - ELEMENTS_PAR_PAGE;
  const congesPagines = congesFiltres.slice(indexPremier, indexDernier);
  const nombreTotalPages = Math.ceil(congesFiltres.length / ELEMENTS_PAR_PAGE);

  const apresModification = async () => {
    window.dispatchEvent(new Event(EVENEMENT_CONGES));
    await charger();
  };

  function ouvrirModal() {
    setMatriculeSaisi('');
    setSaisieIdentifiant('');
    setType('Annuel');
    setSansDuree(false);
    setDateDebut('');
    setDateFin('');
    setAlertes([]);
    setModalOuvert(true);
  }

  async function creerDirectement(e) {
    e.preventDefault();
    setAlertes([]);
    setEnvoi(true);
    try {
      const corps = { matricule: matriculeSaisi, type, sansDureeConnue: sansDuree };
      if (!sansDuree) { corps.dateDebut = dateDebut; corps.dateFin = dateFin; }
      
      const resultat = await api('/api/conges/unite/direct', { methode: 'POST', corps });
      
      ajouterToast(sansDuree
        ? ` ${type} enregistré : le personnel est maintenant EN PAUSE.`
        : `Congé de ${resultat.conge.prenom} ${resultat.conge.nom} enregistré.`, 'succes');
      
      if (resultat.alertes?.length > 0) {
        setAlertes(resultat.alertes); // On affiche les alertes dans le modal
      } else {
        setModalOuvert(false); // On ferme si pas d'alerte
      }
      
      setOnglet(resultat.conge.statut === 'En pause' ? 'En pause' : 'Validé');
      window.dispatchEvent(new Event(EVENEMENT_CONGES));
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  async function decider(conge, decision, confirmer = false) {
    try {
      await api(`/api/conges/${conge.id}/decision`, {
        methode: 'PUT', corps: confirmer ? { decision, confirmer: true } : { decision },
      });
      ajouterToast(`Demande de ${conge.prenom} ${conge.nom} : ${decision === 'Validé' ? 'validée' : 'refusée'}.`, 'succes');
      await apresModification();
    } catch (e) {
      if (e.code === 'CONFIRMATION_REQUISE') {
        const detail = (e.details || []).map((d) => `• ${d}`).join('\n');
        if (window.confirm(`${e.message}\n\n${detail}\n\nValider quand même ce congé ?`)) await decider(conge, decision, true);
      } else {
        ajouterToast(e.message, 'erreur');
      }
    }
  }

  async function reprendre(conge) {
    const dateReprise = datesReprise[conge.id] || AUJOURDHUI();
    if (!window.confirm(`Confirmer la reprise de ${conge.prenom} ${conge.nom} à partir du ${formaterDateFr(dateReprise)} ?`)) return;
    try {
      await api(`/api/conges/${conge.id}/reprise`, { methode: 'PUT', corps: { dateReprise } });
      ajouterToast(`Reprise de ${conge.prenom} ${conge.nom} enregistrée.`, 'succes');
      setOnglet('Repris');
      window.dispatchEvent(new Event(EVENEMENT_CONGES));
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }

  async function annuler(conge) {
    if (!window.confirm(`Annuler le congé de ${conge.prenom} ${conge.nom} (${periode(conge)}) ?`)) return;
    try {
      await api(`/api/conges/${conge.id}`, { methode: 'DELETE' });
      ajouterToast('Congé annulé.', 'info');
      await apresModification();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }

  const estAttente = onglet === 'En attente';
  const estPause = onglet === 'En pause';
  const titres = useMemo(() => [
    ['En attente', 'À traiter'], ['Validé', 'Validés'], ['En pause', 'En pause'], ['Repris', 'Historique'],
  ], []);

  // Règle IHM pour le bouton du modal
  const estValide = matriculeSaisi !== '' && type !== '' && (sansDuree || (dateDebut !== '' && dateFin !== ''));

  return (
    <>
      <ToastsContainer toasts={toasts} />

      {/* EN-TÊTE : TITRE ET BOUTON */}
      <div className="entete-centre-flex">
        <h1 className="titre-page" style={{ margin: 0 }}>Gestion des congés</h1>
        <button type="button" className="btn-primaire" onClick={ouvrirModal}>
          <IconeAjouter /> Enregistrer un congé ou une pause
        </button>
      </div>

            {/* TABLEAU ET RECHERCHE */}
      <section className="carte">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          
          {/* ONGLETS (prement toute la place disponible) */}
          <div className="onglets" role="tablist" style={{ borderBottom: 'none', margin: 0, paddingBottom: 0, display: 'flex' }}>
            {titres.map(([valeur, libelle]) => (
              <button 
                key={valeur} 
                type="button" 
                role="tab" 
                aria-selected={onglet === valeur} 
                onClick={() => setOnglet(valeur)}
              >
                {libelle}
              </button>
            ))}
          </div>

          {/* RECHERCHE (calée à droite, juste après le dernier onglet) */}
          <div className={`barre-recherche ${rechercheOuverte ? 'ouverte' : ''}`} style={{ marginLeft: 'auto' }}>
            {!rechercheOuverte ? (
              <button type="button" className="btn-icone-search" onClick={() => setRechercheOuverte(true)} title="Rechercher">
                <IconeLoupe />
              </button>
            ) : (
              <div className="champ-recherche-actif">
                <input type="text" placeholder="Nom, prénom, identifiant..." value={termeRecherche} onChange={(e) => setTermeRecherche(e.target.value)} autoFocus />
                <button type="button" className="btn-effacer-recherche" onClick={() => { setTermeRecherche(''); setRechercheOuverte(false); }}>✕</button>
              </div>
            )}
          </div>
        </div>
        <div className="defilement">
          <table className="tableau-moderne">
            <thead>
              <tr>
                <th>Personnel</th><th>Période / statut</th><th>Motif</th>
                {estAttente && <th>Planning</th>}
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {congesPagines.map((c) => (
                <tr key={c.id} className={estPause ? 'ligne-pause' : ''}>
                  <td className="font-bold">
                    {c.identifiant && <div>{c.identifiant}</div>}
                    <div className="text-small" style={{ fontWeight: 'normal' }}>{c.prenom} {c.nom}</div>
                  </td>
                  <td>
                    {periode(c)}
                    {estPause && <div className="badge-statut attente" style={{ display: 'inline-block', marginTop: '4px' }}>EN PAUSE</div>}
                  </td>
                  <td>{c.type}</td>
                  {estAttente && (
                    <td>
                      {!c.conflits?.length ? '—' : (
                        <ul className="conflits" style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                          {c.conflits.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}
                        </ul>
                      )}
                    </td>
                  )}
                  <td className="actions-cellules">
                    {estAttente && (
                      <>
                        <button type="button" className="btn-icone btn-icone-success" title="Valider" onClick={() => decider(c, 'Validé')}>✓</button>
                        <button type="button" className="btn-icone btn-icone-danger" title="Refuser" onClick={() => decider(c, 'Refusé')}>✕</button>
                      </>
                    )}
                    {estPause && (
                      <button type="button" className="btn-primaire btn-petit" onClick={() => reprendre(c)}>Reprise</button>
                    )}
                    {onglet === 'Validé' && (
                      <button type="button" className="btn-secondaire btn-petit" onClick={() => annuler(c)}>Annuler</button>
                    )}
                    {onglet === 'Repris' && <span className="text-small">{c.dateReprise ? formaterDateFr(c.dateReprise) : '—'}</span>}
                  </td>
                </tr>
              ))}
              {!chargement && congesPagines.length === 0 && (
                <tr><td colSpan={estAttente ? 5 : 4} className="vide">Aucune demande dans cette catégorie</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {nombreTotalPages > 1 && (
          <div className="pagination-moderne">
            <span className="pagination-info">
              Affichage de {indexPremier + 1} à {Math.min(indexDernier, congesFiltres.length)} sur {congesFiltres.length}
            </span>
            <div className="pagination-boutons">
              <button type="button" disabled={pageActuelle === 1} onClick={() => setPageActuelle(pageActuelle - 1)}>&lt;</button>
              {[...Array(nombreTotalPages)].map((_, i) => (
                <button key={i} type="button" className={pageActuelle === i + 1 ? 'actif' : ''} onClick={() => setPageActuelle(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" disabled={pageActuelle === nombreTotalPages} onClick={() => setPageActuelle(pageActuelle + 1)}>&gt;</button>
            </div>
          </div>
        )}
      </section>

      {/* ========================================= */}
      {/* MODAL D'AJOUT AVEC SAISIE DYNAMIQUE */}
      {/* ========================================= */}
      <Modal estOuvert={modalOuvert} onFermer={() => setModalOuvert(false)} titre="Enregistrer un congé ou une pause">
        {alertes.length > 0 && (
          <div className="alerte attention" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            <p style={{ marginTop: 0, fontWeight: 'bold' }}>Attention :</p>
            <p>Ce personnel possède déjà des affectations planifiées :</p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{alertes.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}

        <form className="formulaire-login" onSubmit={creerDirectement}>
          <div className="grille-formulaire">
            
            {/* SAISIE DYNAMIQUE DU PERSONNEL */}
            <div className="groupe-champ pleine-largeur">
              <label>Personnel concerné</label>
              <div className="champ-avec-icone">
                <SaisieIdentifiant
                  id="personnelConge"
                  valeur={saisieIdentifiant}
                  agents={personnels}
                  onSaisie={(valeur) => {
                    setSaisieIdentifiant(valeur);
                    setMatriculeSaisi(''); // On réinitialise la sélection tant qu'on n'a pas choisi
                  }}
                  onChoisir={(matricule) => {
                    const agent = personnels.find(p => p.matricule === matricule);
                    setMatriculeSaisi(matricule);
                    setSaisieIdentifiant(agent?.identifiant || '');
                  }}
                />
              </div>
            </div>

            <div className="groupe-champ">
              <label htmlFor="typeConge">Motif</label>
              <div className="champ-avec-icone">
                <select id="typeConge" value={type} onChange={(e) => { setType(e.target.value); if (!['Maladie', 'Hospitalisation'].includes(e.target.value)) setSansDuree(false); }} className="select-ligne">
                  <option>Annuel</option><option>Maladie</option><option>Hospitalisation</option><option>Autre</option>
                </select>
              </div>
            </div>

            <div className="groupe-champ">
              <label>Type d'indisponibilité</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', margin: 0 }}>
                  <input type="checkbox" checked={sansDuree} disabled={!['Maladie', 'Hospitalisation'].includes(type)} onChange={(e) => setSansDuree(e.target.checked)} style={{ width: 'auto' }} /> 
                  Sans durée connue
                </label>
              </div>
            </div>

            {!sansDuree && (
              <>
                <div className="groupe-champ">
                  <label htmlFor="dateDebutDirect">Du</label>
                  <div className="champ-avec-icone">
                    <input id="dateDebutDirect" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                  </div>
                </div>
                <div className="groupe-champ">
                  <label htmlFor="dateFinDirect">Au</label>
                  <div className="champ-avec-icone">
                    <input id="dateFinDirect" type="date" min={dateDebut || undefined} required value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          {sansDuree && <p className="alerte attention" style={{ marginTop: '1rem' }}>Le personnel passera immédiatement EN PAUSE. Il restera indisponible jusqu'à ce que vous confirmiez sa reprise.</p>}

          <div style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn-connexion" disabled={envoi || !estValide}>
              {envoi ? 'Enregistrement…' : sansDuree ? 'Mettre en pause' : 'Enregistrer et valider'}
            </button>
          </div>
        </form>
      </Modal>

    </>
  );
}