class ErreurMetier extends Error {
  // `details` : liste de messages précis renvoyée au client (ex. agents indisponibles)
  constructor(message, status = 400, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

module.exports = { ErreurMetier };
