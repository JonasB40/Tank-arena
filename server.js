/*
 * STEMazing Tank Arena — server (diep.io-geïnspireerd, voor workshops)
 *
 * De leerling programmeert zijn tank client-side met Scratch-achtige blokken;
 * de browser stuurt enkel "intents" (beweegrichting, richthoek, schiet) naar
 * hier. Deze server is de scheidsrechter: hij beweegt kogels, telt schade,
 * beheert vormen/obstakels, AI-tegenstanders, XP/levels en upgrades.
 *
 * Les 1: elke leerling speelt in zijn eigen solo-arena tegen de computer.
 * Les 2: iedereen samen in één gedeelde arena (met teams).
 *
 * Dit bestand start alles. De onderdelen staan in de map server/:
 *   regels.js       de spelregels: getallen en formules uit diep.io
 *   wereld.js       arena's, teams, rondes, vormen en tanks
 *   robots.js       de computertegenstanders
 *   spellus.js      30x per seconde: bewegen, schieten, botsen
 *   verzenden.js    20x per seconde de wereld naar elke browser
 *   verbindingen.js wat een browser kan vragen (meedoen, rijden, bewaren)
 *   klaslokaal.js   het lesgeversdashboard
 *   projecten.js    de projectcodes van de leerlingen
 *   toegang.js      wie lesgever is
 *   staat.js        wat alle onderdelen delen
 *   versie.js, klok.js
 */
const express = require('express');
const http = require('http');
const path = require('path');
const { staat } = require('./server/staat');
const { lanIps, LESGEVER_SLEUTEL } = require('./server/toegang');
const { meldFout } = require('./server/klok');
const { schrijfWegAlsErIetsKlaarstaat, startProjectOpslag } = require('./server/projecten');
const { startVerbindingen } = require('./server/verbindingen');
const { startKlaslokaal } = require('./server/klaslokaal');
const { startSpellus } = require('./server/spellus');
const { startVerzenden } = require('./server/verzenden');

const app = express();
const server = http.createServer(app);
/*
 * Pakketjes gecomprimeerd versturen. De wereld gaat twintig keer per seconde
 * naar elke leerling; met een volle klas in de arena liep dat zonder compressie
 * op tot zo'n 50 Mbit/s over de schoolwifi. Gecomprimeerd is een pakketje vier
 * keer kleiner (gemeten: 14,7 KB → 3,6 KB), en het inpakken gebeurt buiten de
 * spel-lus. Niveau 1 = snel inpakken; kleine berichtjes laten we zoals ze zijn.
 */
staat.io = require('socket.io')(server, {
  perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 } },
});

const PORT = process.env.PORT || 3000;

/*
 * Onze eigen bestanden nooit uit de cache serveren zonder te controleren.
 * Zonder dit blijft een browser een oude lesstap of oud blok tonen tot je met
 * Ctrl+F5 forceert — lastig voor jou, en onhaalbaar met een klas Chromebooks
 * die je niet één voor één kan verversen. De server draait op dezelfde laptop,
 * dus die controle kost niets. (Blockly zelf verandert niet en mag wél lang
 * in de cache blijven staan.)
 */
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));
app.use('/blockly', express.static(path.join(__dirname, 'node_modules', 'blockly'), { maxAge: '7d' }));
app.get('/beamer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'beamer.html')));
app.get('/lesgever', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lesgever.html')));
app.get('/info', (req, res) => res.json({ ips: lanIps(), port: PORT }));

/* Sluit je het venster of druk je Ctrl+C, dan eerst nog wegschrijven wat er
   klaarstaat. (SIGHUP = het venster dichtklikken op Windows, SIGTERM = een
   herstart bij een online server.) */
for (const sein of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sein, () => {
    schrijfWegAlsErIetsKlaarstaat();
    process.exit(0);
  });
}
/* Eén fout mag nooit de hele klas platleggen: opschrijven en doordraaien. */
process.on('uncaughtException', (err) => meldFout('server', err));

startProjectOpslag();
startVerbindingen();
startKlaslokaal();
startSpellus();
startVerzenden();

/* ------------------------------------------------------------------ */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('');
    console.log('  ============================================');
    console.log('   De server kon niet starten!');
    console.log('  ============================================');
    console.log('');
    console.log(`   Poort ${PORT} is al in gebruik door een ander programma.`);
    console.log('   Meestal komt dit doordat de Tank Arena al in een ander');
    console.log('   zwart venster draait (misschien vergeten te sluiten?).');
    console.log('');
    console.log('   Wat te doen:');
    console.log('   1. Zoek en sluit dat andere zwarte venster, of');
    console.log('   2. Herstart je computer, of');
    console.log('   3. Vraag een begeleider om hulp.');
    console.log('');
    process.exit(1);
  }
  // elke andere reden waarom de server niet kan starten: zeggen en stoppen
  // (niet gooien — het vangnet hierboven zou hem anders half laten draaien)
  console.log(`\n   De server kon niet starten: ${err.message}\n`);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ============================================');
  console.log('   STEMazing Tank Arena draait!');
  console.log('  ============================================');
  console.log('');
  console.log('   Leerlingen spelen mee via:');
  for (const ip of lanIps()) console.log(`     http://${ip}:${PORT}`);
  console.log('');
  console.log(`   Jouw dashboard:        http://localhost:${PORT}/lesgever`);
  console.log(`   Beamer (groot scherm): http://localhost:${PORT}/beamer`);
  console.log('');
  console.log(`   Lesgeverscode:         ${LESGEVER_SLEUTEL}`);
  console.log('   (alleen nodig als je het dashboard op een ánder toestel opent;');
  console.log('    op deze laptop werkt het zonder code)');
  console.log('');
});
