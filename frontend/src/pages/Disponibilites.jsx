import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../roles.js';
import { formaterDateFr, semaineCourante } from '../utils/dates.js';

// Boundary : consultation de la disponibilité (règles RG1/RG2, portées par DisponibiliteService)
function libelleConflit(c) {
  const periode = c.dateDebut === c.dateFin
    ? formaterDateFr(c.dateDebut)
    : `du ${formaterDateFr(c.dateDebut)} au ${formaterDateFr(c.dateFin)}`;
  return `${c.detail} (${periode})`;
}

export default function Disponibilites() {
  const { api, utilisateur } = useAuth();
  const estChef = utilisateur.fonction === ROLES.CHEF; // RG8 : un chef reste sur son unité
  const [debutDefaut, finDefaut] = useMemo(() => semaineCourante(), []);

  const [unites, setUnites] = useState([]);
  const [numeroUnite, setNumeroUnite] = useState(String(utilisateur.numeroUnite));
  const [dateDebut, setDateDebut] = useState(debutDefaut);
  const [dateFin, setDateFin] = useState(finDefaut);
  const [ignorerPermanences, setIgnorerPermanences] = useState(false);
  const [resultats, setResultats] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    api('/api/unites').then(setUnites).catch((e) => setErreur(e.message));
  }, [api]);

  async function verifier(evenement) {
    evenement.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const parametres = new URLSearchParams({ numeroUnite, dateDebut, dateFin });
      if (ignorerPermanences) parametres.set('ignorer', 'permanence');
      setResultats(await api(`/api/disponibilites?${parametres}`));
    } catch (e) {
      setErreur(e.message);
      setResultats(null);
    } finally {
      setChargement(false);
    }
  }

  const nbDisponibles = resultats?.filter((p) => p.disponible).length ?? 0;

  return (
    <>
      <section className="carte">
        <h1>Disponibilité du personnel</h1>
        <p className="sous-titre">
          Un agent est indisponible s'il a, sur la période, un congé validé, une mission ou une permanence.
        </p>
        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}

        <form className="grille" onSubmit={verifier}>
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
            <input id="dateFin" type="date" required value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
          <div className="case">
            <input id="ignorer" type="checkbox" checked={ignorerPermanences}
                   onChange={(e) => setIgnorerPermanences(e.target.checked)} />
            <label htmlFor="ignorer">Ignorer les permanences (planification de permanence)</label>
          </div>
          <div className="action">
            <button type="submit" disabled={chargement}>{chargement ? 'Vérification…' : 'Vérifier'}</button>
          </div>
        </form>
      </section>

      {resultats && (
        <section className="carte">
          <h2>Résultat : {nbDisponibles} disponible(s) sur {resultats.length}</h2>
          <div className="defilement">
            <table>
              <thead><tr><th>Agent</th><th>Fonction</th><th>Statut</th><th>Conflits</th></tr></thead>
              <tbody>
                {resultats.map((p) => (
                  <tr key={p.matricule}>
                    <td>{p.prenom} {p.nom}</td>
                    <td>{p.fonction}</td>
                    <td>
                      <span className={`badge ${p.disponible ? 'ok' : 'ko'}`}>
                        {p.disponible ? 'Disponible' : 'Indisponible'}
                      </span>
                    </td>
                    <td>
                      {p.conflits.length === 0
                        ? '—'
                        : <ul className="conflits">{p.conflits.map((c, i) => <li key={i}>{libelleConflit(c)}</li>)}</ul>}
                    </td>
                  </tr>
                ))}
                {resultats.length === 0 && <tr><td colSpan="4" className="vide">Aucun agent dans cette unité</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
