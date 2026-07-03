module.exports = {
  // Orígens addicionals que poden accedir al dev server (Next 16 bloqueja
  // cross-origin per defecte). Afegir aquí la IP LAN del PC del DM perquè
  // la tablet pugui carregar l'app; 127.0.0.1 permet provar dos orígens en local.
  allowedDevOrigins: ['192.168.68.102', '127.0.0.1'],
}