import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

// Boundary : FormConnexion (cas d'utilisation « S'authentifier »)
export default function Login() {
  const { connecter, estConnecte } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

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

  return (
    <div className="connexion">
      <form className="carte" onSubmit={soumettre} noValidate>
        <h1>Connexion</h1>
        <p className="sous-titre">Service M.I.R.E : gestion des permanences, missions et congés</p>

        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}

        <label htmlFor="identifiant">Identifiant</label>
        <input id="identifiant" autoComplete="username" autoFocus required
               value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />

        <label htmlFor="motDePasse">Mot de passe</label>
        <input id="motDePasse" type="password" autoComplete="current-password" required
               value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />

        <button type="submit" disabled={envoi || !identifiant || !motDePasse}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
