export default function Modal({ estOuvert, onFermer, titre, children }) {
  if (!estOuvert) return null;

  return (
    <div className="modal-overlay-glass" onClick={onFermer}>
      <div className="modal-contenu-glass" role="dialog" aria-modal="true" aria-labelledby="modal-titre-cmire" onClick={(e) => e.stopPropagation()}>
        
        {/* Bouton fermer */}
        <button type="button" className="btn-fermer" onClick={onFermer}>✕</button>

        {/* Titre centré */}
        <div className="modal-entete-glass" style={{ marginBottom: '1.5rem' }}>
          <h2 id="modal-titre-cmire" className="modal-titre" style={{ margin: 0 }}>{titre}</h2>
        </div>

        {/* Contenu du modal */}
        <div className="modal-corps-glass">
          {children}
        </div>
        
      </div>
    </div>
  );
}