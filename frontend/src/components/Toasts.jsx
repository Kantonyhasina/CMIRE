import { useCallback, useState } from 'react';

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const ajouterToast = useCallback((message, type = 'succes') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000); // Disparaît après 4 secondes
  }, []);

  return { toasts, ajouterToast };
}

export function ToastsContainer({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toasts-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'succes' && '✅ '}
          {t.type === 'erreur' && '❌ '}
          {t.type === 'info' && 'ℹ️ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}