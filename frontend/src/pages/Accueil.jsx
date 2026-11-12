import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

const ACTIONS = {
  [ROLES.ADMIN]: [
    { titre: 'Gestion du personnel', description: 'Créer, modifier, rechercher et gérer les comptes du personnel.', lien: '/comptes', icone: '♙', couleur: 'bleu' },
    { titre: 'Comptes désactivés', description: 'Consulter les anciens comptes et rétablir leur accès si nécessaire.', lien: '/comptes/desactives', icone: '↻', couleur: 'ambre' },
    { titre: 'Référentiels', description: 'Gérer les unités, les postes et les stations.', lien: '/referentiels', icone: '⚙', couleur: 'violet' },
  ],
  [ROLES.CHEF]: [
    { titre: 'Permanences', description: 'Organiser les permanences de votre unité.', lien: '/permanences', icone: '▦', couleur: 'bleu' },
    { titre: 'Missions', description: 'Consulter les missions et gérer les intervenants de votre unité.', lien: '/missions', icone: '✈', couleur: 'vert' },
    { titre: 'Demandes de congé', description: 'Traiter les demandes et enregistrer les absences de votre équipe.', lien: '/demandes-conges', icone: '▤', couleur: 'ambre' },
    { titre: 'Disponibilités', description: 'Vérifier les disponibilités du personnel.', lien: '/disponibilites', icone: '◉', couleur: 'violet' },
    { titre: 'Calendrier des congés', description: 'Visualiser les absences de votre unité.', lien: '/calendrier-conges', icone: '▦', couleur: 'gris' },
  ],
  agent: [
    { titre: 'Mon planning', description: 'Consulter vos permanences, missions et congés.', lien: '/mon-planning', icone: '▦', couleur: 'bleu' },
    { titre: 'Missions', description: 'Consulter le planning des missions.', lien: '/missions', icone: '✈', couleur: 'vert' },
    { titre: 'Mes congés', description: 'Déposer une demande et suivre son traitement.', lien: '/mes-conges', icone: '▤', couleur: 'ambre' },
    { titre: 'Calendrier des congés', description: 'Consulter les absences de votre unité.', lien: '/calendrier-conges', icone: '▦', couleur: 'violet' },
  ],
};

export default function Accueil() {
  const { utilisateur, api } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    api('/api/dashboard')
      .then((resultat) => { if (!annule) setDonnees(resultat); })
      .catch((e) => { if (!annule) ajouterToast(e.message, 'erreur'); })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [api]);

  const estAgent = [ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction);
  const actions = useMemo(() => ACTIONS[utilisateur.fonction] || (estAgent ? ACTIONS.agent : []), [utilisateur.fonction, estAgent]);
  const dateDuJour = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());

  return (
    <section className="page-accueil tableau-de-bord">
      <ToastsContainer toasts={toasts} />

      <header className="accueil-entete tableau-bord-entete">
        <div>
          <p className="surtitre">CMIRE · ESPACE DE GESTION</p>
          <h1>Bonjour, {utilisateur.prenom} {utilisateur.nom}</h1>
          <p>Votre tableau de bord <strong>{utilisateur.fonction}</strong> · {donnees?.nomUnite || (utilisateur.numeroUnite ? `Unité ${utilisateur.numeroUnite}` : 'Administration')}</p>
        </div>
        <div className="date-tableau-bord">{dateDuJour}</div>
      </header>

      <div className="entete-bloc-tableau"><div><h2>Vue d’ensemble</h2><p className="sous-titre">Les indicateurs principaux de votre espace.</p></div></div>
      <div className="grille-statistiques">
        {chargement ? <div className="stat-carte stat-chargement">Chargement des indicateurs…</div> : (donnees?.statistiques || []).map((stat) => (
          <article className={`stat-carte stat-${stat.ton || 'bleu'}`} key={stat.libelle}>
            <span>{stat.libelle}</span><strong>{stat.valeur}</strong><small>{stat.detail}</small>
          </article>
        ))}
      </div>

      <div className="entete-bloc-tableau actions-tableau-entete"><div><h2>Accès rapides</h2><p className="sous-titre">{donnees?.message || 'Accédez directement aux principales fonctionnalités.'}</p></div></div>
      <div className="grille-actions-tableau">
        {actions.map((action) => (
          <Link to={action.lien} className="action-tableau" key={action.lien}>
            <span className={`action-tableau-icone couleur-${action.couleur}`}>{action.icone}</span>
            <span className="action-tableau-contenu"><strong>{action.titre}</strong><small>{action.description}</small></span>
            <span className="action-tableau-fleche">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}