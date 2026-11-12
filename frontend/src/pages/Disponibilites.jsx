import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { formaterDateFr, semaineCourante } from '../utils/dates.js';
import { useToasts, ToastsContainer } from '../components/Toasts.jsx';

function libelleConflit(c) {
  const periode = c.dateDebut === c.dateFin
    ? formaterDateFr(c.dateDebut)
    : `du ${formaterDateFr(c.dateDebut)} au ${formaterDateFr(c.dateFin)}`;
  return `${c.detail} (${periode})`;
}

export default function Disponibilites() {
  const { api, utilisateur } = useAuth();
  const { toasts, ajouterToast } = useToasts();
  
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const [debutDefaut, finDefaut] = useMemo(() => semaineCourante(), []);

  const [unites, setUnites] = useState([]);
  const [numeroUnite, setNumeroUnite] = useState(String(utilisateur.numeroUnite));
  const [dateDebut, setDateDebut] = useState(debutDefaut);
  const [dateFin, setDateFin] = useState(finDefaut);
  const [ignorerPermanences, setIgnorerPermanences] = useState(false);
  const [resultats, setResultats] = useState(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    api('/api/unites')
      .then(setUnites)
      .catch((e) => ajouterToast(e.message, 'erreur'));
  }, [api]);

  async function verifier(evenement) {
    evenement.preventDefault();
    setChargement(true);
    try {
      const parametres = new URLSearchParams({ numeroUnite, dateDebut, dateFin });
      if (ignorerPermanences) parametres.set('ignorer', 'permanence');
      const donnees = await api(`/api/disponibilites?${parametres}`);
      setResultats(donnees);
      ajouterToast('Vérification terminée', 'succes');
    } catch (e) {
      ajouterToast(e.message, 'erreur');
      setResultats(null);
    } finally {
      setChargement(false);
    }
  }

  const nbDisponibles = resultats?.filter((p) => p.disponible).length ?? 0;

  return (
    <>
      <ToastsContainer toasts={toasts} />

      <section className="carte">
        <h1 className="titre-centre-planning" style={{ marginBottom: '0.5rem' }}>Disponibilité du personnel</h1>
        <p className="sous-titre" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          Un agent est indisponible s'il a, sur la période, un congé validé, une mission ou une permanence.
        </p>

        <form className="grille" onSubmit={verifier} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <div>
            <label htmlFor="unite">Unité</label>
            <select id="unite" value={numeroUnite} disabled={estChef}
                    onChange={(e) => setNumeroUnite(e.target.value)}>
              {unites.map((u) => <option key={u.numero_unite} value={u.numero_unite}>{u.nom_unite}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dateDebut">Du</label>
            <input id="dateDebut" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dateFin">Au</label>
            <input id="dateFin" type="date" required value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} />
          </div>
          <div className="case" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingBottom: '0.5rem' }}>
            <input id="ignorer" type="checkbox" checked={ignorerPermanences} onChange={(e) => setIgnorerPermanences(e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="ignorer" style={{ margin: 0, fontWeight: 'normal', fontSize: '0.9rem' }}>Ignorer les permanences</label>
          </div>
          <div className="action">
            <button type="submit" className="btn-primaire" disabled={chargement}>
              {chargement ? 'Vérification…' : 'Vérifier'}
            </button>
          </div>
        </form>
      </section>

      {resultats && (
        <section className="carte">
          <div className="entete-section-titre" style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Résultat</h2>
            <span className="badge-statut valide" style={{ fontSize: '0.95rem', padding: '0.4rem 1rem' }}>
              {nbDisponibles} disponible(s) sur {resultats.length}
            </span>
          </div>

          <div className="defilement">
            <table className="tableau-moderne">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Fonction</th>
                  <th className="text-center">Statut</th>
                  <th>Conflits</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((p) => (
                  <tr key={p.matricule}>
                    <td className="font-bold">
                      {p.identifiant && <div>{p.identifiant}</div>}
                      <div className="text-small" style={{ fontWeight: 'normal' }}>{p.prenom} {p.nom}</div>
                    </td>
                    <td>{p.fonction}</td>
                    <td className="text-center">
                      <span className={`badge-statut ${p.disponible ? 'valide' : 'refuse'}`}>
                        {p.disponible ? 'Disponible' : 'Indisponible'}
                      </span>
                    </td>
                    <td>
                      {p.conflits.length === 0
                        ? '—'
                        : <ul className="conflits" style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                            {p.conflits.map((c, i) => <li key={i}>{libelleConflit(c)}</li>)}
                          </ul>}
                    </td>
                  </tr>
                ))}
                {resultats.length === 0 && (
                  <tr><td colSpan="4" className="vide">Aucun agent dans cette unité</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}