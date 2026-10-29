import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { FONCTIONS, ROLES } from '../roles.js';

// Boundary : FormCompte (cas d'utilisation « Gérer les comptes du personnel »)
// Le matricule (P001, P002, ...) est attribué automatiquement à la création.
const VIDE = {
  nom: '', prenom: '', fonction: ROLES.CADRE, identifiant: '',
  motDePasse: '', numeroUnite: '', numeroTelephone: '',
};

export default function Comptes() {
  const { api, utilisateur } = useAuth();
  const [comptes, setComptes] = useState([]);
  const [unites, setUnites] = useState([]);
  const [formulaire, setFormulaire] = useState(VIDE);
  const [enEdition, setEnEdition] = useState(null); // matricule du compte modifié
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [listeComptes, listeUnites] = await Promise.all([api('/api/comptes'), api('/api/unites')]);
      setComptes(listeComptes);
      setUnites(listeUnites);
    } catch (e) {
      setErreur(e.message);
    }
  }, [api]);

  useEffect(() => { charger(); }, [charger]);

  const champ = (nom) => ({
    id: nom,
    value: formulaire[nom],
    onChange: (e) => setFormulaire({ ...formulaire, [nom]: e.target.value }),
  });

  function commencerModification(compte) {
    setErreur('');
    setMessage('');
    setEnEdition(compte.matricule);
    setFormulaire({
      nom: compte.nom, prenom: compte.prenom, fonction: compte.fonction,
      identifiant: compte.identifiant, motDePasse: '',
      numeroUnite: String(compte.numero_unite), numeroTelephone: compte.numero_telephone ?? '',
    });
  }

  function annuler() {
    setEnEdition(null);
    setFormulaire(VIDE);
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    setMessage('');
    setEnvoi(true);
    try {
      const corps = { ...formulaire, numeroUnite: Number(formulaire.numeroUnite) };
      if (enEdition) {
        await api(`/api/comptes/${enEdition}`, { methode: 'PUT', corps });
        setMessage(`Compte ${enEdition} modifié`);
      } else {
        const cree = await api('/api/comptes', { methode: 'POST', corps });
        setMessage(`Compte créé : ${formulaire.prenom} ${formulaire.nom} (matricule ${cree.matricule})`);
      }
      annuler();
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(compte) {
    if (!window.confirm(`Supprimer le compte de ${compte.prenom} ${compte.nom} (${compte.matricule}) ?`)) return;
    setErreur('');
    setMessage('');
    try {
      await api(`/api/comptes/${compte.matricule}`, { methode: 'DELETE' });
      if (enEdition === compte.matricule) annuler();
      setMessage(`Compte ${compte.matricule} supprimé`);
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <>
      <section className="carte">
        <h1>{enEdition ? `Modifier le compte ${enEdition}` : 'Nouveau compte'}</h1>
        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
        {message && <p role="status" className="alerte succes">{message}</p>}

        <form className="grille" onSubmit={soumettre}>
          {enEdition && (
            <div><label htmlFor="matricule">Matricule</label><input id="matricule" value={enEdition} readOnly /></div>
          )}
          <div><label htmlFor="nom">Nom</label><input required {...champ('nom')} /></div>
          <div><label htmlFor="prenom">Prénom</label><input required {...champ('prenom')} /></div>
          <div>
            <label htmlFor="fonction">Fonction</label>
            <select required {...champ('fonction')}>
              {FONCTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="numeroUnite">Unité</label>
            <select required {...champ('numeroUnite')}>
              <option value="">Choisir…</option>
              {unites.map((u) => <option key={u.numero_unite} value={u.numero_unite}>{u.nom_unite}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="numeroTelephone">Téléphone</label>
            <input type="tel" placeholder="0332337086" {...champ('numeroTelephone')} />
          </div>
          <div><label htmlFor="identifiant">Identifiant</label><input required {...champ('identifiant')} /></div>
          <div>
            <label htmlFor="motDePasse">
              {enEdition ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe (8 caractères min.)'}
            </label>
            <input type="password" required={!enEdition} minLength={enEdition ? undefined : 8}
                   autoComplete="new-password" {...champ('motDePasse')} />
          </div>
          <div className="action">
            <button type="submit" disabled={envoi}>
              {envoi ? 'Enregistrement…' : enEdition ? 'Enregistrer les modifications' : 'Créer le compte'}
            </button>
            {enEdition && <button type="button" className="secondaire" onClick={annuler}>Annuler</button>}
          </div>
        </form>
      </section>

      <section className="carte">
        <h2>Personnel ({comptes.length})</h2>
        <div className="defilement">
          <table>
            <thead>
              <tr>
                <th>Matricule</th><th>Nom</th><th>Prénom</th><th>Fonction</th><th>Unité</th>
                <th>Téléphone</th><th>Identifiant</th><th><span className="cache">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((c) => (
                <tr key={c.matricule}>
                  <td>{c.matricule}</td><td>{c.nom}</td><td>{c.prenom}</td><td>{c.fonction}</td>
                  <td>{c.nom_unite}</td><td>{c.numero_telephone || '—'}</td><td>{c.identifiant}</td>
                  <td className="actions">
                    <button type="button" className="secondaire" aria-label={`Modifier ${c.prenom} ${c.nom}`}
                            onClick={() => commencerModification(c)}>Modifier</button>
                    <button type="button" className="danger" aria-label={`Supprimer ${c.prenom} ${c.nom}`}
                            disabled={c.matricule === utilisateur.matricule}
                            title={c.matricule === utilisateur.matricule ? 'Vous ne pouvez pas supprimer votre propre compte' : undefined}
                            onClick={() => supprimer(c)}>Supprimer</button>
                  </td>
                </tr>
              ))}
              {comptes.length === 0 && <tr><td colSpan="8" className="vide">Aucun compte</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
