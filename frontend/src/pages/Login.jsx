import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login() {
  const { connecter, estConnecte } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // États du formulaire
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // États de l'UI (Design)
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [voirMotDePasse, setVoirMotDePasse] = useState(false);

  if (estConnecte) return <Navigate to="/" replace />;

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      await connecter(identifiant.trim(), motDePasse);
      navigate(location.state?.depuis || '/', { replace: true });
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  // Condition pour griser le bouton
  const estFormulaireValide = identifiant.trim() !== '' && motDePasse !== '';

  return (
    <div className="login-page">
      {/* Arrière-plan avec l'effet forêt (utilise des dégradés CSS) */}
      <div className="background-decoration">
        <div className="arbre arbre-1"></div>
        <div className="arbre arbre-2"></div>
        <div className="arbre arbre-3"></div>
        <div className="arbre arbre-4"></div>
        <div className="arbre arbre-5"></div>
      </div>

            {/* Barre de navigation supérieure */}
      <header className={`login-header ${afficherFormulaire ? 'header-reduit' : ''}`}>
        <div className="logo-container">
          <img src="/logo-cmire.jpg" alt="Logo CMIRE ASEGNA" className="logo-img" />
          <span className="logo-text">
            CMIRE <span className="logo-subtext">. ASECNA</span>
          </span>
        </div>
      </header>
      {/* ÉCRAN D'ACCUEIL */}
      <div className={`ecran-accueil ${afficherFormulaire ? 'cacher-accueil' : ''}`}>
        <div className="contenu-accueil">
          <h1 className="titre-accueil">Bienvenue sur CMIRE</h1>
          <p className="texte-accueil">Gestion des permanences, missions et congés du service M.I.R.E.</p>
          <button className="btn-accueil" onClick={() => setAfficherFormulaire(true)}>
            Se connecter
          </button>
        </div>
      </div>

      {/* MODAL DE CONNEXION */}
      <div className={`modal-overlay ${afficherFormulaire ? 'modal-visible' : ''}`}>
        <div className="modal-contenu">
          <button 
            className="btn-fermer" 
            onClick={() => {
              setAfficherFormulaire(false);
              setErreur('');
            }}
            aria-label="Fermer"
          >
            ✕
          </button>

          <h2 className="modal-titre">Connexion</h2>
          <p className="modal-sous-titre">Service M.I.R.E : gestion des permanences, missions et congés</p>

          {erreur && <div role="alert" className="alerte erreur">{erreur}</div>}

          <form onSubmit={soumettre} noValidate className="formulaire-login">
            <div className="groupe-champ">
              <label htmlFor="identifiant">Identifiant</label>
              <div className="champ-avec-icone">
                <input 
                  id="identifiant" 
                  autoComplete="username" 
                  autoFocus 
                  required
                  placeholder="Votre identifiant"
                  value={identifiant} 
                  onChange={(e) => setIdentifiant(e.target.value)} 
                />
                <span className="icone-champ">👤</span>
              </div>
            </div>

            <div className="groupe-champ">
              <label htmlFor="motDePasse">Mot de passe</label>
              <div className="champ-avec-icone">
                <input 
                  id="motDePasse" 
                  type={voirMotDePasse ? "text" : "password"} 
                  autoComplete="current-password" 
                  required
                  placeholder="••••••••"
                  value={motDePasse} 
                  onChange={(e) => setMotDePasse(e.target.value)} 
                />
                <button 
                  type="button" 
                  className="btn-voir-mdp" 
                  onClick={() => setVoirMotDePasse(!voirMotDePasse)}
                  aria-label={voirMotDePasse ? "Cacher le mot de passe" : "Voir le mot de passe"}
                >
                  {voirMotDePasse ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={envoi || !estFormulaireValide}
              className="btn-connexion"
            >
              {envoi ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}