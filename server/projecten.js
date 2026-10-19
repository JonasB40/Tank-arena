/*
 * Projectopslag: de blokken van elke leerling onder een code (TANK-XXXX).
 * Zo kan een leerling op elk toestel — ook in les 2 — verder waar hij was.
 *
 * PRIVACY. In dit bestand staan de voornamen van kinderen en hun werk. Dat
 * bewaren we niet langer dan nodig: een project dat BEWAAR_DAGEN lang niet
 * meer gebruikt is, verdwijnt vanzelf (standaard 90 dagen; met de
 * omgevingsvariabele PROJECT_BEWAARDAGEN kies je zelf, 0 = nooit wissen).
 * De lesgever kan ook alles in één keer wissen, onderaan het klasrapport.
 */
const path = require('path');
const fs = require('fs');

/* De tests geven een eigen bestand mee (PROJECT_BESTAND): zo raakt "npm test"
   nooit de echte projecten van je leerlingen aan. */
const PROJECT_BESTAND = process.env.PROJECT_BESTAND || path.join(__dirname, '..', 'projecten.json');
const BEWAAR_DAGEN = (() => {
  const ingesteld = String(process.env.PROJECT_BEWAARDAGEN ?? '').trim();
  const n = Number(ingesteld);
  return ingesteld === '' || !Number.isFinite(n) || n < 0 ? 90 : n;
})();
const DAG = 24 * 60 * 60 * 1000;

/* Zonder prototype: een code als "__proto__" of "constructor" is dan gewoon
   een onbekende code, en geen ingebouwde eigenschap van elk object. */
const projecten = Object.create(null);

/* Inlezen bij het starten van de server (en niet al bij het inladen van dit
   bestand: dan las elke test de projecten van je leerlingen mee in). */
function laadProjecten() {
  let ruw;
  try { ruw = fs.readFileSync(PROJECT_BESTAND, 'utf8'); } catch { return; /* nog geen bestand */ }
  try {
    Object.assign(projecten, JSON.parse(ruw));
  } catch {
    /* Een kapot bestand (stroom weg tijdens het schrijven) NIET stilletjes
       vervangen door een leeg: dan zou de eerstvolgende bewaarbeurt alle
       projecten van de klas wissen. We zetten het opzij, dan is er nog iets
       te redden. */
    const reserve = PROJECT_BESTAND.replace(/\.json$/, `-kapot-${Date.now()}.json`);
    try { fs.copyFileSync(PROJECT_BESTAND, reserve); } catch { /* dan maar niet */ }
    console.log(`   ⚠ projecten.json was beschadigd — bewaard als ${path.basename(reserve)}`);
  }
  // een project zonder datum (van een oude versie) krijgt de volle bewaartijd
  for (const p of Object.values(projecten)) {
    if (p && !Number.isFinite(p.bijgewerkt)) p.bijgewerkt = Date.now();
  }
}

/*
 * Wat al BEWAAR_DAGEN niet meer gebruikt is, gaat weg — ook een opzijgezet
 * kapot bestand. Geeft terug hoeveel projecten er verdwenen.
 */
function ruimOudeProjectenOp(nu = Date.now()) {
  if (!BEWAAR_DAGEN) return 0;
  const grens = nu - BEWAAR_DAGEN * DAG;
  let weg = 0;
  for (const [code, p] of Object.entries(projecten)) {
    if (!p || p.bijgewerkt < grens) { delete projecten[code]; weg++; }
  }
  if (weg) bewaarProjectenOpSchijf();
  const map = path.dirname(PROJECT_BESTAND);
  const basis = path.basename(PROJECT_BESTAND, '.json');
  try {
    for (const naam of fs.readdirSync(map)) {
      const m = naam.match(new RegExp(`^${basis}-kapot-(\\d+)\\.json$`));
      if (m && Number(m[1]) < grens) fs.rmSync(path.join(map, naam), { force: true });
    }
  } catch { /* geen map te lezen: niets op te ruimen */ }
  return weg;
}

/* Alles weg (de knop op het dashboard). Meteen op schijf, niet pas straks. */
function wisAlleProjecten() {
  const aantal = Object.keys(projecten).length;
  for (const code of Object.keys(projecten)) delete projecten[code];
  if (schrijfTimer) { clearTimeout(schrijfTimer); schrijfTimer = null; }
  schrijfProjectenNuMetZekerheid();
  return aantal;
}

const aantalProjecten = () => Object.keys(projecten).length;

/* Bij het starten: inlezen, opruimen, en daarna elke zes uur opnieuw kijken
   (een server die weken blijft draaien, ruimt dan ook op). */
function startProjectOpslag() {
  laadProjecten();
  const weg = ruimOudeProjectenOp();
  if (weg) console.log(`   🧹 ${weg} project${weg === 1 ? '' : 'en'} opgeruimd: ${BEWAAR_DAGEN} dagen niet meer gebruikt.`);
  setInterval(ruimOudeProjectenOp, 6 * 60 * 60 * 1000).unref();
}

/*
 * Wegschrijven gebeurt hooguit om de anderhalve seconde, maar wél gegarandeerd.
 * Vroeger schoof elke nieuwe bewaarbeurt het schrijven weer anderhalve seconde
 * op. Met een klas die volop bouwt komt er bijna elke seconde iets binnen,
 * en dan werd het bestand zolang de les liep nooit geschreven — sloot je het
 * zwarte venster, dan was het werk van de hele les weg.
 *
 * Het schrijven zelf gebeurt op de achtergrond. Synchroon schrijven liet het
 * hele spel wachten op de schijf — en op een Windows-laptop kan een
 * virusscanner of OneDrive een vers bestand even vasthouden. In een test met
 * een volle klas stond de wereld daardoor één keer een derde seconde stil.
 * Alleen bij het afsluiten schrijven we synchroon: dan moet het er gewoon nog
 * op staan voor het venster dichtgaat.
 */
let schrijfTimer = null;
let bezigMetSchrijven = false;
let nogEensSchrijven = false;
const TIJDELIJK_BESTAND = PROJECT_BESTAND + '.tmp';

function meldSchrijffout(err) { console.log(`   ⚠ Projecten bewaren mislukt: ${err.message}`); }

async function schrijfProjecten() {
  schrijfTimer = null;
  if (bezigMetSchrijven) { nogEensSchrijven = true; return; }
  bezigMetSchrijven = true;
  const inhoud = JSON.stringify(projecten);
  try {
    // eerst naar een tijdelijk bestand en dan in één keer omwisselen: valt de
    // stroom weg tijdens het schrijven, dan blijft de vorige versie heel
    await fs.promises.writeFile(TIJDELIJK_BESTAND, inhoud);
    await fs.promises.rename(TIJDELIJK_BESTAND, PROJECT_BESTAND);
  } catch {
    // OneDrive houdt het bestand soms even vast; dan rechtstreeks schrijven
    try { await fs.promises.writeFile(PROJECT_BESTAND, inhoud); } catch (err) { meldSchrijffout(err); }
  }
  bezigMetSchrijven = false;
  if (nogEensSchrijven) { nogEensSchrijven = false; bewaarProjectenOpSchijf(); }
}
function bewaarProjectenOpSchijf() {
  if (schrijfTimer) return;   // er staat al een schrijfbeurt klaar
  schrijfTimer = setTimeout(schrijfProjecten, 1500);
}
function schrijfProjectenNuMetZekerheid() {
  try {
    fs.writeFileSync(TIJDELIJK_BESTAND, JSON.stringify(projecten));
    fs.renameSync(TIJDELIJK_BESTAND, PROJECT_BESTAND);
  } catch {
    try { fs.writeFileSync(PROJECT_BESTAND, JSON.stringify(projecten)); } catch (err) { meldSchrijffout(err); }
  }
}

/* Sluit je het venster of druk je Ctrl+C, dan eerst nog wegschrijven wat er
   klaarstaat (server.js roept dit aan bij het afsluiten). */
function schrijfWegAlsErIetsKlaarstaat() {
  if (schrijfTimer || bezigMetSchrijven || nogEensSchrijven) schrijfProjectenNuMetZekerheid();
}

const CODE_TEKENS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // geen 0/O/1/I-verwarring
const CODE_VORM = /^TANK-[A-Z0-9]{4}$/;
function nieuweProjectCode() {
  let code;
  do {
    code = 'TANK-' + Array.from({ length: 4 }, () => CODE_TEKENS[Math.floor(Math.random() * CODE_TEKENS.length)]).join('');
  } while (projecten[code]);
  return code;
}

module.exports = {
  BEWAAR_DAGEN, CODE_VORM, PROJECT_BESTAND, aantalProjecten, bewaarProjectenOpSchijf, laadProjecten,
  nieuweProjectCode, projecten, ruimOudeProjectenOp, schrijfWegAlsErIetsKlaarstaat, startProjectOpslag, wisAlleProjecten,
};
