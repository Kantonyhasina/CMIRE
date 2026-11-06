class ErreurMetier extends Error {
  // details : liste de messages précis renvoyée au client (ex. agents indisponibles)
  // code    : identifiant lisible par le frontend (ex. 'CONFIRMATION_REQUISE')
  constructor(message, status = 400, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

module.exports = { ErreurMetier };
