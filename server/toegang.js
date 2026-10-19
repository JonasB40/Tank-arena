/*
 * Wie mag lesgeven? (de lesgeverscode en "op deze laptop")
 * Los van de rest, zodat de tests het zonder server kunnen nakijken.
 */
const os = require('os');
const crypto = require('crypto');

function lanIps() {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const nic of list || []) {
      if (nic.family === 'IPv4' && !nic.internal) ips.push(nic.address);
    }
  }
  return ips;
}

/*
 * WIE IS DE LESGEVER? Het dashboard kan de hele klas bevriezen, berichten
 * sturen en het werkblad van een leerling overschrijven. Vroeger kreeg élke
 * browser die "ik ben de lesgever" riep die rechten — één regel in de console
 * van een leerling was genoeg. Nu geldt:
 *  - op de laptop waar de server draait (localhost of zijn eigen netwerkadres)
 *    ben je vanzelf lesgever, je hoeft niets in te typen;
 *  - op elk ander toestel heb je de lesgeverscode nodig. Die staat in het
 *    zwarte servervenster, of je kiest hem zelf met LESGEVER_SLEUTEL (online).
 */
const LESGEVER_SLEUTEL = String(process.env.LESGEVER_SLEUTEL || '').trim()
  || Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.randomInt(31)]).join('');

function opDezeLaptop(socket) {
  const h = socket.handshake;
  // via een proxy (zoals bij Render) komt elk verzoek van "dichtbij": nooit vertrouwen
  if (h.headers && h.headers['x-forwarded-for']) return false;
  const adres = String(h.address || '').replace(/^::ffff:/, '');
  return adres === '127.0.0.1' || adres === '::1' || lanIps().includes(adres);
}

function magLesgeven(socket, sleutel) {
  if (opDezeLaptop(socket)) return true;
  return typeof sleutel === 'string' && sleutel.trim().toUpperCase() === LESGEVER_SLEUTEL.toUpperCase();
}

module.exports = { LESGEVER_SLEUTEL, lanIps, magLesgeven, opDezeLaptop };
