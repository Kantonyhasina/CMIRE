import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appeler, definirSurSessionExpiree, telechargerFichier } from '../api.js';

const CLE_SESSION = 'cmire_session';
const AuthContext = createContext(null);

function lireSession() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_SESSION));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(lireSession);

  const deconnecter = useCallback(() => {
    sessionStorage.removeItem(CLE_SESSION);
    setSession(null);
  }, []);

  // Si l'API répond 401 (jeton expiré), on referme la session
  useEffect(() => {
    definirSurSessionExpiree(deconnecter);
  }, [deconnecter]);

  const connecter = useCallback(async (identifiant, motDePasse) => {
    const reponse = await appeler('/api/auth/login', {
      methode: 'POST',
      corps: { identifiant, motDePasse },
    });
    sessionStorage.setItem(CLE_SESSION, JSON.stringify(reponse));
    setSession(reponse);
    return reponse.utilisateur;
  }, []);

  // Appel d'API qui ajoute automatiquement le jeton de la session
  const api = useCallback(
    (chemin, options = {}) => appeler(chemin, { ...options, token: session?.token }),
    [session]
  );

  const telecharger = useCallback(
    (chemin) => telechargerFichier(chemin, { token: session?.token }),
    [session]
  );

  const valeur = useMemo(
    () => ({
      utilisateur: session?.utilisateur ?? null,
      estConnecte: Boolean(session),
      connecter,
      deconnecter,
      api,
      telecharger,
    }),
    [session, connecter, deconnecter, api, telecharger]
  );

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexte = useContext(AuthContext);
  if (!contexte) throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  return contexte;
}
