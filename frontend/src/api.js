// Couche d'accès à l'API (boundary -> control)
const BASE = import.meta.env.VITE_API_URL || '';

let surSessionExpiree = () => {};
export function definirSurSessionExpiree(fonction) {
  surSessionExpiree = fonction;
}

export class ErreurApi extends Error {
  constructor(message, status, details = []) {
    super(message);
    this.status = status;
    this.details = details; // précisions renvoyées par l'API (ex. agents indisponibles)
  }
}

async function envoyer(chemin, { methode = 'GET', corps, token }) {
  try {
    return await fetch(BASE + chemin, {
      method: methode,
      headers: {
        ...(corps ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new ErreurApi("Serveur injoignable. Vérifiez que l'API est démarrée.", 0);
  }
}

async function exigerSucces(reponse, token) {
  if (reponse.ok) return;
  const donnees = await reponse.json().catch(() => null);
  // Un 401 sur une requête authentifiée = jeton expiré, invalide ou compte supprimé
  if (reponse.status === 401 && token) surSessionExpiree();
  throw new ErreurApi(donnees?.message || `Erreur ${reponse.status}`, reponse.status, donnees?.details);
}

export async function appeler(chemin, options = {}) {
  const reponse = await envoyer(chemin, options);
  await exigerSucces(reponse, options.token);
  return reponse.status === 204 ? null : reponse.json().catch(() => null);
}

// Récupère un fichier (ex. PDF) en envoyant le jeton ; renvoie un Blob
export async function telechargerFichier(chemin, { token } = {}) {
  const reponse = await envoyer(chemin, { token });
  await exigerSucces(reponse, token);
  return reponse.blob();
}
