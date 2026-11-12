import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';

export const EVENEMENT_CONGES = 'cmire:conges-modifies';
export const EVENEMENT_PLANNING = 'cmire:planning-modifies';
export const EVENEMENT_MISSION = 'cmire:mission-modifiee';

const DELAI_RAFRAICHISSEMENT = 30_000;
const DATE_ORIGINE = new Date(0).toISOString();

function cleDerniereVisite(matricule, rubrique) {
  return `cmire:derniere-visite:${matricule}:${rubrique}`;
}

function lireDerniereVisite(matricule, rubrique) {
  try {
    return localStorage.getItem(cleDerniereVisite(matricule, rubrique)) || DATE_ORIGINE;
  } catch {
    return DATE_ORIGINE;
  }
}

function enregistrerDerniereVisite(matricule, rubrique) {
  const date = new Date().toISOString();
  try {
    localStorage.setItem(cleDerniereVisite(matricule, rubrique), date);
  } catch {
    // silencieux
  }
}

function classeLien({ isActive }) {
  return isActive ? 'nav-lien actif' : 'nav-lien';
}

export default function Layout() {
  const { utilisateur, deconnecter, api } = useAuth();
  const location = useLocation();

  const estAdmin = utilisateur.fonction === ROLES.ADMIN;
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const estAgent = [ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction);
  const matricule = utilisateur.matricule;

  // État des notifications
  const [notifications, setNotifications] = useState({
    planning: 0,
    missions: 0,
    conges: 0,
    demandesConges: 0,
  });

  // État du menu déroulant pour le Chef
  const [menuChefOuvert, setMenuChefOuvert] = useState(false);
  const menuChefRef = useRef(null);

  // Ferme le menu du chef quand on change de page
  useEffect(() => {
    setMenuChefOuvert(false);
  }, [location.pathname]);

  // Ferme le menu du chef si on clique en dehors
  useEffect(() => {
    function gererClicExterieur(event) {
      if (menuChefRef.current && !menuChefRef.current.contains(event.target)) {
        setMenuChefOuvert(false);
      }
    }
    document.addEventListener('mousedown', gererClicExterieur);
    return () => document.removeEventListener('mousedown', gererClicExterieur);
  }, []);

  // Gestion des notifications
  useEffect(() => {
    const pageVisitee = {
      '/mon-planning': 'planning',
      '/missions': estAgent ? 'missions' : null,
      '/mes-conges': 'conges',
      '/demandes-conges': estChef ? 'demandesConges' : null,
    }[location.pathname];

    if (pageVisitee) {
      enregistrerDerniereVisite(matricule, pageVisitee);
      setNotifications((precedentes) => ({ ...precedentes, [pageVisitee]: 0 }));
    }

    let annule = false;

    const chargerNotifications = async () => {
      const appels = [];
      const rubriques = [];

      if (estAgent) {
        appels.push(
          api(`/api/notifications/planning?depuis=${encodeURIComponent(lireDerniereVisite(matricule, 'planning'))}`),
          api(`/api/notifications/missions?depuis=${encodeURIComponent(lireDerniereVisite(matricule, 'missions'))}`),
          api(`/api/notifications/conges?depuis=${encodeURIComponent(lireDerniereVisite(matricule, 'conges'))}`),
        );
        rubriques.push('planning', 'missions', 'conges');
      }

      if (estChef) {
        appels.push(
          api(`/api/notifications/demandes-conges?depuis=${encodeURIComponent(lireDerniereVisite(matricule, 'demandesConges'))}`),
        );
        rubriques.push('demandesConges');
      }

      if (appels.length === 0) return;

      const resultats = await Promise.all(
        appels.map((appel) => appel.catch(() => ({ nouveau: 0 })))
      );

      if (annule) return;
      setNotifications((precedentes) => {
        const suivantes = { ...precedentes };
        resultats.forEach((resultat, index) => {
          suivantes[rubriques[index]] = Number(resultat?.nouveau) || 0;
        });
        return suivantes;
      });
    };

    chargerNotifications();
    const intervalle = window.setInterval(chargerNotifications, DELAI_RAFRAICHISSEMENT);
    window.addEventListener(EVENEMENT_CONGES, chargerNotifications);
    window.addEventListener(EVENEMENT_PLANNING, chargerNotifications);
    window.addEventListener(EVENEMENT_MISSION, chargerNotifications);

    return () => {
      annule = true;
      window.clearInterval(intervalle);
      window.removeEventListener(EVENEMENT_CONGES, chargerNotifications);
      window.removeEventListener(EVENEMENT_PLANNING, chargerNotifications);
      window.removeEventListener(EVENEMENT_MISSION, chargerNotifications);
    };
  }, [api, estAgent, estChef, location.pathname, matricule]);

  const marquerCommeLu = (rubrique) => {
    enregistrerDerniereVisite(matricule, rubrique);
    setNotifications((precedentes) => ({ ...precedentes, [rubrique]: 0 }));
  };

  return (
    <div className="app-layout">
      <header className="entete">
        <div className="entete-logo">
          <img src="/logo-cmire.jpg" alt="Logo CMIRE" className="logo-img-nav" />
          <span className="logo-texte-nav">CMIRE <span>. ASECNA</span></span>
        </div>

        <nav className="nav-centre" aria-label="Navigation principale">
          <NavLink to="/" end className={classeLien}>
            Tableau de bord
          </NavLink>

          {/* ================= AGENT ================= */}
          {estAgent && (
            <>
              <NavLink to="/mon-planning" onClick={() => marquerCommeLu('planning')} className={classeLien}>
                Mon planning
                {notifications.planning > 0 && <span className="pastille-notif">{notifications.planning}</span>}
              </NavLink>
              <NavLink to="/mes-conges" onClick={() => marquerCommeLu('conges')} className={classeLien}>
                Mes congés
                {notifications.conges > 0 && <span className="pastille-notif">{notifications.conges}</span>}
              </NavLink>
              <NavLink to="/missions" onClick={() => marquerCommeLu('missions')} className={classeLien}>
                Missions
                {notifications.missions > 0 && <span className="pastille-notif">{notifications.missions}</span>}
              </NavLink>
              <NavLink to="/calendrier-conges" className={classeLien}>
                Calendrier des congés
              </NavLink>
            </>
          )}

          {/* ================= CHEF ================= */}
          {estChef && (
            <>
              <NavLink to="/permanences" className={classeLien}>Permanences</NavLink>
              <NavLink to="/missions" className={classeLien}>Missions</NavLink>
              <NavLink to="/demandes-conges" onClick={() => marquerCommeLu('demandesConges')} className={classeLien}>
                Demandes de congé
                {notifications.demandesConges > 0 && <span className="pastille-notif">{notifications.demandesConges}</span>}
              </NavLink>

              {/* MENU DÉROULANT POUR LE CHEF UNIQUEMENT */}
              <div className="menu-deroulant" ref={menuChefRef}>
                <button 
                  type="button"
                  className="nav-lien" 
                  onClick={() => setMenuChefOuvert(!menuChefOuvert)}
                  aria-expanded={menuChefOuvert}
                >
                  Planning & Dispo ▼
                </button>
                
                {menuChefOuvert && (
                  <div className="menu-deroulant-contenu">
                    <NavLink to="/mon-planning" onClick={() => { marquerCommeLu('planning'); setMenuChefOuvert(false); }} className={classeLien}>
                      Mon planning
                    </NavLink>
                    <NavLink to="/calendrier-conges" onClick={() => setMenuChefOuvert(false)} className={classeLien}>
                      Calendrier des congés
                    </NavLink>
                    <NavLink to="/disponibilites" onClick={() => setMenuChefOuvert(false)} className={classeLien}>
                      Disponibilités
                    </NavLink>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================= ADMIN ================= */}
          {estAdmin && (
            <>
              <NavLink to="/comptes" end className={classeLien}>Comptes</NavLink>
              <NavLink to="/comptes/desactives" className={classeLien}>Comptes désactivés</NavLink>
              <NavLink to="/referentiels" className={classeLien}>Référentiels</NavLink>
            </>
          )}
        </nav>

        <div className="entete-utilisateur">
          <div className="profil">
            <span className="profil-nom">{utilisateur.prenom} {utilisateur.nom}</span>
            <span className="profil-role">{utilisateur.fonction}</span>
          </div>
          <button type="button" className="btn-deconnexion" onClick={deconnecter}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="contenu">
        <Outlet />
      </main>
    </div>
  );
}