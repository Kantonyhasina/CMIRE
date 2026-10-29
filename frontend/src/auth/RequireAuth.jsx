import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Précondition globale : toute page exige une session. `roles` restreint en plus par fonction.
export default function RequireAuth({ roles, children }) {
  const { estConnecte, utilisateur } = useAuth();
  const location = useLocation();

  if (!estConnecte) {
    return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />;
  }
  if (roles && !roles.includes(utilisateur.fonction)) {
    return (
      <section className="carte">
        <h1>Accès refusé</h1>
        <p>Votre fonction ne vous donne pas accès à cette page.</p>
      </section>
    );
  }
  return children;
}
