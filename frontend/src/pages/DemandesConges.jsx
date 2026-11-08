import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { formaterDateFr, formaterPeriode } from '../utils/dates.js';
import { EVENEMENT_CONGES } from '../components/Layout.jsx';

const AUJOURDHUI = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const periode = (c) => c.dateDebut && c.dateFin
  ? formaterPeriode(c.dateDebut, c.dateFin)
  : c.dateReprise ? `Pause sans durée connue — reprise le ${formaterDateFr(c.dateReprise)}`
    : 'Sans date de début ni de fin — jusqu’à la reprise';

// Le chef gère les demandes, crée directement un congé et suit les pauses maladie/hospitalisation.
export default function DemandesConges() {
  const { api } = useAuth();
  const [onglet, setOnglet] = useState('En attente');
  const [conges, setConges] = useState([]);
  const [personnels, setPersonnels] = useState([]);
  const [matricule, setMatricule] = useState('');
  const [type, setType] = useState('Annuel');
  const [sansDuree, setSansDuree] = useState(false);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [datesReprise, setDatesReprise] = useState({});
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [alertes, setAlertes] = useState([]);

  const chargerPersonnels = useCallback(async () => {
    try {
      const liste = await api('/api/conges/personnels-unite');
      setPersonnels(liste);
      setMatricule((actuel) => actuel || liste[0]?.matricule || '');
    } catch (e) { setErreur(e.message); }
  }, [api]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      setConges(await api(`/api/conges/unite?${new URLSearchParams({ statut: onglet })}`));
    } catch (e) { setErreur(e.message); }
    finally { setChargement(false); }
  }, [api, onglet]);

  useEffect(() => { chargerPersonnels(); }, [chargerPersonnels]);
  useEffect(() => { charger(); }, [charger]);

  const apresModification = async () => {
    window.dispatchEvent(new Event(EVENEMENT_CONGES));
    await charger();
  };

  async function creerDirectement(e) {
    e.preventDefault();
    setErreur(''); setMessage(''); setAlertes([]); setEnvoi(true);
    try {
      const corps = { matricule, type, sansDureeConnue: sansDuree };
      if (!sansDuree) { corps.dateDebut = dateDebut; corps.dateFin = dateFin; }
      const resultat = await api('/api/conges/unite/direct', { methode: 'POST', corps });
      setMessage(sansDuree
        ? ` ${type} enregistré : le personnel est maintenant EN PAUSE.`
        : `Congé de ${resultat.conge.prenom} ${resultat.conge.nom} enregistré et validé directement.`);
      setAlertes(resultat.alertes || []);
      setDateDebut(''); setDateFin(''); setSansDuree(false);
      setOnglet(resultat.conge.statut === 'En pause' ? 'En pause' : 'Validé');
      window.dispatchEvent(new Event(EVENEMENT_CONGES));
    } catch (e) { setErreur(e.message); }
    finally { setEnvoi(false); }
  }

  async function decider(conge, decision, confirmer = false) {
    setErreur(''); setMessage('');
    try {
      await api(`/api/conges/${conge.id}/decision`, {
        methode: 'PUT', corps: confirmer ? { decision, confirmer: true } : { decision },
      });
      setMessage(`Demande de ${conge.prenom} ${conge.nom} : ${decision === 'Validé' ? 'validée' : 'refusée'}.`);
      await apresModification();
    } catch (e) {
      if (e.code === 'CONFIRMATION_REQUISE') {
        const detail = (e.details || []).map((d) => `• ${d}`).join('\n');
        if (window.confirm(`${e.message}\n\n${detail}\n\nValider quand même ce congé ?`)) await decider(conge, decision, true);
      } else setErreur(e.message);
    }
  }

  async function reprendre(conge) {
    const dateReprise = datesReprise[conge.id] || AUJOURDHUI();
    if (!window.confirm(`Confirmer la reprise de ${conge.prenom} ${conge.nom} à partir du ${formaterDateFr(dateReprise)} ?`)) return;
    setErreur(''); setMessage('');
    try {
      await api(`/api/conges/${conge.id}/reprise`, { methode: 'PUT', corps: { dateReprise } });
      setMessage(`Reprise de ${conge.prenom} ${conge.nom} enregistrée. L'historique est conservé.`);
      setOnglet('Repris');
      window.dispatchEvent(new Event(EVENEMENT_CONGES));
    } catch (e) { setErreur(e.message); }
  }

  async function annuler(conge) {
    if (!window.confirm(`Annuler le congé de ${conge.prenom} ${conge.nom} (${periode(conge)}) ?`)) return;
    setErreur(''); setMessage('');
    try {
      await api(`/api/conges/${conge.id}`, { methode: 'DELETE' });
      setMessage('Congé annulé.'); await apresModification();
    } catch (e) { setErreur(e.message); }
  }

  const estAttente = onglet === 'En attente';
  const estPause = onglet === 'En pause';
  const titres = useMemo(() => [
    ['En attente', 'À traiter'], ['Validé', 'Congés validés'], ['En pause', 'Personnel en pause'], ['Repris', 'Historique des reprises'],
  ], []);

  return (
    <>
      <section className="carte">
        <h1>Gestion des congés et indisponibilités</h1>
        <p>Le chef de service peut enregistrer directement un congé pour son unité, y compris pour lui-même. L'enregistrement est immédiatement validé.</p>
        {erreur && <p role="alert" className="alerte erreur">{erreur}</p>}
        {message && <p role="status" className="alerte succes">{message}</p>}
        {alertes.length > 0 && <div className="alerte attention"><p>Attention : ce personnel possède déjà des affectations planifiées :</p><ul>{alertes.map((a, i) => <li key={`${a}-${i}`}>{a}</li>)}</ul></div>}
        <h2>Enregistrer un congé ou une pause</h2>
        <form className="grille" onSubmit={creerDirectement}>
          <div>
            <label htmlFor="personnelConge">Personnel concerné</label>
            <select id="personnelConge" required value={matricule} onChange={(e) => setMatricule(e.target.value)}>
              {personnels.map((p) => <option key={p.matricule} value={p.matricule}>{p.identifiant ? `${p.identifiant} — ` : ''}{p.prenom} {p.nom} ({p.fonction})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="typeConge">Motif</label>
            <select id="typeConge" value={type} onChange={(e) => { setType(e.target.value); if (!['Maladie', 'Hospitalisation'].includes(e.target.value)) setSansDuree(false); }}>
              <option>Annuel</option><option>Maladie</option><option>Hospitalisation</option><option>Autre</option>
            </select>
          </div>
          <div className="action" style={{ gridColumn: '1 / -1' }}>
            <label><input type="checkbox" checked={sansDuree} disabled={!['Maladie', 'Hospitalisation'].includes(type)} onChange={(e) => setSansDuree(e.target.checked)} /> Indisponibilité sans durée connue (aucune date de début ni de fin)</label>
          </div>
          {!sansDuree && <>
            <div><label htmlFor="dateDebutDirect">Du</label><input id="dateDebutDirect" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} /></div>
            <div><label htmlFor="dateFinDirect">Au</label><input id="dateFinDirect" type="date" min={dateDebut || undefined} required value={dateFin} onChange={(e) => setDateFin(e.target.value)} /></div>
          </>}
          {sansDuree && <p className="alerte attention" style={{ gridColumn: '1 / -1' }}>Le personnel passera immédiatement EN PAUSE. Il restera indisponible jusqu'à ce que vous confirmiez sa reprise.</p>}
          <div className="action"><button type="submit" disabled={envoi || !matricule}>{envoi ? 'Enregistrement…' : sansDuree ? 'Mettre en pause' : 'Enregistrer et valider'}</button></div>
        </form>
      </section>

      <section className="carte">
        <h2>Suivi des congés de l'unité</h2>
        <div className="onglets" role="tablist">
          {titres.map(([valeur, libelle]) => <button key={valeur} type="button" role="tab" aria-selected={onglet === valeur} onClick={() => setOnglet(valeur)}>{libelle}</button>)}
        </div>
        <div className="defilement">
          <table>
            <thead><tr><th>Personnel</th><th>Période / statut</th><th>Motif</th>{estAttente && <th>Planning déjà prévu</th>}<th>Actions</th></tr></thead>
            <tbody>
              {conges.map((c) => <tr key={c.id} className={estPause ? 'ligne-pause' : ''}>
                <td>{c.identifiant ? <strong>{c.identifiant} — </strong> : null}{c.prenom} {c.nom}</td>
                <td>{periode(c)}{estPause && <div><strong>EN PAUSE</strong></div>}</td>
                <td>{c.type}</td>
                {estAttente && <td>{!c.conflits?.length ? '—' : <ul className="conflits">{c.conflits.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul>}</td>}
                <td className="actions">
                  {estAttente ? <><button type="button" aria-label={`Valider la demande de ${c.prenom} ${c.nom}`} onClick={() => decider(c, 'Validé')}>Valider</button><button type="button" className="danger" aria-label={`Refuser la demande de ${c.prenom} ${c.nom}`} onClick={() => decider(c, 'Refusé')}>Refuser</button></>
                    : estPause ? <><label htmlFor={`reprise-${c.id}`}>Date de reprise</label><input id={`reprise-${c.id}`} type="date" max={AUJOURDHUI()} value={datesReprise[c.id] || AUJOURDHUI()} onChange={(e) => setDatesReprise((v) => ({ ...v, [c.id]: e.target.value }))} /><button type="button" onClick={() => reprendre(c)}>Confirmer la reprise</button></>
                      : onglet === 'Validé' ? <button type="button" className="secondaire" aria-label={`Annuler le congé de ${c.prenom} ${c.nom}`} onClick={() => annuler(c)}>Annuler le congé</button> : <span>Reprise enregistrée le {c.dateReprise ? formaterDateFr(c.dateReprise) : '—'}</span>}
                </td>
              </tr>)}
              {!chargement && conges.length === 0 && <tr><td colSpan={estAttente ? 5 : 4} className="vide">{estAttente ? 'Aucune demande en attente' : estPause ? 'Aucun personnel en pause' : onglet === 'Repris' ? 'Aucune reprise enregistrée' : 'Aucun congé validé'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
