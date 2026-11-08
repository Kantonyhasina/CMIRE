import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterPeriode } from '../utils/dates.js';

// Boundary : FormConge (cas « Demander un congé »)
// La demande est envoyée au chef de service de l'unité, qui la valide ou la refuse.
export default function MesConges() {
  const { api } = useAuth();
  const [types, setTypes] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [type, setType] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [alertes, setAlertes] = useState([]);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      const reponse = await api('/api/conges/mes-demandes');
      setTypes(reponse.types);
      setDemandes(reponse.demandes);
      setType((actuel) => actuel || reponse.types[0] || '');
    } catch (e) {
      setErreur(e.message);
    }
  }, [api]);

  useEffect(() => { charger(); }, [charger]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');
    setMessage('');
    setAlertes([]);
    setEnvoi(true);
    try {
      const reponse = await api('/api/conges', { methode: 'POST', corps: { type, dateDebut, dateFin } });
      setMessage('Demande envoyée à votre chef de service');
      setAlertes(reponse.alertes);
      setDateDebut('');
      setDateFin('');
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function annuler(demande) {
    if (!window.confirm(`Annuler votre demande ${formaterPeriode(demande.dateDebut, demande.dateFin)} ?`)) return;
    setErreur('');
    setMessage('');
    setAlertes([]);
    try {
      await api(`/api/conges/${demande.id}`, { methode: 'DELETE' });
      setMessage('Demande annulée');
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <>
      <section className="carte">
        <h1>Demander un congé</h1>
        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
        {message && <p role="status" className="alerte succes">{message}</p>}
        {alertes.length > 0 && (
          <div className="alerte attention">
            <p>Vous avez déjà du travail planifié sur cette période (votre chef de service en est informé) :</p>
            <ul>{alertes.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}

        <form className="grille" onSubmit={soumettre}>
          <div>
            <label htmlFor="type">Type de congé</label>
            <select id="type" required value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dateDebut">Du</label>
            <input id="dateDebut" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dateFin">Au</label>
            <input id="dateFin" type="date" required value={dateFin} min={dateDebut || undefined}
                   onChange={(e) => setDateFin(e.target.value)} />
          </div>
          <div className="action">
            <button type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer la demande'}</button>
          </div>
        </form>
      </section>

      <section className="carte">
        <h2>Mes demandes</h2>
        <div className="defilement">
          <table>
            <thead><tr><th>Période</th><th>Type</th><th>Statut</th><th><span className="cache">Actions</span></th></tr></thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id}>
                  <td>{d.statut === 'En pause' && !d.dateDebut && !d.dateFin ? 'Sans durée connue — EN PAUSE' : formaterPeriode(d.dateDebut, d.dateFin)}</td>
                  <td>{d.type}</td>
                  <td><span className={`badge statut-${d.statut === 'Validé' ? 'ok' : d.statut === 'Refusé' ? 'ko' : 'attente'}`}>{d.statut}</span></td>
                  <td className="actions">
                    {d.statut === 'En attente' && (
                      <button type="button" className="secondaire" aria-label={`Annuler la demande ${d.statut === 'En pause' && !d.dateDebut && !d.dateFin ? 'Sans durée connue — EN PAUSE' : formaterPeriode(d.dateDebut, d.dateFin)}`}
                              onClick={() => annuler(d)}>Annuler</button>
                    )}
                  </td>
                </tr>
              ))}
              {demandes.length === 0 && <tr><td colSpan="4" className="vide">Aucune demande</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
