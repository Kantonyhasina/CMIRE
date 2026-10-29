import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';

export default function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  const estAdmin = utilisateur.fonction === ROLES.ADMIN;
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const estAgent = [ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction);

  return (
    <>
      <header className="entete">
        <strong className="logo">CMIRE · ASECNA</strong>
        <nav aria-label="Navigation principale">
          <NavLink to="/" end>Accueil</NavLink>
          {estChef && <NavLink to="/permanences">Permanences</NavLink>}
          {estAgent && <NavLink to="/mon-planning">Mon planning</NavLink>}
          {estChef && <NavLink to="/disponibilites">Disponibilités</NavLink>}
          {estAdmin && <NavLink to="/comptes">Comptes</NavLink>}
          {estAdmin && <NavLink to="/referentiels">Référentiels</NavLink>}
        </nav>
        <div className="session">
          <span>{utilisateur.prenom} {utilisateur.nom} <small>({utilisateur.fonction})</small></span>
          <button type="button" className="secondaire" onClick={deconnecter}>Se déconnecter</button>
        </div>
      </header>
      <main className="contenu">
        <Outlet />
      </main>
    </>
  );
}
