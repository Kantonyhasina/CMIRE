import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';

// Les pages qui modifient les demandes de congé déclenchent cet événement pour rafraîchir le compteur
export const EVENEMENT_CONGES = 'cmire:conges-modifies';

export default function Layout() {
  const { utilisateur, deconnecter, api } = useAuth();
  const location = useLocation();
  const estAdmin = utilisateur.fonction === ROLES.ADMIN;
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const estAgent = [ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction);
  const peutVoirMonPlanning = [ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction);
  const [enAttente, setEnAttente] = useState(0);

  useEffect(() => {
    if (!estChef) return undefined;
    let annule = false;
    const charger = () => api('/api/conges/unite/nombre')
      .then((r) => { if (!annule) setEnAttente(r.nombre); })
      .catch(() => {});
    charger();
    window.addEventListener(EVENEMENT_CONGES, charger);
    return () => { annule = true; window.removeEventListener(EVENEMENT_CONGES, charger); };
  }, [api, estChef, location.pathname]);

  return (
    <>
      <header className="entete">
        <strong className="logo">CMIRE · ASECNA</strong>
        <nav aria-label="Navigation principale">
          <NavLink to="/" end>Accueil</NavLink>
          {estChef && <NavLink to="/permanences">Permanences</NavLink>}
          {peutVoirMonPlanning && <NavLink to="/mon-planning">Mon planning</NavLink>}
          {(estChef || estAgent) && <NavLink to="/missions">Missions</NavLink>}
          {estChef && (
            <NavLink to="/demandes-conges">
              Demandes de congé
              {enAttente > 0 && <span className="pastille" aria-label={`${enAttente} en attente`}>{enAttente}</span>}
            </NavLink>
          )}
          {estAgent && <NavLink to="/mes-conges">Mes congés</NavLink>}
          {(estChef || estAgent) && <NavLink to="/calendrier-conges">Calendrier des congés</NavLink>}
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
