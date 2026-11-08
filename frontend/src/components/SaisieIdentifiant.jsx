import { useMemo, useState } from 'react';

// Autocomplétion d'un surveillant par identifiant, avec deux désignations libres.
// Les désignations spéciales sont sélectionnées et enregistrées telles quelles :
// aucune personne n'est recherchée ni attribuée derrière TECH ELB / TECH CNS.
export default function SaisieIdentifiant({
  id,
  valeur,
  agents,
  onSaisie,
  onChoisir,
  optionsSpeciales = [],
  onChoisirSpeciale,
  indisponibilite,
  desactive = false,
}) {
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const identifiantId = id.replace(/[^a-zA-Z0-9_-]/g, '-');

  const options = useMemo(() => {
    const recherche = valeur.trim().toLocaleUpperCase();
    const personnes = recherche
      ? agents
        .filter((agent) => (agent.identifiant || '').toLocaleUpperCase().includes(recherche))
        .sort((a, b) => (a.identifiant || '').localeCompare(b.identifiant || ''))
        .map((agent) => ({ type: 'agent', agent }))
      : [];
    const speciales = optionsSpeciales
      .filter((libelle) => !recherche || libelle.toLocaleUpperCase().includes(recherche))
      .map((libelle) => ({ type: 'special', libelle }));
    return [...personnes, ...speciales];
  }, [agents, optionsSpeciales, valeur]);

  function choisir(option) {
    if (option.type === 'agent') onChoisir(option.agent.matricule);
    else onChoisirSpeciale?.(option.libelle);
    setOuvert(false);
    setIndexActif(0);
  }

  function gererClavier(e) {
    if (e.key === 'ArrowDown' && options.length > 0) {
      e.preventDefault();
      setOuvert(true);
      setIndexActif((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length > 0) {
      e.preventDefault();
      setOuvert(true);
      setIndexActif((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' && ouvert && options.length > 0) {
      e.preventDefault();
      choisir(options[indexActif] || options[0]);
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
        placeholder="Identifiant / TECH…"
        aria-label={id}
        aria-autocomplete="list"
        aria-expanded={ouvert && options.length > 0}
        aria-controls={`${identifiantId}-suggestions`}
        onFocus={() => setOuvert(true)}
        onChange={(e) => {
          onSaisie(e.target.value.toLocaleUpperCase());
          setIndexActif(0);
          setOuvert(true);
        }}
        onKeyDown={gererClavier}
        onBlur={() => setOuvert(false)}
      />

      {ouvert && options.length > 0 && (
        <div id={`${identifiantId}-suggestions`} className="suggestions-identifiant" role="listbox">
          {options.map((option, index) => {
            if (option.type === 'special') {
              return (
                <button
                  key={`special-${option.libelle}`}
                  type="button"
                  role="option"
                  aria-selected={index === indexActif}
                  className={`suggestion-speciale ${index === indexActif ? 'suggestion-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choisir(option)}
                >
                  <strong>{option.libelle}</strong>
                  <small>Désignation libre · aucun technicien attribué par le système</small>
                </button>
              );
            }

            const agent = option.agent;
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
                onClick={() => choisir(option)}
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
