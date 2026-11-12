import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONCTIONS, ROLES } from '../roles.js';
import Modal from '../components/Modal.jsx';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

const VIDE = {
  nom: '', prenom: '', fonction: ROLES.CADRE, identifiant: '',
  motDePasse: '', numeroUnite: '', numeroTelephone: '',
};
const ELEMENTS_PAR_PAGE = 7;

const IconeModifier = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconeDesactiver = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" />
  </svg>
);
const IconeReactiver = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 7v5h-5" /><path d="M4.9 16a8 8 0 0 0 13.4 2L20 12M4 12a8 8 0 0 1 13.5-5L20 8" />
  </svg>
);
const IconeLoupe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

function compteActif(compte) {
  return compte.actif !== false;
}

function dateLisible(valeur) {
  if (!valeur) return '—';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

export default function Comptes({ afficherDesactives = false }) {
  const { api, utilisateur } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  const [comptes, setComptes] = useState([]);
  const [unites, setUnites] = useState([]);
  const [formulaire, setFormulaire] = useState(VIDE);
  const [enEdition, setEnEdition] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [compteAChanger, setCompteAChanger] = useState(null);
  const [pageActuelle, setPageActuelle] = useState(1);
  const [ligneSelectionnee, setLigneSelectionnee] = useState(null);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [termeRecherche, setTermeRecherche] = useState('');

  const charger = useCallback(async () => {
    try {
      const [listeComptes, listeUnites] = await Promise.all([api('/api/comptes'), api('/api/unites')]);
      setComptes(listeComptes || []);
      setUnites(listeUnites || []);
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }, [api, ajouterToast]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setPageActuelle(1); }, [comptes.length, termeRecherche, afficherDesactives]);

  const comptesStatut = useMemo(
    () => comptes.filter((compte) => compteActif(compte) !== afficherDesactives),
    [comptes, afficherDesactives]
  );
  const comptesFiltres = useMemo(() => {
    const terme = termeRecherche.toLowerCase().trim();
    if (!terme) return comptesStatut;
    return comptesStatut.filter((c) =>
      [c.nom, c.prenom, c.matricule, c.identifiant, c.fonction, c.nom_unite, c.numero_telephone]
        .some((v) => String(v || '').toLowerCase().includes(terme))
    );
  }, [comptesStatut, termeRecherche]);

  const indexDernier = pageActuelle * ELEMENTS_PAR_PAGE;
  const indexPremier = indexDernier - ELEMENTS_PAR_PAGE;
  const comptesPagines = comptesFiltres.slice(indexPremier, indexDernier);
  const nombreTotalPages = Math.ceil(comptesFiltres.length / ELEMENTS_PAR_PAGE);
  const actifs = comptes.filter(compteActif).length;
  const inactifs = comptes.length - actifs;

  const champ = (nom) => ({
    id: nom,
    value: formulaire[nom],
    onChange: (e) => setFormulaire((precedent) => ({ ...precedent, [nom]: e.target.value })),
  });

  function ouvrirCreation() {
    setEnEdition(null);
    setFormulaire(VIDE);
    setModalOuvert(true);
  }

  function commencerModification(compte) {
    setEnEdition(compte.matricule);
    setFormulaire({
      nom: compte.nom, prenom: compte.prenom, fonction: compte.fonction,
      identifiant: compte.identifiant, motDePasse: '',
      numeroUnite: String(compte.numero_unite), numeroTelephone: compte.numero_telephone ?? '',
    });
    setModalOuvert(true);
  }

  function fermerModal() {
    setModalOuvert(false);
    setFormulaire(VIDE);
    setEnEdition(null);
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    try {
      const corps = { ...formulaire, numeroUnite: Number(formulaire.numeroUnite) };
      if (enEdition) {
        await api(`/api/comptes/${enEdition}`, { methode: 'PUT', corps });
        ajouterToast(`Compte ${enEdition} modifié avec succès`, 'succes');
      } else {
        const cree = await api('/api/comptes', { methode: 'POST', corps });
        ajouterToast(`Compte créé : ${formulaire.prenom} ${formulaire.nom} (${cree.matricule})`, 'succes');
      }
      fermerModal();
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  async function confirmerChangementStatut() {
    if (!compteAChanger) return;
    const nouvelEtat = !compteActif(compteAChanger);
    try {
      await api(`/api/comptes/${compteAChanger.matricule}/activation`, {
        methode: 'PATCH', corps: { actif: nouvelEtat },
      });
      ajouterToast(
        nouvelEtat ? `Compte ${compteAChanger.matricule} réactivé` : `Compte ${compteAChanger.matricule} désactivé`,
        'succes'
      );
      setCompteAChanger(null);
      await charger();
    } catch (e) {
      ajouterToast(e.message, 'erreur');
    }
  }

  const estFormulaireValide = formulaire.nom.trim() !== ''
    && formulaire.prenom.trim() !== ''
    && formulaire.fonction !== ''
    && formulaire.numeroUnite !== ''
    && formulaire.identifiant.trim() !== ''
    && (enEdition ? (!formulaire.motDePasse || formulaire.motDePasse.length >= 8) : formulaire.motDePasse.length >= 8);

  return (
    <>
      <ToastsContainer toasts={toasts} />
      <section className="page-entete comptes-entete">
        <div>
          <p className="surtitre">ADMINISTRATION · RESSOURCES HUMAINES</p>
          <h1>{afficherDesactives ? 'Comptes désactivés' : 'Gestion du personnel'}</h1>
          <p className="sous-titre">Conservez les matricules et l’historique même lorsqu’un agent quitte le service.</p>
        </div>
        {!afficherDesactives && <button type="button" className="btn-primaire" onClick={ouvrirCreation}>＋ Nouveau compte</button>}
      </section>

      <section className="carte comptes-carte">
        <div className="onglets-comptes" role="tablist" aria-label="État des comptes">
          <Link to="/comptes" role="tab" aria-selected={!afficherDesactives} className={!afficherDesactives ? 'onglet-compte actif' : 'onglet-compte'}>
            Personnel actif <span>{actifs}</span>
          </Link>
          <Link to="/comptes/desactives" role="tab" aria-selected={afficherDesactives} className={afficherDesactives ? 'onglet-compte actif' : 'onglet-compte'}>
            Comptes désactivés <span>{inactifs}</span>
          </Link>
        </div>

        <div className="entete-section comptes-table-entete">
          <div>
            <h2>{afficherDesactives ? 'Archives des comptes' : 'Personnel actif'} ({comptesFiltres.length})</h2>
            <p className="sous-titre">{afficherDesactives ? 'Ces comptes ne peuvent plus ouvrir une session ni recevoir de nouvelles affectations.' : 'Consultez, recherchez et gérez les comptes du personnel.'}</p>
          </div>
          <div className="actions-entete">
            <div className={`barre-recherche ${rechercheOuverte ? 'ouverte' : ''}`}>
              {!rechercheOuverte ? (
                <button type="button" className="btn-icone-search" onClick={() => setRechercheOuverte(true)} title="Rechercher">
                  <IconeLoupe />
                </button>
              ) : (
                <div className="champ-recherche-actif">
                  <input type="text" placeholder="Rechercher un nom, matricule, unité…" value={termeRecherche}
                    onChange={(e) => setTermeRecherche(e.target.value)} autoFocus />
                  <button type="button" className="btn-effacer-recherche" aria-label="Effacer la recherche"
                    onClick={() => { setTermeRecherche(''); setRechercheOuverte(false); }}>✕</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="defilement">
          <table className="tableau-moderne">
            <thead><tr>
              <th>Matricule</th><th>Nom et prénom</th><th>Fonction</th><th>Unité</th>
              <th>Téléphone</th><th>Identifiant</th>{afficherDesactives && <th>Désactivé le</th>}<th className="text-center">Actions</th>
            </tr></thead>
            <tbody>
              {comptesPagines.map((c) => (
                <tr key={c.matricule} className={`${ligneSelectionnee === c.matricule ? 'ligne-selectionnee ' : ''}${!compteActif(c) ? 'compte-inactif' : ''}`}
                  onClick={() => setLigneSelectionnee(c.matricule)}>
                  <td className="font-bold">{c.matricule}</td>
                  <td><strong>{c.prenom} {c.nom}</strong></td>
                  <td>{c.fonction}</td>
                  <td>{c.nom_unite}</td>
                  <td>{c.numero_telephone || '—'}</td>
                  <td>{c.identifiant}</td>
                  {afficherDesactives && <td>{dateLisible(c.dateDesactivation)}</td>}
                  <td className="actions-cellules">
                    <button type="button" className="btn-icone" title="Modifier" aria-label={`Modifier ${c.prenom} ${c.nom}`}
                      onClick={(e) => { e.stopPropagation(); commencerModification(c); }}><IconeModifier /></button>
                    {compteActif(c) ? (
                      <button type="button" className="btn-icone btn-icone-danger" title="Désactiver" aria-label={`Désactiver ${c.prenom} ${c.nom}`}
                        disabled={c.matricule === utilisateur.matricule}
                        onClick={(e) => { e.stopPropagation(); setCompteAChanger(c); }}><IconeDesactiver /></button>
                    ) : (
                      <button type="button" className="btn-icone btn-icone-success" title="Réactiver" aria-label={`Réactiver ${c.prenom} ${c.nom}`}
                        onClick={(e) => { e.stopPropagation(); setCompteAChanger(c); }}><IconeReactiver /></button>
                    )}
                  </td>
                </tr>
              ))}
              {comptesPagines.length === 0 && <tr><td colSpan={afficherDesactives ? 8 : 7} className="vide">{termeRecherche ? 'Aucun résultat pour cette recherche.' : afficherDesactives ? 'Aucun compte désactivé.' : 'Aucun compte actif.'}</td></tr>}
            </tbody>
          </table>
        </div>

        {nombreTotalPages > 1 && <div className="pagination-moderne">
          <span className="pagination-info">Affichage de {indexPremier + 1} à {Math.min(indexDernier, comptesFiltres.length)} sur {comptesFiltres.length}</span>
          <div className="pagination-boutons">
            <button type="button" disabled={pageActuelle === 1} onClick={() => setPageActuelle((p) => p - 1)}>‹</button>
            {[...Array(nombreTotalPages)].map((_, i) => <button key={i} type="button" className={pageActuelle === i + 1 ? 'actif' : ''} onClick={() => setPageActuelle(i + 1)}>{i + 1}</button>)}
            <button type="button" disabled={pageActuelle === nombreTotalPages} onClick={() => setPageActuelle((p) => p + 1)}>›</button>
          </div>
        </div>}
      </section>

      <Modal estOuvert={modalOuvert} onFermer={fermerModal} titre={enEdition ? `Modifier le compte ${enEdition}` : 'Nouveau compte'}>
        <form className="formulaire-login" onSubmit={soumettre}>
          <div className="grille-formulaire">
            {enEdition && <div className="groupe-champ pleine-largeur"><label>Matricule</label><div className="champ-avec-icone"><input value={enEdition} readOnly disabled /></div></div>}
            <div className="groupe-champ"><label htmlFor="nom">Nom</label><div className="champ-avec-icone"><input required {...champ('nom')} placeholder="Nom" /></div></div>
            <div className="groupe-champ"><label htmlFor="prenom">Prénom</label><div className="champ-avec-icone"><input required {...champ('prenom')} placeholder="Prénom" /></div></div>
            <div className="groupe-champ"><label htmlFor="fonction">Fonction</label><div className="champ-avec-icone"><select required {...champ('fonction')} className="select-ligne">{FONCTIONS.map((f) => <option key={f}>{f}</option>)}</select></div></div>
            <div className="groupe-champ"><label htmlFor="numeroUnite">Unité</label><div className="champ-avec-icone"><select required {...champ('numeroUnite')} className="select-ligne"><option value="">Choisir…</option>{unites.map((u) => <option key={u.numero_unite} value={u.numero_unite}>{u.nom_unite}</option>)}</select></div></div>
            <div className="groupe-champ"><label htmlFor="identifiant">Identifiant</label><div className="champ-avec-icone"><input required {...champ('identifiant')} placeholder="Identifiant" /></div></div>
            <div className="groupe-champ"><label htmlFor="motDePasse">{enEdition ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'}</label><div className="champ-avec-icone"><input type="password" required={!enEdition} minLength={8} autoComplete="new-password" {...champ('motDePasse')} placeholder="8 caractères minimum" /></div></div>
            <div className="groupe-champ pleine-largeur"><label htmlFor="numeroTelephone">Téléphone (optionnel)</label><div className="champ-avec-icone"><input type="tel" placeholder="0332337086" {...champ('numeroTelephone')} /></div></div>
          </div>
          <button type="submit" className="btn-connexion" disabled={envoi || !estFormulaireValide}>{envoi ? 'Enregistrement…' : enEdition ? 'Enregistrer les modifications' : 'Créer le compte'}</button>
        </form>
      </Modal>

      <Modal estOuvert={!!compteAChanger} onFermer={() => setCompteAChanger(null)}
        titre={compteAChanger && compteActif(compteAChanger) ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}>
        <div className="contenu-suppression texte-confirmation-statut">
          <div className={`icone-confirmation-statut ${compteAChanger && compteActif(compteAChanger) ? 'ambre' : 'vert'}`}>{compteAChanger && compteActif(compteAChanger) ? <IconeDesactiver /> : <IconeReactiver />}</div>
          <p><strong>{compteAChanger?.prenom} {compteAChanger?.nom}</strong> · {compteAChanger?.matricule}</p>
          {compteAChanger && compteActif(compteAChanger) ? (
            <><p>Son compte ne pourra plus être utilisé pour se connecter et il ne sera plus proposé pour les nouvelles permanences ou missions.</p><p className="texte-info-statut">Ses permanences, missions et congés déjà enregistrés seront conservés.</p></>
          ) : (
            <p>Ce compte pourra de nouveau se connecter et être sélectionné pour les prochaines affectations.</p>
          )}
        </div>
        <div className="actions-modal-statut">
          <button type="button" className="btn-secondaire" onClick={() => setCompteAChanger(null)}>Annuler</button>
          <button type="button" className={compteAChanger && compteActif(compteAChanger) ? 'btn-danger' : 'btn-primaire'} onClick={confirmerChangementStatut}>
            {compteAChanger && compteActif(compteAChanger) ? 'Désactiver le compte' : 'Réactiver le compte'}
          </button>
        </div>
      </Modal>
    </>
  );
}
