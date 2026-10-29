import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';

export default function Accueil() {
  const { utilisateur } = useAuth();
  const estAdmin = utilisateur.fonction === ROLES.ADMIN;
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const estAgent = [ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction);

  return (
    <section className="carte">
      <h1>Bonjour {utilisateur.prenom} {utilisateur.nom}</h1>
      <p>Connecté en tant que <strong>{utilisateur.fonction}</strong>.</p>

      {estAdmin && (
        <ul className="liens">
          <li><Link to="/comptes">Gérer les comptes du personnel</Link></li>
          <li><Link to="/referentiels">Gérer les unités, postes et stations</Link></li>
        </ul>
      )}
      {estChef && (
        <ul className="liens">
          <li><Link to="/permanences">Planifier les permanences</Link></li>
          <li><Link to="/disponibilites">Consulter les disponibilités de mon unité</Link></li>
        </ul>
      )}
      {estAgent && (
        <ul className="liens">
          <li><Link to="/mon-planning">Consulter mon planning de permanence</Link></li>
        </ul>
      )}

      <p className="sous-titre">
        Les modules missions et congés seront ajoutés dans les prochains incréments.
      </p>
    </section>
  );
}
