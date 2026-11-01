/*
 * Wie mag lesgeven? (de lesgeverscode en "op deze laptop")
 * Los van de rest, zodat de tests het zonder server kunnen nakijken.
 */
const os = require('os');
const crypto = require('crypto');

/* Alle netwerkkaarten van deze laptop met een IPv4-adres: { naam, adres }. */
function netwerkkaarten() {
  const kaarten = [];
  for (const [naam, list] of Object.entries(os.networkInterfaces())) {
    for (const nic of list || []) {
      if (nic.family === 'IPv4' && !nic.internal) kaarten.push({ naam, adres: nic.address });
    }
  }
  return kaarten;
}

/*
 * Op welk adres kunnen de leerlingen de server bereiken? Een laptop heeft vaak
 * ook virtuele netwerkkaarten — WSL, Hyper-V, VirtualBox, Docker, een VPN —
 * en die adressen bestaan alleen binnen de laptop zelf. Ze stonden mee in de
 * lijst: in het servervenster zag je dan twee adressen, en de QR-code op de
 * beamer (die het eerste neemt) kon naar een adres wijzen waar geen enkele
 * iPad bij kan. Nu blijven alleen de echte kaarten over, wifi en ethernet
 * vooraan. Blijft er niets over, dan toch alles: beter een adres te veel dan
 * geen.
 */
const VIRTUEEL = /vethernet|wsl|hyper-v|virtualbox|vbox|vmware|vmnet|docker|virbr|bridge|br-|veth|loopback|tailscale|zerotier|hamachi|tap-|tun|bluetooth|npcap/i;
const VOORKEUR = /wi-?fi|wlan|wireless|draadloos|ethernet|^en\d|^eth\d|^wl/i;
function lanIps() {
  const alle = netwerkkaarten();
  // 169.254.x.x krijgt een kaart die geen netwerk vond: daar kan niemand naartoe
  const echt = alle.filter((k) => !VIRTUEEL.test(k.naam) && !k.adres.startsWith('169.254.'));
  const lijst = echt.length ? echt : alle;
  return lijst
    .sort((a, b) => (VOORKEUR.test(a.naam) ? 0 : 1) - (VOORKEUR.test(b.naam) ? 0 : 1))
    .map((k) => k.adres);
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
  // ook de virtuele kaarten: die zijn net zo goed van deze laptop
  return adres === '127.0.0.1' || adres === '::1' || netwerkkaarten().some((k) => k.adres === adres);
}

function magLesgeven(socket, sleutel) {
  if (opDezeLaptop(socket)) return true;
  return typeof sleutel === 'string' && sleutel.trim().toUpperCase() === LESGEVER_SLEUTEL.toUpperCase();
}

module.exports = { LESGEVER_SLEUTEL, lanIps, magLesgeven, opDezeLaptop };
