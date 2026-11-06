import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterPeriode } from '../utils/dates.js';
import { EVENEMENT_CONGES } from '../components/Layout.jsx';

// Boundary : VueDemandes (cas « Valider une demande de congé »)
export default function DemandesConges() {
  const { api } = useAuth();
  const [onglet, setOnglet] = useState('En attente');
  const [conges, setConges] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      setConges(await api(`/api/conges/unite?${new URLSearchParams({ statut: onglet })}`));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [api, onglet]);

  useEffect(() => { charger(); }, [charger]);

  const apresModification = async () => {
    window.dispatchEvent(new Event(EVENEMENT_CONGES)); // met à jour la pastille du menu
    await charger();
  };

  async function decider(conge, decision, confirmer = false) {
    setErreur('');
    setMessage('');
    try {
      await api(`/api/conges/${conge.id}/decision`, {
        methode: 'PUT',
        corps: confirmer ? { decision, confirmer: true } : { decision },
      });
      setMessage(`Demande de ${conge.prenom} ${conge.nom} : ${decision === 'Validé' ? 'validée' : 'refusée'}`);
      await apresModification();
    } catch (e) {
      if (e.code === 'CONFIRMATION_REQUISE') {
        // L'agent a déjà du travail planifié : le chef peut valider quand même, en connaissance de cause
        const detail = e.details.map((d) => `• ${d}`).join('\n');
        if (window.confirm(`${e.message}\n\n${detail}\n\nValider quand même ce congé ?`)) {
          await decider(conge, decision, true);
        }
      } else {
        setErreur(e.message);
      }
    }
  }

  async function annuler(conge) {
    if (!window.confirm(`Annuler le congé de ${conge.prenom} ${conge.nom} (${formaterPeriode(conge.dateDebut, conge.dateFin)}) ?`)) return;
    setErreur('');
    setMessage('');
    try {
      await api(`/api/conges/${conge.id}`, { methode: 'DELETE' });
      setMessage('Congé annulé');
      await apresModification();
    } catch (e) {
      setErreur(e.message);
    }
  }

  const aTraiter = onglet === 'En attente';

  return (
    <section className="carte">
      <h1>Demandes de congé</h1>
      {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
      {message && <p role="status" className="alerte succes">{message}</p>}

      <div className="onglets" role="tablist">
        <button type="button" role="tab" aria-selected={aTraiter} onClick={() => setOnglet('En attente')}>À traiter</button>
        <button type="button" role="tab" aria-selected={!aTraiter} onClick={() => setOnglet('Validé')}>Congés validés</button>
      </div>

      <div className="defilement">
        <table>
          <thead>
            <tr>
              <th>Agent</th><th>Période</th><th>Type</th>
              {aTraiter && <th>Planning déjà prévu</th>}
              <th><span className="cache">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {conges.map((c) => (
              <tr key={c.id}>
                <td>{c.prenom} {c.nom}</td>
                <td>{formaterPeriode(c.dateDebut, c.dateFin)}</td>
                <td>{c.type}</td>
                {aTraiter && (
                  <td>
                    {c.conflits.length === 0
                      ? '—'
                      : <ul className="conflits">{c.conflits.map((x) => <li key={x}>{x}</li>)}</ul>}
                  </td>
                )}
                <td className="actions">
                  {aTraiter ? (
                    <>
                      <button type="button" aria-label={`Valider la demande de ${c.prenom} ${c.nom}`}
                              onClick={() => decider(c, 'Validé')}>Valider</button>
                      <button type="button" className="danger" aria-label={`Refuser la demande de ${c.prenom} ${c.nom}`}
                              onClick={() => decider(c, 'Refusé')}>Refuser</button>
                    </>
                  ) : (
                    <button type="button" className="secondaire" aria-label={`Annuler le congé de ${c.prenom} ${c.nom}`}
                            onClick={() => annuler(c)}>Annuler le congé</button>
                  )}
                </td>
              </tr>
            ))}
            {!chargement && conges.length === 0 && (
              <tr><td colSpan={aTraiter ? 5 : 4} className="vide">
                {aTraiter ? 'Aucune demande en attente' : 'Aucun congé validé'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
