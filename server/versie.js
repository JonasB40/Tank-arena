/*
 * Welke versie draait er, en is de code aangepast sinds het starten?
 */
const path = require('path');
const fs = require('fs');

/*
 * "Waarom zie ik mijn wijziging niet?" — omdat node de code alleen bij het
 * STARTEN inleest. Pas je iets aan (of haal je een nieuwe versie op) terwijl
 * de server draait, dan speelt de klas verder met de oude regels: oude
 * aantallen vormen, oude snelheden, oude tanks. De browser verversen helpt
 * niet, want dat is de andere helft.
 *
 * Daarom kijkt de server zelf of zijn eigen bestanden nieuwer zijn dan het
 * moment waarop hij begon. Zo ja, dan zegt het lesgeversscherm en de beamer
 * het gewoon: herstarten.
 */
const GESTART_OM = Date.now();
/*
 * Welke versie draait er eigenlijk? Node leest zijn code alleen bij het
 * starten, dus als je vergeet te herstarten speel je met oude regels. Daarom
 * krijgt elke browser dit stempeltje te zien: het tijdstip waarop het
 * nieuwste bronbestand voor het laatst is opgeslagen. Staat daar een oude
 * datum, dan is herstarten het eerste wat je moet doen.
 */
function codeStempel() {
  let nieuwste = 0;
  const kijk = (pad) => {
    try {
      const st = fs.statSync(pad);
      if (st.isDirectory()) { for (const f of fs.readdirSync(pad)) kijk(path.join(pad, f)); return; }
      nieuwste = Math.max(nieuwste, st.mtimeMs);
    } catch { /* bestaat niet meer */ }
  };
  [path.join(__dirname, '..', 'server.js'), __dirname, path.join(__dirname, '..', 'public', 'js')].forEach(kijk);
  const d = new Date(Math.min(nieuwste, GESTART_OM));
  const twee = (n) => String(n).padStart(2, '0');
  return `${twee(d.getDate())}/${twee(d.getMonth() + 1)} ${twee(d.getHours())}:${twee(d.getMinutes())}`;
}
const BRONBESTANDEN = [
  path.join(__dirname, '..', 'server.js'),
  __dirname,   // de modules van de server zelf
  path.join(__dirname, '..', 'public', 'js'),
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'public', 'lesgever.html'),
];
/* Hooguit om de tien seconden opnieuw op de schijf kijken. Elke leerling die
   binnenkwam en elke update van het dashboard (om de 1,5 s) liep anders alle
   bestanden af — in een map die OneDrive ook nog eens bijhoudt. */
let gewijzigdCache = { tot: 0, waarde: 0 };
function codeGewijzigdNaStart() {
  if (Date.now() < gewijzigdCache.tot) return gewijzigdCache.waarde;
  gewijzigdCache = { tot: Date.now() + 10000, waarde: kijkOfCodeGewijzigdIs() };
  return gewijzigdCache.waarde;
}
function kijkOfCodeGewijzigdIs() {
  let nieuwste = 0;
  const kijk = (pad) => {
    try {
      const st = fs.statSync(pad);
      if (st.isDirectory()) { for (const f of fs.readdirSync(pad)) kijk(path.join(pad, f)); return; }
      nieuwste = Math.max(nieuwste, st.mtimeMs);
    } catch { /* bestand bestaat niet meer */ }
  };
  BRONBESTANDEN.forEach(kijk);
  return nieuwste > GESTART_OM + 1000 ? Math.round((nieuwste - GESTART_OM) / 60000) : 0;
}

module.exports = { codeGewijzigdNaStart, codeStempel };
