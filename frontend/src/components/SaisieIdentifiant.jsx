import { useMemo, useState } from 'react';

// Champ d'autocomplétion : le texte affiché est l'identifiant de connexion,
// mais la sélection renvoie le matricule attendu par l'API.
export default function SaisieIdentifiant({
  id,
  valeur,
  agents,
  onSaisie,
  onChoisir,
  indisponibilite,
  desactive = false,
}) {
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const identifiantId = id.replace(/[^a-zA-Z0-9_-]/g, '-');

  const suggestions = useMemo(() => {
    const recherche = valeur.trim().toLocaleUpperCase();
    if (!recherche) return [];

    return agents
      .filter((agent) => (agent.identifiant || '').toLocaleUpperCase().includes(recherche))
      .sort((a, b) => (a.identifiant || '').localeCompare(b.identifiant || ''));
  }, [agents, valeur]);

  function choisir(agent) {
    onChoisir(agent.matricule);
    setOuvert(false);
    setIndexActif(0);
  }

  function gererClavier(e) {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOuvert(true);
      setIndexActif((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setOuvert(true);
      setIndexActif((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && ouvert && suggestions.length > 0) {
      e.preventDefault();
      choisir(suggestions[indexActif] || suggestions[0]);
    } else if (e.key === 'Escape') {
      setOuvert(false);
    }
  }

  return (
    <div className="saisie-identifiant">
      <input
        id={identifiantId}
        type="text"
        value={valeur}
        disabled={desactive}
        autoComplete="off"
        spellCheck="false"
        placeholder="Identifiant…"
        aria-label={id}
        aria-autocomplete="list"
        aria-expanded={ouvert && suggestions.length > 0}
        aria-controls={`${identifiantId}-suggestions`}
        onFocus={() => setOuvert(true)}
        onChange={(e) => {
          onSaisie(e.target.value.toLocaleUpperCase());
          setIndexActif(0);
          setOuvert(true);
        }}
        onKeyDown={gererClavier}
        onBlur={() => {
          // Le délai n'est pas nécessaire : le clic sur une suggestion utilise
          // onMouseDown avec preventDefault pour conserver le focus.
          setOuvert(false);
        }}
      />

      {ouvert && valeur.trim() !== '' && (
        <div id={`${identifiantId}-suggestions`} className="suggestions-identifiant" role="listbox">
          {suggestions.length === 0 ? (
            <div className="suggestion-vide" role="status">Aucun identifiant correspondant</div>
          ) : suggestions.map((agent, index) => {
            const conflit = indisponibilite?.(agent);
            const nom = `${agent.prenom} ${agent.nom}`.trim();
            return (
              <button
                key={agent.matricule}
                type="button"
                role="option"
                aria-selected={index === indexActif}
                disabled={Boolean(conflit)}
                title={conflit?.detail || undefined}
                className={index === indexActif ? 'suggestion-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(agent)}
              >
                <strong>{agent.identifiant}</strong>
                <span>{nom}</span>
                {conflit && <small>Indisponible</small>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
