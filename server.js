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
 */
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { KLASSEN, UPGRADE_BOOM, TIER_LEVEL } = require('./public/js/klassen.js');

const app = express();
const server = http.createServer(app);
/*
 * Pakketjes gecomprimeerd versturen. De wereld gaat twintig keer per seconde
 * naar elke leerling; met een volle klas in de arena liep dat zonder compressie
 * op tot zo'n 50 Mbit/s over de schoolwifi. Gecomprimeerd is een pakketje vier
 * keer kleiner (gemeten: 14,7 KB → 3,6 KB), en het inpakken gebeurt buiten de
 * spel-lus. Niveau 1 = snel inpakken; kleine berichtjes laten we zoals ze zijn.
 */
const io = require('socket.io')(server, {
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

/* ------------------------------------------------------------------ */
/* Constanten                                                          */
/* ------------------------------------------------------------------ */
/*
 * Twee arenamaten. Solo speelt één leerling met een handvol robots — daar is
 * een compacte arena juist prettig. In de gedeelde arena staan er twaalf
 * tanks tegelijk in, en dan is 3200x2000 véél te krap: je botst voortdurend
 * op elkaar en op de teamzones. De maat hieronder geldt voor beide teamopzetten,
 * zodat de wereld niet plots verspringt als de lesgever van 2 naar 4 teams gaat.
 */
const ARENA = { w: 3200, h: 2000 };            // solo
/*
 * Langer, niet hoger. De hoogte was al goed, maar je stond te snel middenin
 * het speelveld — en juist dáár, in het nest, liggen de vijfhoeken die het
 * meeste opleveren. Nu moet je er echt naartoe rijden, langs de crashers.
 */
/*
 * De gedeelde arena is vier keer zo groot als daarvoor (11000x5200). Met twaalf
 * tanks in een kleiner veld liep je binnen tien seconden weer tegen dezelfde
 * tegenstander aan en was er nergens rust om te groeien. Het aantal vormen
 * schaalt mee met de oppervlakte, dus er valt ook vier keer zoveel te schieten.
 * Elkaar terugvinden doe je met de minikaart.
 */
const GEDEELDE_ARENA = { w: 22000, h: 10400 };   // samen spelen (2 of 4 teams)
const TANK_RADIUS = 22;
const TANKS_IN_ARENA = 12;  // samen spelen: altijd 12 tanks in het veld (6 per team)
const RECOIL_KRACHT = 26;   // hoe hard één 'recoil-eenheid' van de wiki duwt
/*
 * Tanks groeien met hun level, net als in diep.io: elke level maal 1,01. Een
 * tank van level 45 is dus anderhalf keer zo groot als een beginner — je ziet
 * meteen wie er al een tijdje bezig is. De wiki tekent precies zo: straal 50
 * op level 1, 57 op 15, 67 op 30 en 77 op 45. https://diepwiki.io/#/formulas/
 */
// één keer per level uitrekenen: dit wordt honderden keren per tik gevraagd
const STRAAL_PER_LEVEL = [];
function straalVan(t) {
  const lvl = Math.max(1, t.level || 1);
  return STRAAL_PER_LEVEL[lvl] || (STRAAL_PER_LEVEL[lvl] = TANK_RADIUS * Math.pow(1.01, lvl - 1));
}
const BULLET_SPEED = 420;
const BULLET_LIFE = 1800;      // ms
const RESPAWN_MS = 2500;
const MAX_SPELERS = 40;
const MAX_STAT = 7;            // max punten per eigenschap (zoals diep.io)
const SPAWN_BESCHERMING_MS = 5000; // onschendbaar na (re)spawn in de gedeelde arena

/* De 8 eigenschappen in exact dezelfde volgorde als diep.io (toets [1]..[8]):
   1 Health Regen, 2 Max Health, 3 Body Damage, 4 Bullet Speed,
   5 Bullet Penetration, 6 Bullet Damage, 7 Reload, 8 Movement Speed. */
const STAT_LIJST = [
  'levensregen', 'maxlevens', 'botsschade', 'kogelsnelheid',
  'kogelpantser', 'kogelschade', 'herladen', 'snelheid',
];
function legeStats() {
  const s = {};
  for (const naam of STAT_LIJST) s[naam] = 0;
  return s;
}

/* Robot-gedrag: wanneer jagen ze, en wanneer geven ze het op? */
const DETECTIE_R = 360;   // pas vanaf hier merkt een robot je op en gaat jagen
const ONTSNAP_R = 760;    // raak je verder dan dit, dan geeft hij op → je kunt ontsnappen
const AGGRO_MS = 5000;    // hoe lang hij blijft jagen nadat hij je uit het oog verliest

const KLEUREN = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#ff7bd5', '#1abc9c', '#2d3436', '#ffffff'];

/*
 * Polygons zoals in diep.io (https://diepio.fandom.com/wiki/Polygons):
 * de XP per vorm is vast (10/25/130/1500/3000). Hoe taaier, hoe meer XP —
 * dus je levelt vooral van vijfhoeken en de zeldzame zeshoek/alfa, niet van
 * eindeloos kleine vierkantjes spammen. Muren zijn dekking, geen XP-bron.
 */
const VORM_TYPES = {
  /*
   * Levenspunten volgens diep.io. De wiki geeft ze als "aantal schoten van een
   * starttank" (die doet 7 schade): vierkant 2 schoten, driehoek 5, vijfhoek
   * 22. Onze vormen waren 2 tot 4 keer zo taai, waardoor farmen aanvoelde als
   * ploeteren. Zeshoek = de helft van een alfa, zoals de wiki zegt.
   */
  vierkant: { r: 18, hp: 10, punten: 10, kleur: '#FFE869', botsschade: 8 },
  driehoek: { r: 19, hp: 30, punten: 25, kleur: '#FC7677', botsschade: 8 },
  vijfhoek: { r: 30, hp: 100, punten: 130, kleur: '#4C6FF0', botsschade: 12 },   // duidelijk blauw
  // De drie waardevolle vormen moeten in één oogopslag uit elkaar te houden
  // zijn: vijfhoek helder blauw, zeshoek lichtblauw, alfa donkerblauw. Ze
  // hadden bijna dezelfde tint terwijl ze 12x en 23x zoveel punten geven.
  zeshoek: { r: 46, hp: 1500, punten: 1500, kleur: '#7ED8F2', botsschade: 16 },  // lichtblauw
  alfa: { r: 66, hp: 3000, punten: 3000, kleur: '#4c3fb8', botsschade: 20 },     // donkerblauw, heel taai
  muur: { r: 70, hp: 500, punten: 4, kleur: '#7f8c9b', blokkeert: true, botsschade: 0 },
  /*
   * Crashers: de roze driehoekjes die het nest bewaken. De wiki zegt het
   * onomwonden — ze bestaan "to prevent experience farming from being too
   * easy". Ze jagen op je zodra je te dicht bij de dikke vormen komt.
   * Waarden van https://diepio.fandom.com/wiki/Crashers.
   */
  crasher: { r: 14, hp: 10, punten: 15, kleur: '#f177dd', botsschade: 14, jaagt: true },
  grotecrasher: { r: 20, hp: 30, punten: 25, kleur: '#f177dd', botsschade: 18, jaagt: true },
};

/* Wat de browser van elke vormsoort moet weten om hem te tekenen. */
const VORM_INFO = Object.fromEntries(Object.entries(VORM_TYPES).map(([naam, d]) => [
  naam, { r: d.r, kleur: d.kleur, maxHp: d.hp, jaagt: !!d.jaagt },
]));

/*
 * AI-profielen bepalen alleen hoe AGRESSIEF/scherp een robot is
 * (snelheid, reactietijd, schietafstand). De KRACHT (hp, schade) hangt
 * af van het level van de robot — zie maakAiTank.
 */
/*
 * Namen voor de robots. Met "Rood makkelijk · lvl 21" was elke tegenstander een
 * nummertje; met een naam wordt het een figuur waar je iets van vindt — en dat
 * maakt samen spelen tegen de computer een stuk leuker. Het level staat er
 * bewust niet bij: hoe gevaarlijk een robot is, zie je aan zijn vorm en klasse.
 */
const ROBOT_NAMEN = [
  'Trumpie', 'Elon M', 'Bill Bytes', 'Mark Zuck', 'Kanye Tank',
  'Pindakaas', 'Patatje Oorlog', 'Speculoos', 'Spruitje', 'Kroketje',
  'Blikken Beer', 'Rammelkast', 'Turbo Truus', 'Professor Plof', 'Tankie McTankface',
];

/* Een naam die in deze arena nog vrij is (anders rijden er twee Trumpies rond). */
function vrijeRobotNaam(room) {
  const bezet = new Set([...room.tanks.values()].map((t) => t.robotNaam).filter(Boolean));
  const vrij = ROBOT_NAMEN.filter((n) => !bezet.has(n));
  const lijst = vrij.length ? vrij : ROBOT_NAMEN;
  return lijst[Math.floor(Math.random() * lijst.length)];
}

const AI_PROFIELEN = {
  makkelijk: { snelheid: 110, reactieMs: 900, herlaadMs: 900, schietAfstand: 360, kleur: '#e8a0b4' },
  gemiddeld: { snelheid: 145, reactieMs: 560, herlaadMs: 620, schietAfstand: 410, kleur: '#c75b7a' },
  moeilijk: { snelheid: 180, reactieMs: 320, herlaadMs: 440, schietAfstand: 470, kleur: '#8e1e3f' },
};

/*
 * Spelniveaus (de leerling kiest 😊/😐/😈 in het startmenu): hoeveel robots,
 * hoe snel erbij, welk gedrag, en hoe sterk. De eerste robot verschijnt pas
 * na een rustige opwarmtijd.
 */
const OPWARM_MS = 45000;
const NIVEAUS = {
  makkelijk: { profiel: 'makkelijk', max: 2, perScore: 500, spreidLaag: -4, spreidHoog: 0, eliteKans: 0 },
  gemiddeld: { profiel: 'gemiddeld', max: 3, perScore: 320, spreidLaag: -3, spreidHoog: 3, eliteKans: 0.12 },
  moeilijk: { profiel: 'moeilijk', max: 5, perScore: 240, spreidLaag: -1, spreidHoog: 6, eliteKans: 0.22 },
};

/*
 * Welke klasse krijgt een robot? Hoe hoger zijn level, hoe zwaarder het
 * geschut — en vanaf level 30 duiken er ook tegenstanders op met drones of
 * valstrikken in plaats van gewone kogels, zodat je niet altijd hetzelfde
 * soort vijand tegenkomt.
 */
const ROBOT_KLASSEN = {
  45: ['octotank', 'vernietiger', 'overheer', 'dritrapper', 'annihilator', 'drietwin', 'auto5',
       'necromancer', 'autogunner', 'hybride', 'skimmer', 'battleship', 'autosmasher'],
  30: ['driedubbel', 'gunner', 'opzichter', 'trapper', 'jager', 'auto3'],
  15: ['twin', 'machinegeweer', 'flankwacht', 'sluipschutter'],
};
const robotKlasseVoorLevel = (lvl) => {
  if (process.env.TESTKLASSE) return process.env.TESTKLASSE; // alleen voor tests
  for (const grens of [45, 30, 15]) {
    if (lvl >= grens) {
      const lijst = ROBOT_KLASSEN[grens];
      return lijst[Math.floor(Math.random() * lijst.length)];
    }
  }
  return 'basis';
};
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/*
 * De échte diep.io-tabel (https://diepio.fandom.com/wiki/Levels): hoeveel
 * punten je totaal nodig hebt voor elk level. Onze eigen formule week hier
 * flink van af, waardoor levelen anders aanvoelde dan in het spel dat de
 * kinderen kennen. Ter controle: één vijfhoek (130 XP) = level 7 met 6
 * statpunten, precies zoals in diep.io. Level 15 haal je bij 787 punten
 * (zes vijfhoeken), level 30 bij 6184 en level 45 bij 23536.
 */
const XP_TABEL = [
  0, 4, 13, 28, 50, 78, 113, 157, 211, 275,
  350, 437, 538, 655, 787, 938, 1109, 1301, 1516, 1757,
  2026, 2325, 2658, 3026, 3433, 3883, 4379, 4925, 5525, 6184,
  6907, 7698, 8537, 9426, 10368, 11367, 12426, 13549, 14739, 16000,
  17337, 18754, 20256, 21849, 23536,
];
const MAX_LEVEL = XP_TABEL.length;                 // 45
function xpVoorLevel(l) { return XP_TABEL[Math.max(1, Math.min(MAX_LEVEL, l)) - 1]; }
function levelVan(score) {
  let l = 1;
  while (l < MAX_LEVEL && score >= XP_TABEL[l]) l++;
  return l;
}

/* ------------------------------------------------------------------ */
/* Projectopslag: leerlingen bewaren hun blokken onder een code        */
/* (TANK-XXXX) zodat ze op elk toestel — ook in les 2 — verder kunnen. */
/* ------------------------------------------------------------------ */
const PROJECT_BESTAND = path.join(__dirname, 'projecten.json');
/* Zonder prototype: een code als "__proto__" of "constructor" is dan gewoon
   een onbekende code, en geen ingebouwde eigenschap van elk object. */
const projecten = Object.create(null);
try {
  const ruw = fs.readFileSync(PROJECT_BESTAND, 'utf8');
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
} catch { /* nog geen bestand */ }

/*
 * Wegschrijven gebeurt hooguit om de anderhalve seconde, maar wél gegarandeerd.
 * Vroeger schoof elke nieuwe bewaarbeurt het schrijven weer anderhalve seconde
 * op. Met een klas die volop bouwt komt er bijna elke seconde iets binnen,
 * en dan werd het bestand zolang de les liep nooit geschreven — sloot je het
 * zwarte venster, dan was het werk van de hele les weg.
 */
/*
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
   klaarstaat. (SIGHUP = het venster dichtklikken op Windows, SIGTERM = een
   herstart bij een online server.) */
for (const sein of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sein, () => {
    if (schrijfTimer || bezigMetSchrijven || nogEensSchrijven) schrijfProjectenNuMetZekerheid();
    process.exit(0);
  });
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

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */
const rooms = new Map();

function maakRoom(id, solo, niveau) {
  const arena = solo ? ARENA : GEDEELDE_ARENA;
  const room = {
    arena,
    id, solo,
    niveau: Object.hasOwn(NIVEAUS, String(niveau)) ? niveau : 'makkelijk',
    gestartOm: Date.now(),
    tanks: new Map(),
    bullets: [],
    vormen: [],
    volgendVormId: 1,
    volgendKogelId: 1,
    volgendAiId: 1,
    teamModus: 0,      // 0 = geen teams, 2 of 4 (les 2; de lesgever kiest via de beamer)
    /*
     * Thuisbasis: veilige hoekzone waar robots niet in kunnen. Ook in de
     * gedeelde arena — wie les 2 start zonder les 1 had anders nergens een
     * veilige plek, want teamzones bestaan alleen als de lesgever teams
     * aanzet. Zodra dat gebeurt nemen de teamzones het over (zie basisVan).
     */
    basis: { x: 0, y: arena.h - 380, w: 380, h: 380 },
  };
  rooms.set(id, room);
  vulVormenAan(room);
  return room;
}

/*
 * Welke gedeelde thuisbasis geldt er nu? Zodra de lesgever teams aanzet zijn
 * de teamzones de veilige plekken, en zou één gedeelde hoek juist oneerlijk
 * zijn (het team dat daar woont zou er gratis kunnen schuilen).
 */
function basisVan(room) {
  return room.teamModus ? null : room.basis;
}

function inBasis(room, x, y) {
  const b = basisVan(room);
  return !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/* Teamzones: veilige spawn-zones per team (les 2). */
const TEAM_KLEUREN = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6'];
const TEAM_NAAM = ['Blauw', 'Rood', 'Groen', 'Paars'];

/*
 * Teamzones, met dezelfde indeling als diep.io:
 *  - 2 teams: twee brede stroken links en rechts (blauw tegen rood)
 *  - 4 teams: vier vierkanten in de hoeken
 * De maten schalen mee met de arena, zodat een base in de grotere gedeelde
 * arena niet ineens een postzegel is. https://diepio.fandom.com/wiki/2_Teams
 */
/*
 * De veilige zones zijn smalle stroken aan de rand, zoals de bases in diep.io.
 * Ze waren 20% van de breedte per team: bij twee teams was dus bijna de helft
 * van het speelveld beschermd gebied waar niemand elkaar kon raken. Nu is het
 * een strook van 2,3%. Op 6% vulde je basis je halve scherm en op 3,5% nog
 * altijd 39% — je zag nauwelijks veld. Ruim genoeg om te spawnen en bij te
 * komen, maar het gevecht speelt zich af op het veld.
 */
function teamZones(room) {
  const a = room.arena;
  if (room.teamModus === 2) {
    const breed = Math.round(a.w * 0.023);
    return [
      { team: 0, x: 0, y: 0, w: breed, h: a.h },
      { team: 1, x: a.w - breed, y: 0, w: breed, h: a.h },
    ];
  }
  if (room.teamModus === 4) {
    // vier hoekjes: even groot, en samen ongeveer een tiende van het veld
    const z = Math.round(Math.min(a.w, a.h) * 0.16);
    return [
      { team: 0, x: 0, y: 0, w: z, h: z },
      { team: 1, x: a.w - z, y: 0, w: z, h: z },
      { team: 2, x: 0, y: a.h - z, w: z, h: z },
      { team: 3, x: a.w - z, y: a.h - z, w: z, h: z },
    ];
  }
  return [];
}

function inEigenZone(room, t) {
  if (t.team === null) return false;
  const zone = teamZones(room).find((z) => z.team === t.team);
  return !!zone && t.x >= zone.x && t.x <= zone.x + zone.w && t.y >= zone.y && t.y <= zone.y + zone.h;
}

/* Teamopstelling wisselen: iedereen krijgt een team, een kleur en een plek in
   zijn eigen zone. Bij 0 vervallen de teams en komt de gedeelde basis terug. */
/*
 * EEN RONDE MET EEN EINDE. Zonder klok speelt de arena eindeloos door en moet
 * de lesgever roepen dat het klaar is. Met een ronde krijgt de les een ritme:
 * een klok in beeld, een doel om naartoe te werken, en aan het eind een
 * winnaar. De punten van de ronde tellen apart (t.rondePunten), zodat niemand
 * zijn level of upgrades kwijtraakt als er opnieuw begonnen wordt.
 */
function startRonde(room, minuten, doel) {
  if (!room) return;
  for (const t of room.tanks.values()) t.rondePunten = 0;
  room.ronde = {
    eind: Date.now() + Math.max(1, Math.min(60, minuten || 10)) * 60000,
    doel: Math.max(0, Math.min(100000, doel || 0)),
  };
  room.gepauzeerd = false;
  io.to(room.id).emit('rondeStart', { minuten: minuten || 10, doel: doel || 0 });
}

function rondeStand(room) {
  const perTeam = new Map();
  const spelers = [];
  for (const t of room.tanks.values()) {
    const punten = t.rondePunten || 0;
    if (t.team !== null && t.team !== undefined) perTeam.set(t.team, (perTeam.get(t.team) || 0) + punten);
    spelers.push({ naam: t.naam, kleur: t.kleur, punten, ai: !!t.ai, team: t.team });
  }
  spelers.sort((a, b) => b.punten - a.punten);
  const teams = [...perTeam.entries()].map(([team, punten]) => ({ team, punten }))
    .sort((a, b) => b.punten - a.punten);
  return { teams, spelers: spelers.slice(0, 8) };
}

function stopRonde(room, reden) {
  if (!room || !room.ronde) return;
  const stand = rondeStand(room);
  room.ronde = null;
  room.gepauzeerd = true;          // even stil: iedereen kijkt naar de uitslag
  room.uitslagTot = Date.now() + 25000;
  io.to(room.id).emit('rondeKlaar', Object.assign({ reden }, stand));
}

/* Elke tik: is de tijd om, of heeft iemand het doel gehaald? */
function bewaakRonde(room, nu) {
  if (room.uitslagTot && nu > room.uitslagTot) { room.uitslagTot = 0; room.gepauzeerd = false; }
  const r = room.ronde;
  if (!r) return;
  if (nu >= r.eind) return stopRonde(room, 'tijd');
  if (r.doel) {
    const stand = rondeStand(room);
    const beste = stand.teams.length ? stand.teams[0].punten : (stand.spelers[0] || {}).punten || 0;
    if (beste >= r.doel) stopRonde(room, 'doel');
  }
}

function zetTeamModus(room, n) {
  if (!room || ![0, 2, 4].includes(n)) return;
  room.teamModus = n;
  /*
   * Eerst iedereen ontkoppelen en dán opnieuw indelen: anders telt de verdeling
   * de oude teams mee en kom je op 7 tegen 5 uit. Spelers gaan als eerste, dan
   * de robots — zo staan de leerlingen mooi verdeeld en vullen de robots aan.
   */
  for (const t of room.tanks.values()) t.team = null;
  const spelersEerst = [...room.tanks.values()].sort((a, b) => (a.ai ? 1 : 0) - (b.ai ? 1 : 0));
  for (const t of spelersEerst) {
    if (!n) {
      t.team = null;
      if (t.ai) t.kleur = t.ai.elite ? '#6a1b9a' : (AI_PROFIELEN[t.ai.profiel] || {}).kleur || '#95a5a6';
      else { t.kleur = '#3498db'; spawnTank(room, t); }
      continue;
    }
    wijsTeamToe(room, t);
    // de naam blijft dezelfde als de teams wisselen: je herkent Trumpie zo terug
    if (t.ai && !t.robotNaam) { t.robotNaam = vrijeRobotNaam(room); t.naam = `🤖 ${t.robotNaam}${t.ai.elite ? ' ⭐' : ''}`; }
    else spawnTank(room, t);
  }
}

/*
 * De lesgever kiest de opstelling (dashboard of beamer). Die keuze blijft
 * staan: een leerling die daarna nog op "Les 2 — 4 teams" klikt, gooit ze niet
 * meer om. Anders kon één kind de hele klas laten herspawnen, en twee kinderen
 * met een andere knop zelfs om de beurt.
 */
function lesgeverZetTeams(n) {
  if (![0, 2, 4].includes(n)) return;
  if (!rooms.has('arena')) maakRoom('arena', false);
  const room = rooms.get('arena');
  room.teamsDoorLesgever = true;
  zetTeamModus(room, n);
}

function wijsTeamToe(room, t) {
  if (!room.teamModus) { t.team = null; return; }
  /* Een robot gaat naar het team met de minste tanks (spelers én robots
     samen), zodat het 6 tegen 6 blijft. Een LEERLING gaat naar het team met de
     minste leerlingen: robots verdwijnen als de klas binnenkomt, en telden we
     ze mee, dan belandden de eerste zes kinderen allemaal in hetzelfde team. */
  const telling = new Array(room.teamModus).fill(0);
  const spelersPerTeam = new Array(room.teamModus).fill(0);
  for (const ander of room.tanks.values()) {
    if (ander.team === null || ander.team === undefined || ander.id === t.id) continue;
    telling[ander.team]++;
    if (!ander.ai) spelersPerTeam[ander.team]++;
  }
  const kies = (lijst, daarna) => {
    let beste = 0;
    for (let i = 1; i < lijst.length; i++) {
      if (lijst[i] < lijst[beste] || (lijst[i] === lijst[beste] && daarna[i] < daarna[beste])) beste = i;
    }
    return beste;
  };
  t.team = t.ai ? kies(telling, spelersPerTeam) : kies(spelersPerTeam, telling);
  t.kleur = TEAM_KLEUREN[t.team];
  const zone = teamZones(room).find((z) => z.team === t.team);
  if (zone) {
    t.x = zone.x + 40 + Math.random() * (zone.w - 80);
    t.y = zone.y + 40 + Math.random() * (zone.h - 80);
  }
}

/*
 * EEN RASTER VOOR DE VORMEN. Er liggen duizenden vormen in de arena, en zowel
 * de kogels als de tanks moeten weten of ze er eentje raken. Elke kogel tegen
 * elke vorm vergelijken is honderdduizenden vergelijkingen per tik. Daarom
 * hangen we de vormen in vakjes van 240 pixels: een kogel kijkt alleen in zijn
 * eigen vakje en de acht vakjes eromheen. Zo mag het er gerust nog veel meer
 * worden zonder dat de server het zwaarder krijgt.
 */
const VORMRASTER = 240;
/* Eén hergebruikt lijstje: elke tik duizenden keren een nieuwe array maken is
   zonde van het geheugen (en van de opruimtijd achteraf). */
const buurVormen = [];

/*
 * Het nummer van een vakje: kolom × 4096 + rij. Eerst was dat een stukje
 * tekst ("12,7"), maar dan maak je elke tik duizenden nieuwe tekstjes aan om
 * ze meteen weer weg te gooien — in een volle klas was dat een achtste van
 * alle rekentijd van de server. (De arena is nooit 4096 vakjes hoog.)
 */
const vakNr = (cx, cy) => cx * 4096 + cy;

function bouwVormRaster(room) {
  const vakjes = new Map();
  for (const v of room.vormen) {
    if (v.weg) continue;
    const k = vakNr((v.x / VORMRASTER) | 0, (v.y / VORMRASTER) | 0);
    let lijst = vakjes.get(k);
    if (!lijst) vakjes.set(k, (lijst = []));
    lijst.push(v);
  }
  room.vormRaster = vakjes;
}

/* Alle vormen in de buurt van dit punt (het eigen vakje + de acht buren). */
function vormenRondom(room, x, y, uit) {
  uit.length = 0;
  const raster = room.vormRaster;
  if (!raster) return uit;
  const cx = (x / VORMRASTER) | 0, cy = (y / VORMRASTER) | 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const lijst = raster.get(vakNr(cx + dx, cy + dy));
      if (lijst) for (const v of lijst) uit.push(v);
    }
  }
  return uit;
}

/*
 * NECROMANCER: een kapotte vorm staat weer op als drone in zijn zwerm. In
 * diep.io is dat zijn hele wezen — hij schiet niet, hij verzamelt. De drone
 * houdt de kleur van de vorm (een geel vierkant blijft geel), met de teamkleur
 * als rand, zodat je van ver ziet van wie de zwerm is.
 * https://diepio.fandom.com/wiki/Necromancer
 */
function toverVormOmTotDrone(room, baas, v) {
  if (!baas || !klasseVan(baas).necro) return;
  if (v.type !== 'vierkant' && v.type !== 'driehoek') return;
  const kl = klasseVan(baas);
  const nu = room.bullets.filter((x) => x.soort === 'drone' && !x.weg && x.eigenaar === baas.id).length;
  if (nu >= (kl.droneMax || 8)) return;
  room.bullets.push({
    id: room.volgendKogelId++, soort: 'drone',
    x: v.x, y: v.y, vx: 0, vy: 0, hoek: v.hoek || 0,
    eigenaar: baas.id, kleur: v.kleur, rand: baas.kleur, team: baas.team,
    vorm: v.type === 'driehoek' ? 'driehoek' : 'vierkant',
    r: Math.max(7, v.r * 0.55),
    schade: bulletSchadeVan(baas) * 0.55,
    leven: (3 + bulletPierce(baas)) * (kl.kogelLeven || 1),
    dood: Infinity,
  });
}

/* Kapotgeschoten vormen worden gemarkeerd en pas na de lussen opgeruimd:
   tijdens het rekenen mag de lijst niet onder je handen veranderen. */
function ruimKapotteVormenOp(room) {
  if (room.vormen.some((v) => v.weg)) room.vormen = room.vormen.filter((v) => !v.weg);
}

function vulVormenAan(room) {
  /*
   * Het aantal vormen hangt af van de OPPERVLAKTE van de arena, niet van het
   * aantal spelers. Dat is hoe diep.io het doet: overal even veel te schieten,
   * of je nu alleen in een hoek zit of met de hele klas in het midden.
   *
   * Onze arena werd drie keer groter, maar het aantal vormen bleef staan —
   * daardoor reed je minutenlang door een leeg veld. Deze getallen zeggen:
   * "één vierkant per 90.000 pixels arena". Dat komt neer op ongeveer even
   * veel blokjes per scherm als in het echte spel (zie de screenshots van
   * diep.io: een stuk of twintig vierkanten en een handvol driehoeken in
   * beeld). https://diepwiki.io/#/shapes/
   */
  const opp = room.arena.w * room.arena.h;
  /* In je eigen oefenarena (les 1) leggen we het dubbel zo dicht. Daar kijk je
     door een klein venster naast je blokken, en moet er altijd iets binnen
     handbereik staan om op te schieten — anders staat een leerling te wachten
     tot er toevallig een vierkant voorbijkomt. */
  const dicht = room.solo ? 0.5 : 1;
  const per = (px2, min) => Math.max(min || 1, Math.round(opp / (px2 * dicht)));
  /*
   * Hoeveel vormen je in beeld hebt hangt óók van je level af: je zichtveld
   * groeit met 1% per level, dus op level 45 zie je twee keer zoveel veld —
   * en dus twee keer zoveel blokjes — als een beginner. Op één vierkant per
   * 65.000 pixels werd dat bij een hoog level een tapijt (70 stuks in beeld).
   * Met 100.000 blijft het rustig: een beginner ziet er een stuk of veertien,
   * een tank van level 40 een stuk of veertig.
   */
  const quota = {
    vierkant: per(125000),         // het voer van elke beginner
    driehoek: per(330000),         // vlot te vinden, meer punten
    vijfhoek: per(2400000, 4),     // schaars, buiten het nest
    nestVijfhoek: per(2800000, 5), // in het nest, achter de crashers
    alfa: room.solo ? 2 : 3,       // de dikke blauwe: écht zeldzaam
    zeshoek: room.solo ? 2 : 4,
    zeshoekBuiten: 1,
    muur: per(1600000, 6),      // losse blokken als dekking; in diep.io zijn er geen
    crashers: per(3000000, 6),     // bewakers van het nest
  };

  /*
   * Eén telling voor alle soorten samen. Vroeger stond hier een filter() per
   * soort ÍN de while-voorwaarde: bij het aanleggen van zeshonderd vierkanten
   * liep de server dan zeshonderd keer de hele lijst door. Nu tellen we één
   * keer en houden we de teller bij terwijl we bijvullen.
   */
  const telling = {};
  let buitenVijfhoek = 0, buitenZeshoek = 0, jagers = 0;
  for (const v of room.vormen) {
    telling[v.type] = (telling[v.type] || 0) + 1;
    if (v.jaagt) jagers++;
    else if (!inNest(room, v.x, v.y)) {
      if (v.type === 'vijfhoek') buitenVijfhoek++;
      else if (v.type === 'zeshoek') buitenZeshoek++;
    }
  }
  const bij = (type, inHetNest) => {
    spawnVorm(room, type, inHetNest);
    telling[type] = (telling[type] || 0) + 1;
  };
  const aantal = (type) => telling[type] || 0;

  // bewakers van het nest: meestal de kleine
  while (jagers < quota.crashers) {
    bij(Math.random() < 0.75 ? 'crasher' : 'grotecrasher');
    jagers++;
  }
  while (aantal('vierkant') < quota.vierkant) bij('vierkant');
  while (aantal('driehoek') < quota.driehoek) bij('driehoek');
  /*
   * Eerst het aantal BUITEN het nest aanvullen: zaten ze allemaal in het nest
   * achter de crashers, dan kwam wie het midden meed er nooit een tegen.
   */
  while (buitenVijfhoek < quota.vijfhoek) { bij('vijfhoek', false); buitenVijfhoek++; }
  while (aantal('vijfhoek') < quota.vijfhoek + quota.nestVijfhoek) bij('vijfhoek', true);
  while (aantal('alfa') < quota.alfa) bij('alfa');
  // één zeshoek zwerft buiten rond: de buitenkans moet wél te vinden zijn
  while (buitenZeshoek < quota.zeshoekBuiten) { bij('zeshoek', false); buitenZeshoek++; }
  while (aantal('zeshoek') < quota.zeshoek) bij('zeshoek', true);
  while (aantal('muur') < quota.muur) bij('muur');

  vulVeiligeZonesAan(room);
}

/*
 * Ook in je eigen veilige zone liggen vormen, en ze komen er terug zodra je ze
 * kapotschiet. Een leerling met een zwakke tank kan zo eerst rustig oefenen en
 * sterker worden vóór hij het veld in gaat, waar de crashers en de robots hem
 * anders meteen neermaaien. Alleen makkelijke vormen: vierkanten en driehoeken,
 * geen vijfhoeken — anders wordt de basis een gratis puntenautomaat.
 */
function vulVeiligeZonesAan(room) {
  const zones = room.teamModus ? teamZones(room) : (room.basis ? [room.basis] : []);
  for (const zone of zones) {
    const rand = 40;
    const vak = { x: zone.x + rand, y: zone.y + rand, w: zone.w - rand * 2, h: zone.h - rand * 2 };
    if (vak.w < 60 || vak.h < 60) continue;
    const inZone = (v) => v.x >= zone.x && v.x <= zone.x + zone.w && v.y >= zone.y && v.y <= zone.y + zone.h;
    // hoeveel er passen: een grote teamstrook krijgt er meer dan een hoekje
    const doel = Math.max(4, Math.min(14, Math.round((zone.w * zone.h) / 90000)));
    let hier = room.vormen.filter((v) => (v.type === 'vierkant' || v.type === 'driehoek') && inZone(v)).length;
    while (hier < doel) {
      spawnVorm(room, Math.random() < 0.7 ? 'vierkant' : 'driehoek', false, vak);
      hier++;
    }
  }
}

/*
 * Het "nest": het middengebied waar alleen de dikke vormen leven. In diep.io
 * spawnen zeshoeken en alfa's uitsluitend in het Pentagon Nest — een plek waar
 * een beginner niet komt. Bij ons stonden ze overal, ook naast de veilige
 * basis, waardoor je met één zeshoek (1500 XP, precies zoals diep.io) in één
 * klap van level 1 naar 15 sprong. De getallen klopten; de plek niet.
 */
/* Het nest ligt altijd midden in de arena en is even groot t.o.v. de arena,
   ongeacht of je solo of samen speelt. */
const nestVan = (room) => ({
  x: room.arena.w * 0.38, y: room.arena.h * 0.28,
  w: room.arena.w * 0.24, h: room.arena.h * 0.44,
});
const inNest = (room, x, y) => {
  const n = nestVan(room);
  return x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h;
};

function spawnVorm(room, type, inHetNest, vak) {
  const def = VORM_TYPES[type];
  let x, y;
  // vak = spawn precies binnen deze rechthoek (gebruikt voor de thuisbasis)
  if (vak) {
    x = vak.x + def.r + Math.random() * Math.max(1, vak.w - def.r * 2);
    y = vak.y + def.r + Math.random() * Math.max(1, vak.h - def.r * 2);
    return duwVormInDeArena(room, type, def, x, y);
  }
  // Alleen alfa's en de nestbewakers horen per se in het nest; van de andere
  // soorten bepaalt de aanroeper waar ze komen (zie de quota hieronder).
  if (inHetNest || type === 'alfa' || def.jaagt) {
    const n = nestVan(room);
    x = n.x + Math.random() * n.w;
    y = n.y + Math.random() * n.h;
  } else {
    do {                                    // buiten het nest, mooi verspreid
      x = 80 + Math.random() * (room.arena.w - 160);
      y = 80 + Math.random() * (room.arena.h - 160);
    } while (inNest(room, x, y));
  }
  if (inBasis(room, x, y)) { x = room.arena.w / 2; y = room.arena.h / 2; }
  return duwVormInDeArena(room, type, def, x, y);
}

/* De vorm daadwerkelijk in de arena zetten. */
function duwVormInDeArena(room, type, def, x, y) {
  room.vormen.push({
    id: room.volgendVormId++,
    type,
    x, y,
    hp: def.hp, maxHp: def.hp,
    r: def.r, punten: def.punten, kleur: def.kleur,
    botsschade: def.botsschade || 0,
    blokkeert: !!def.blokkeert,
    jaagt: !!def.jaagt,
    vx: 0, vy: 0,
    hoek: Math.random() * Math.PI * 2,
    draai: (Math.random() - 0.5) * 0.6, // langzaam ronddraaien, zoals in diep.io
  });
}

/* ------------------------------------------------------------------ */
/* Tanks (spelers én AI)                                               */
/* ------------------------------------------------------------------ */
/* Elke tank krijgt een kort nummer voor in de pakketjes. Intern blijft de
   verbindingscode zijn sleutel, maar die is twintig tekens lang en ging bij
   elke tank én bij elke kogel twintig keer per seconde over de wifi. */
let volgendTankNr = 1;

function nieuweTank(id, naam) {
  return {
    id, naam, nr: volgendTankNr++,
    kleur: '#3498db', vorm: 'cirkel', klasse: 'basis', team: null,
    score: 0, level: 1, statPunten: 0,
    stats: legeStats(),
    x: 0, y: 0,   // spawnTank() zet hem meteen op zijn echte plek
    vx: 0, vy: 0, // huidige vaart: de tank versnelt en rolt uit
    angle: 0,
    intent: { mx: 0, my: 0, angle: 0, shoot: false, tx: 0, ty: 0 },
    hp: 90, maxHp: 90,
    deaths: 0, deadUntil: 0, reloadUntil: 0,
    flashKleur: null, flashUntil: 0,
    sayText: null, sayUntil: 0,
    laatsteActie: Date.now(), onzichtbaar: false,
    beschermTot: 0, contactEvT: 0, laatsteSchade: 0, laatsteSchot: 0, rvx: 0, rvy: 0,
    ai: null,
  };
}

/* Hoe ver steekt deze loop uit vanaf het midden van de tank? */
function loopLengte(loop) { return (loop.start || 0) + loop.len; }

/*
 * Basisdrones: de bewakers van elke teamzone.
 * In diep.io zijn dat er 12 per base bij 4 teams en 30 in totaal bij 2 teams.
 * Wij houden het bewust wat rustiger — met twaalf leerlingen is het anders een
 * wolk van stipjes — maar het effect is hetzelfde: in een vijandelijke base
 * blijven rondhangen lukt niet meer.
 */
const BASISDRONE_ZICHT = 520;      // vanaf hier duiken ze op een vijand af
const BASISDRONE_LOS = 1100;       // verder dan dit van hun post: eerst terug
const BASISDRONE_SNELHEID = 260;   // sneller dan een tank, je ontkomt er niet aan

/* Hoeveel bewakers heeft deze zone nodig? Een lange strook (2 teams) heeft er
   meer nodig dan een hoekvierkant (4 teams), anders kan je er gewoon omheen. */
function aantalBasisDrones(zone) {
  return Math.round(6 + Math.min(6, Math.max(zone.w, zone.h) / 700));
}

/*
 * De vaste post van bewaker i: netjes verspreid over de zone, in paren links
 * en rechts van het midden — precies zoals de wiki het beschrijft voor 2 teams
 * ("spread evenly in pairs all across the base"). Eerst cirkelden ze allemaal
 * rond het midden van de zone; bij een strook van 3400 hoog kon je daar met
 * gemak omheen rijden en stond de halve base onbewaakt.
 */
function basisDronePost(zone, i, totaal) {
  const langsY = zone.h >= zone.w;
  const deel = (i + 0.5) / totaal;
  const zij = i % 2 === 0 ? 0.34 : 0.66;
  return langsY
    ? { x: zone.x + zone.w * zij, y: zone.y + zone.h * deel }
    : { x: zone.x + zone.w * deel, y: zone.y + zone.h * zij };
}

function vulBasisDronesAan(room, nu) {
  if (!room.teamModus) return;
  for (const zone of teamZones(room)) {
    const totaal = aantalBasisDrones(zone);
    const mijne = room.bullets.filter((b) => !b.weg && b.soort === 'basisdrone' && b.team === zone.team);
    const bezet = new Set(mijne.map((b) => b.post));
    for (let i = 0; i < totaal; i++) {
      if (bezet.has(i)) continue;
      const p = basisDronePost(zone, i, totaal);
      room.bullets.push({
        id: room.volgendKogelId++, soort: 'basisdrone',
        x: p.x, y: p.y, vx: 0, vy: 0, hoek: Math.random() * Math.PI * 2,
        eigenaar: null, team: zone.team, post: i, kleur: TEAM_KLEUREN[zone.team],
        r: 11, schade: 7, leven: 6,
        dood: Infinity,   // ze blijven tot ze kapotgeschoten worden
      });
    }
  }
}

/* De arena waarin deze socket speelt (voor handlers zonder room-variabele). */
function arenaVan(socket) {
  const room = rooms.get(socket.data.roomId);
  return room ? room.arena : ARENA;
}

function klasseVan(t) { return KLASSEN[t.klasse] || KLASSEN.basis; }

/*
 * De acht stats, exact volgens https://diepio.fandom.com/wiki/Stats.
 * De getallen in commentaar zijn de controlewaarden uit de tabellen daar.
 */

// Max Health: basis-hp = 50 + 2*(level-1), elk punt +20. Lvl 1 = 50, lvl 45 = 138.
function maxHpVan(t) { return t.ai ? t.ai.hp : 50 + (t.level - 1) * 2 + t.stats.maxlevens * 20; }

// Health Regen: per seconde 1/30 van je maxHp maal (0,03 + 0,12 per punt).
function regenPerSec(t) { return t.ai ? 0 : (maxHpVan(t) / 30) * (0.03 + 0.12 * t.stats.levensregen); }

// Bullet Damage: 7 bij 0 punten, +3 per punt (0 -> 7, 7 -> 28).
function bulletSchadeVan(t) { return t.ai ? t.ai.schade : (7 + t.stats.kogelschade * 3) * klasseVan(t).schade; }

function bulletSnelheidFactor(t) { return t.ai ? 1 : 1 + t.stats.kogelsnelheid * 0.09; }

// Bullet Penetration = "bullet health": 2 bij 0 punten, +1,5 per punt (7 -> 12,5).
function bulletPierce(t) { return t.ai ? 2 : 2 + t.stats.kogelpantser * 1.5; }

// Reload: 0,6 sec per kogel, elk punt maal 0,914 (0 -> 600ms, 7 -> 321ms).
function herlaadMsVan(t) {
  return t.ai ? t.ai.herlaadMs : Math.max(90, 600 * Math.pow(0.914, t.stats.herladen) * klasseVan(t).herlaad);
}
/*
 * Movement Speed: hoe hoger je level, hoe trager je van nature wordt (diep.io).
 * De basissnelheid ging van 150 naar 185: de arena werd drie keer groter, en
 * met de oude snelheid was je een minuut onderweg van de ene kant naar de
 * andere. Zeven punten in Snelheid brengt je op ruim het dubbele.
 */
function snelheidVan(t) {
  if (t.ai) return t.ai.snelheid;
  return (185 - Math.min(45, t.level) * 0.9) + t.stats.snelheid * 18 + (klasseVan(t).snelheidBonus || 0);
}

/*
 * Hoe snel je op gang komt en weer tot stilstand. In diep.io glijdt een tank:
 * je duwt hem op gang en hij rolt nog even door. Wij zetten de tank vroeger
 * pardoes op zijn nieuwe plek — dat voelde stroef en schokkerig, zeker met de
 * pijltjestoetsen. Nu bouwt hij snelheid op (VERSNELLING) en rolt hij uit
 * (WRIJVING) zodra je loslaat.
 */
const VERSNELLING = 7;   // hoe snel je de topsnelheid haalt (hoger = directer)
const WRIJVING = 4.5;    // hoe snel je uitrolt als je niets doet

/*
 * Body Damage: (punten + 5) × een factor die van het doelwit afhangt.
 * Tegen tanks ×6 (30 bij 0 punten), tegen vormen ×4 (20), tegen kogels/traps
 * ×1 (5). De Stekelbol telt +2 punten extra mee.
 */
function botsschadeVan(t, doel) {
  const factor = doel === 'vorm' ? 4 : doel === 'kogel' ? 1 : 6;
  if (t.ai) return t.ai.botsschade * (factor / 6);
  const punten = t.stats.botsschade + (klasseVan(t).stekels ? 2 : 0);
  return (punten + 5) * factor * (klasseVan(t).ramSchade || 1);
}

/* Smashers mogen 10 punten per stat i.p.v. 7 (wiki: Smasher branch). */
function statMaxVan(t) { return klasseVan(t).ram ? 10 : MAX_STAT; }

function saneNaam(naam) {
  return String(naam || 'Speler').replace(/[<>]/g, '').trim().slice(0, 16) || 'Speler';
}

/* Welke klassen mag deze tank nu kiezen? (de diep.io-upgradeboom) */
function klasseAanbod(t) {
  const boom = UPGRADE_BOOM[t.klasse] || {};
  const aanbod = [];
  for (const [lvl, keuzes] of Object.entries(boom)) {
    if (t.level >= Number(lvl)) aanbod.push(...keuzes);
  }
  return aanbod;
}

function spawnTank(room, t) {
  t.x = 100 + Math.random() * (room.arena.w - 200);
  t.y = 100 + Math.random() * (room.arena.h - 200);
  const basis = basisVan(room);
  if (!t.ai && basis) {
    // je start veilig in de thuisbasis (solo én in de gedeelde arena
    // zolang de lesgever geen teams heeft aangezet)
    t.x = basis.x + 60 + Math.random() * (basis.w - 120);
    t.y = basis.y + 60 + Math.random() * (basis.h - 120);
  }
  if (t.ai && basis && inBasis(room, t.x, t.y)) {
    t.x = room.arena.w / 2; t.y = room.arena.h / 2;
  }
  if (!t.ai && t.team !== null) {
    const zone = teamZones(room).find((z) => z.team === t.team);
    if (zone) {
      t.x = zone.x + 40 + Math.random() * (zone.w - 80);
      t.y = zone.y + 40 + Math.random() * (zone.h - 80);
    }
  }
  t.deadUntil = 0;
  t.maxHp = maxHpVan(t);
  t.hp = t.maxHp;
  t.intent = { mx: 0, my: 0, angle: 0, shoot: false, tx: t.x, ty: t.y };
  // geen thuisbasis (dus: teams staan aan)? dan even onschendbaar na je spawn
  if (!t.ai && !basis) t.beschermTot = Date.now() + SPAWN_BESCHERMING_MS;
}

/* Is deze speler nu veilig (basis, teamzone of spawnbescherming)? */
function isVeilig(room, t, nu) {
  if (t.ai) return false;
  if (nu < t.beschermTot) return true;
  if (inBasis(room, t.x, t.y)) return true;
  if (inEigenZone(room, t)) return true;
  return false;
}

/*
 * Bij dood kom je zwakker terug. In diep.io ben je álles kwijt — terug naar
 * level 1 met nul punten. Voor een les van tweeënhalf uur is dat te hard: een
 * leerling die net level 30 haalde begint dan weer helemaal opnieuw. We houden
 * een derde van je punten over. Doodgaan doet dus pijn (level 45 wordt 28),
 * maar je staat niet weer aan de start.
 */
function respawnZwakker(room, t) {
  t.score = Math.floor(t.score / 3);
  t.level = levelVan(t.score);
  t.stats = legeStats();
  t.statPunten = Math.max(0, t.level - 1);
  const tier = klasseVan(t).tier || 1;
  if (t.level < (TIER_LEVEL[tier] || 1)) t.klasse = 'basis';
  spawnTank(room, t);
  stuurEvent(t, 'respawn');
}

function stuurEvent(t, type, extra) {
  if (t.ai) return;
  io.to(t.id).emit('ev', Object.assign({ type }, extra || {}));
}

/*
 * Statpunten per level, exact zoals diep.io: van level 2 t/m 28 krijg je bij
 * élke levelup een punt, daarna nog één om de drie levels (30, 33, 36, 39,
 * 42, 45). Dat zijn er 33 in totaal — te weinig om alle 8 stats te maxen
 * (8 × 7 = 56), dus je moet echt kiezen. Precies de bedoeling.
 */
function statPuntenBijLevel(l) {
  if (l >= 2 && l <= 28) return 1;
  if (l >= 30 && l <= 45 && (l - 30) % 3 === 0) return 1;
  return 0;
}

/* Score erbij → misschien level omhoog (met statpunt + gebeurtenis). */
function geefPunten(room, t, n) {
  t.score += n;
  /* Punten van deze ronde tellen apart. Zo begint iedereen bij een nieuwe
     ronde weer op nul zonder dat we zijn level en zijn upgrades afpakken. */
  t.rondePunten = (t.rondePunten || 0) + n;
  const nieuwLevel = levelVan(t.score);
  if (nieuwLevel > t.level) {
    const vorigLevel = t.level;
    t.level = nieuwLevel;
    if (!t.ai) {
      for (let l = vorigLevel + 1; l <= nieuwLevel; l++) t.statPunten += statPuntenBijLevel(l);
      // basis-hp groeit mee met je level → meteen taaier
      const oudMax = t.maxHp;
      t.maxHp = maxHpVan(t);
      t.hp += Math.max(0, t.maxHp - oudMax);
      stuurEvent(t, 'levelup', { level: t.level });
      stuurEvent(t, 'statpunt', { punten: t.statPunten }); // voor het hat-blok
    }
  }
}

/* ------------------------------------------------------------------ */
/* AI-tegenstanders                                                    */
/* ------------------------------------------------------------------ */
function hoogsteSpelerScore(room) {
  let hoog = 0;
  for (const t of room.tanks.values()) if (!t.ai && t.score > hoog) hoog = t.score;
  return hoog;
}
function hoogsteSpelerLevel(room) {
  let hoog = 1;
  for (const t of room.tanks.values()) if (!t.ai && t.level > hoog) hoog = t.level;
  return hoog;
}

/*
 * In de gedeelde arena zitten leerlingen dóór elkaar: eentje speelt al een uur
 * en staat op level 30, een ander komt net binnen op level 1. Schaalden we de
 * robots op de sterkste speler (zoals in solo), dan liep die nieuwkomer meteen
 * tegen level-30-robots aan en was hij binnen enkele seconden kapot. Daarom
 * kijken we hier naar het GEMIDDELDE, en nooit meer dan een paar levels boven
 * de zwakste speler.
 */
function spelerLevelVoorAI(room) {
  if (room.solo) return hoogsteSpelerLevel(room);
  let som = 0, aantal = 0, laagste = Infinity;
  for (const t of room.tanks.values()) {
    if (t.ai) continue;
    som += t.level; aantal++;
    if (t.level < laagste) laagste = t.level;
  }
  if (!aantal) return 1;
  return Math.max(1, Math.min(Math.round(som / aantal), laagste + 4));
}

/* Idem voor het áántal robots: de score van de sterkste speler mag niet
   bepalen hoe druk het is voor wie net begint. */
function spelerScoreVoorAI(room) {
  if (room.solo) return hoogsteSpelerScore(room);
  let som = 0, aantal = 0;
  for (const t of room.tanks.values()) { if (t.ai) continue; som += t.score; aantal++; }
  return aantal ? som / aantal : 0;
}

function zorgVoorAI(room) {
  const spelers = [...room.tanks.values()].filter((t) => !t.ai).length;
  if (spelers === 0) return;
  /*
   * Rustige start in SOLO: daar bouwt een leerling zijn eerste blokken en moet
   * er niet meteen een robot op hem staan schieten. In de gedeelde arena is het
   * omgekeerd — daar wil je meteen een vol veld, zodat het spel meteen leeft.
   */
  if (room.solo && !process.env.TESTROBOTS && Date.now() - room.gestartOm < OPWARM_MS) return;
  const score = spelerScoreVoorAI(room);
  const n = NIVEAUS[room.niveau] || NIVEAUS.gemiddeld;
  const doel = process.env.TESTROBOTS ? Number(process.env.TESTROBOTS) : (room.solo
    ? Math.min(n.max, 1 + Math.floor(score / n.perScore))
    /*
     * In de gedeelde arena rijden er altijd TANKS_IN_ARENA tanks rond: eerst de
     * echte leerlingen, en de rest vullen we aan met robots. Zo blijft het veld
     * even druk of de klas nu met vier of met twaalf is, en blijven de teams
     * even groot. Zit de klas voltallig binnen, dan verdwijnen de robots vanzelf.
     */
    : Math.max(0, TANKS_IN_ARENA - spelers));
  const huidige = [...room.tanks.values()].filter((t) => t.ai).length;
  for (let i = huidige; i < doel; i++) {
    const t = maakAiTank(room, n);
    room.tanks.set(t.id, t);
  }
  if (!room.solo && huidige > doel) ruimRobotsOp(room, huidige - doel);
}

/*
 * Te veel robots: de klas komt één voor één binnen, en voor elke leerling die
 * er nog niet was reed er een robot. Die bleven staan tot ze toevallig
 * kapotgeschoten werden — met 25 leerlingen reden er zo 36 tanks rond in
 * plaats van 25. Nu verdwijnt het teveel vanzelf, maar alleen robots die ver
 * van elke leerling rijden: niemand ziet een tegenstander zomaar oplossen.
 * In teams nemen we eerst een robot weg uit het team met de meeste tanks.
 */
const ROBOT_WEG_AFSTAND = 1800;
function ruimRobotsOp(room, teveel) {
  const spelers = [...room.tanks.values()].filter((t) => !t.ai);
  const perTeam = new Map();
  for (const t of room.tanks.values()) if (t.team !== null) perTeam.set(t.team, (perTeam.get(t.team) || 0) + 1);
  const kandidaten = [...room.tanks.values()]
    .filter((r) => r.ai)
    .map((r) => ({ r, d: Math.min(...spelers.map((s) => Math.hypot(s.x - r.x, s.y - r.y))) }))
    .filter((k) => k.d > ROBOT_WEG_AFSTAND);
  for (let i = 0; i < teveel && kandidaten.length; i++) {
    kandidaten.sort((a, b) => ((perTeam.get(b.r.team) || 0) - (perTeam.get(a.r.team) || 0)) || b.d - a.d);
    const { r } = kandidaten.shift();
    room.tanks.delete(r.id);
    if (r.team !== null) perTeam.set(r.team, perTeam.get(r.team) - 1);
  }
}

function maakAiTank(room, n) {
  const p = AI_PROFIELEN[n.profiel] || AI_PROFIELEN.gemiddeld;
  const spelerLvl = spelerLevelVoorAI(room);
  // meestal rond jouw level, soms een sterke "elite" die boven lvl 45 kan gaan
  let lvl, elite = false;
  if (Math.random() < n.eliteKans) {
    elite = true;
    lvl = klem(spelerLvl + randInt(8, 20), 6, 60);
  } else {
    lvl = klem(spelerLvl + randInt(n.spreidLaag, n.spreidHoog), 1, 45);
    /*
     * In de gedeelde arena mag ongeveer een derde van de robots een stuk verder
     * staan: dan rijden er ook Twins, Sluipschutters en Vernietigers rond in
     * plaats van twaalf identieke beginnerstanks. Het gros blijft wél rond het
     * niveau van de klas, zodat een beginner niet meteen afgemaakt wordt.
     */
    if (!room.solo && Math.random() < 0.34) lvl = klem(lvl + randInt(14, 32), 1, 45);
  }
  const t = nieuweTank(`ai-${room.id}-${room.volgendAiId++}`, '🤖 Robot');
  /* Meteen in de lijst zetten: de teamverdeling telt alle tanks, en anders
     zag robot 3 robot 2 nog niet staan — zo kwam je op 7 tegen 5 uit. */
  room.tanks.set(t.id, t);
  t.ai = {
    profiel: n.profiel, elite,
    snelheid: p.snelheid * (elite ? 1.1 : 1),
    hp: Math.round(45 + lvl * 11),           // hoger level = veel taaier (soms niet stuk te schieten)
    schade: Math.round(4 + lvl * 0.45),
    botsschade: Math.min(24, 5 + lvl * 0.25),
    reactieMs: p.reactieMs,
    herlaadMs: p.herlaadMs * (elite ? 0.8 : 1),
    schietAfstand: p.schietAfstand,
    laatsteAim: 0, doelHoek: 0,
    modus: 'roam', aggroTot: 0,
    doelPunt: null, doelPuntTot: 0,
    punten: Math.round((elite ? 60 : 30) + lvl * 10),
  };
  t.level = lvl;
  t.klasse = robotKlasseVoorLevel(lvl);
  if (KLASSEN[t.klasse] && KLASSEN[t.klasse].vorm) t.vorm = KLASSEN[t.klasse].vorm;
  /*
   * In teammodus vecht een robot mee voor een team: hij krijgt de teamkleur en
   * telt mee voor die kant. Zonder dit reden er grijze robots rond die iedereen
   * aanvielen — verwarrend als de rest van het veld rood of blauw is.
   * Het team met de minste robots krijgt de volgende, zodat het eerlijk blijft.
   */
  t.robotNaam = vrijeRobotNaam(room);
  t.naam = `🤖 ${t.robotNaam}${elite ? ' ⭐' : ''}`;
  if (room.teamModus) {
    wijsTeamToe(room, t);
  } else {
    t.kleur = elite ? '#6a1b9a' : p.kleur;
  }
  t.maxHp = t.ai.hp;
  spawnTank(room, t);
  t.hp = t.maxHp;
  return t;
}

/*
 * Robotgedrag: rustig rondzwerven en vormen farmen, en pas JAGEN als je
 * dichtbij komt. Raak je ver genoeg weg (of na een tijdje), dan geeft hij op
 * — zo kun je ontsnappen. Dus geen robot die je eeuwig blijft plakken.
 */
function stuurAI(room, t, nu) {
  const a = t.ai;

  /*
   * Wie is de vijand? Een robot mag NOOIT zijn eigen team aanvallen — dat ging
   * mis: in een spel met twee teams schoten blauwe robots op hun eigen blauwe
   * klasgenoten. Zonder teams (les 1, vrij spel) is iedereen behalve andere
   * robots een doelwit.
   *
   * Met teams jaagt hij ook op vijandelijke ROBOTS, anders staan twaalf tanks
   * elkaar te negeren tot er toevallig een leerling langsrijdt. Spelers wegen
   * wel zwaarder: die zoekt hij liever op.
   */
  let speler = null, dSpeler = Infinity;
  const inTeams = t.team !== null && t.team !== undefined;
  for (const ander of room.tanks.values()) {
    if (ander.id === t.id || nu < ander.deadUntil) continue;
    if (inTeams ? ander.team === t.team : ander.ai) continue;
    if (isVeilig(room, ander, nu)) continue; // veilige tanks negeren
    const d = Math.hypot(ander.x - t.x, ander.y - t.y) * (ander.ai ? 1.6 : 1);
    if (d < dSpeler) { dSpeler = d; speler = ander; }
  }
  if (speler) dSpeler = Math.hypot(speler.x - t.x, speler.y - t.y);

  // aggro aan/uit
  if (a.modus !== 'chase') {
    if (speler && dSpeler < DETECTIE_R) { a.modus = 'chase'; a.aggroTot = nu + AGGRO_MS; }
  } else if (!speler || dSpeler > ONTSNAP_R || nu > a.aggroTot) {
    a.modus = 'roam';
  } else if (dSpeler < DETECTIE_R) {
    a.aggroTot = nu + AGGRO_MS; // zolang je dichtbij blijft, blijft hij boos
  }

  if (a.modus === 'chase' && speler) {
    if (nu - a.laatsteAim > a.reactieMs) { a.laatsteAim = nu; a.doelHoek = Math.atan2(speler.y - t.y, speler.x - t.x); }
    const naar = Math.atan2(speler.y - t.y, speler.x - t.x);
    let mx = 0, my = 0;
    if (dSpeler > 300) { mx = Math.cos(naar); my = Math.sin(naar); }
    else if (dSpeler < 160) { mx = -Math.cos(naar); my = -Math.sin(naar); }
    else { mx = Math.cos(naar + Math.PI / 2) * 0.5; my = Math.sin(naar + Math.PI / 2) * 0.5; }
    t.intent = { mx, my, angle: a.doelHoek, shoot: dSpeler < a.schietAfstand };
    return;
  }

  // rustig zwerven en vormen farmen. Alleen de vakjes rondom bekijken: elke
  // robot liep vroeger elke tik álle vormen van de arena af (honderden tot
  // duizenden) om er één in de buurt te vinden. Ligt er niets dichtbij, dan
  // zwerft hij gewoon verder tot hij er wel een tegenkomt.
  let vorm = null, dVorm = Infinity;
  for (const v of vormenRondom(room, t.x, t.y, buurVormen)) {
    if (v.weg || v.type === 'muur') continue;
    const d = Math.hypot(v.x - t.x, v.y - t.y);
    if (d < dVorm) { dVorm = d; vorm = v; }
  }
  if (!a.doelPunt || Math.hypot(a.doelPunt.x - t.x, a.doelPunt.y - t.y) < 60 || nu > a.doelPuntTot) {
    a.doelPunt = vorm && Math.random() < 0.7
      ? { x: vorm.x, y: vorm.y }
      : { x: 200 + Math.random() * (room.arena.w - 400), y: 200 + Math.random() * (room.arena.h - 400) };
    a.doelPuntTot = nu + 4000;
  }
  const naar = Math.atan2(a.doelPunt.y - t.y, a.doelPunt.x - t.x);
  const richt = vorm && dVorm < 260 ? Math.atan2(vorm.y - t.y, vorm.x - t.x) : naar;
  t.intent = { mx: Math.cos(naar) * 0.65, my: Math.sin(naar) * 0.65, angle: richt, shoot: vorm && dVorm < 260 };
}

/* ------------------------------------------------------------------ */
/* Verbindingen                                                        */
/* ------------------------------------------------------------------ */
io.on('connection', (socket) => {
  let laatsteActieMsg = 0;
  /* Wie binnenkomt terwijl de lesgever "ogen op mij" heeft aangezet (of zijn
     pagina ververst), hoort ook meteen stil te staan. */
  if (bevroren) socket.emit('lesStuur', { type: 'bevries', aan: true });

  socket.on('join', (data) => {
    const totaal = [...rooms.values()].reduce((n, r) => n + [...r.tanks.values()].filter((t) => !t.ai).length, 0);
    if (totaal >= MAX_SPELERS) { socket.emit('vol'); return; }

    verlaatRoom(socket);
    const modus = data && data.modus === 'samen' ? 'samen' : 'solo';
    const roomId = modus === 'solo' ? `solo-${socket.id}` : 'arena';
    const room = rooms.get(roomId) || maakRoom(roomId, modus === 'solo', data && data.niveau);

    const t = nieuweTank(socket.id, saneNaam(data && data.naam));
    t.kleur = KLEUREN[Math.floor(Math.random() * 8)];
    /* Alleen om te testen: start meteen met een bepaalde klasse en een hoog
       level, zodat je niet eerst een half uur moet spelen om te zien of een
       nieuwe klasse klopt. Staat uit zolang de omgevingsvariabele leeg is. */
    if (process.env.TESTSPELERKLASSE && KLASSEN[process.env.TESTSPELERKLASSE]) {
      t.klasse = process.env.TESTSPELERKLASSE;
      if (KLASSEN[t.klasse].vorm) t.vorm = KLASSEN[t.klasse].vorm;
      t.level = Number(process.env.TESTLEVEL) || 30;
      t.maxHp = maxHpVan(t);
      t.hp = t.maxHp;
    }
    room.tanks.set(socket.id, t);
    if (room.teamModus) wijsTeamToe(room, t);
    spawnTank(room, t);
    socket.join(roomId);
    socket.data.roomId = roomId;
    /*
     * De vaste eigenschappen van elke vormsoort (kleur, grootte, max levens)
     * sturen we ÉÉN keer mee. Vroeger stond dat bij elk blokje in elk
     * pakketje: met tachtig vormen in beeld was dat 11 KB, twintig keer per
     * seconde, per leerling. Nu sturen we per vorm alleen nog wat verandert.
     */
    socket.emit('welkom', {
      id: t.nr, arena: room.arena, modus, vormSoorten: VORM_INFO,
      versie: codeStempel(), verouderd: codeGewijzigdNaStart(),
    });
    zorgVoorAI(room);
  });

  /* De blokjes-runtime in de browser stuurt intents: hoe wil de tank bewegen? */
  /*
   * De rode stopknop van de leerling: zet zijn eigen arena op pauze. Alleen in
   * solo — in de gedeelde arena spelen klasgenoten door, en daar mag één
   * leerling het spel niet voor iedereen stilleggen.
   */
  socket.on('pauze', (aan) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !room.solo) return;
    room.gepauzeerd = !!aan;
  });

  socket.on('intent', (inp) => {
    const t = vindTank(socket);
    if (!t || !inp) return;
    /* Een oneindige hoek (een kind dat "richt op 10^400 graden" bouwt) maakte
       van de terugslag NaN, en dan stond de tank voorgoed nergens meer. */
    const hoek = Number(inp.angle);
    t.intent = {
      mx: klemF(inp.mx, -1, 1), my: klemF(inp.my, -1, 1),
      angle: Number.isFinite(hoek) ? hoek : (t.intent.angle || 0),
      shoot: !!inp.shoot,
      // waar de muis in de wereld staat: drones vliegen daar naartoe
      tx: klem(Number(inp.tx) || t.x, 0, arenaVan(socket).w),
      ty: klem(Number(inp.ty) || t.y, 0, arenaVan(socket).h),
    };
  });

  /* Uiterlijk-blokken: zeg / kleur / flits. */
  socket.on('actie', (a) => {
    const t = vindTank(socket);
    if (!t || !a) return;
    if (Date.now() - laatsteActieMsg < 150) return;
    laatsteActieMsg = Date.now();
    if (a.kleur && KLEUREN.includes(a.kleur)) t.kleur = a.kleur;
    if (a.vorm && ['cirkel', 'driehoek', 'vierkant', 'vijfhoek', 'ster'].includes(a.vorm)) t.vorm = a.vorm;
    if (typeof a.zeg === 'string') { t.sayText = a.zeg.replace(/[<>]/g, '').slice(0, 30); t.sayUntil = Date.now() + 2500; }
    if (a.flits && KLEUREN.includes(a.flits)) { t.flashKleur = a.flits; t.flashUntil = Date.now() + 400; }
  });

  /* Upgrade-popups: klasse kiezen op 15/30/45, statpunten verdelen. */
  socket.on('kiesKlasse', (data) => {
    const t = vindTank(socket);
    if (!t || !data) return;
    // testmodus: dan mag elke klasse, zodat je ze kan uitproberen zonder eerst
    // naar level 45 te moeten spelen (staat uit zonder omgevingsvariabele)
    const magAlles = !!process.env.TESTVRIJEKLASSE && !!KLASSEN[data.klasse];
    if (magAlles || klasseAanbod(t).includes(data.klasse)) {
      /* Je oude drones gaan mee met je oude klasse. Anders hield een leerling
         die van Necromancer naar Manager ging zijn zwerm van achttien, terwijl
         een Manager er maar negen mag hebben — en met een gewone tank vlogen
         er ineens drones rond die nergens meer bij hoorden. */
      const room0 = rooms.get(socket.data.roomId);
      if (room0) for (const b of room0.bullets) if (b.soort === 'drone' && b.eigenaar === t.id) b.weg = true;
      t.klasse = data.klasse;
      // sommige klassen hebben een eigen romp (de Necromancer is een vierkant)
      const kl = KLASSEN[t.klasse];
      if (kl && kl.vorm) t.vorm = kl.vorm;
      t.maxHp = maxHpVan(t);
      t.hp = Math.min(t.hp, t.maxHp);
    }
  });

  socket.on('kiesStat', (data) => {
    const t = vindTank(socket);
    if (!t || !data || t.statPunten <= 0) return;
    const stat = STAT_LIJST.includes(data.stat) ? data.stat : null;
    if (!stat || t.stats[stat] >= statMaxVan(t)) return;
    t.stats[stat]++;
    t.statPunten--;
    const oudMax = t.maxHp;
    t.maxHp = maxHpVan(t);
    if (t.maxHp > oudMax) t.hp += t.maxHp - oudMax; // extra max levens = meteen erbij
  });

  /* De beamer kijkt mee naar de gedeelde arena. Meekijken mag iedereen (het is
     een scorebord); de teamknoppen werken alleen voor de lesgever. */
  socket.on('beamer', (d) => {
    if (!rooms.has('arena')) maakRoom('arena', false);
    socket.join('arena');
    socket.data.isBeamer = true;
    if (magLesgeven(socket, d && d.sleutel)) socket.data.isLesgever = true;
    beamers.add(socket.id);
    // ook de beamer tekent de vormen, dus die heeft de soortentabel nodig
    socket.emit('vormSoorten', VORM_INFO);
    socket.emit('beamerRechten', { teams: !!socket.data.isLesgever });
  });

  /*
   * De browser vertelt hoe groot zijn kijkvenster is (dat verschilt: een
   * sluipschutter zoomt uit, en een chromebook heeft een kleiner scherm).
   * Zo weet de server precies hoeveel wereld hij moet opsturen.
   */
  socket.on('kijk', (d) => {
    const t = vindTank(socket);
    if (!t || !d) return;
    t.kijk = {
      w: Math.max(600, Math.min(6000, Number(d.w) || 2600)),
      h: Math.max(400, Math.min(4000, Number(d.h) || 1600)),
    };
  });

  /* Les 2: de lesgever (via de beamer) kiest 0, 2 of 4 teams. */
  socket.on('zetTeams', (n) => {
    if (!socket.data.isLesgever) return;
    lesgeverZetTeams(Number(n));
  });

  /*
   * Een leerling die in het startmenu "2 teams" of "4 teams" kiest, zet die
   * opstelling aan als er nog niets gekozen is — anders klikt hij op iets dat
   * niets doet en staat hij zonder veilige zone in de arena. Staat er al een
   * opstelling, of heeft de lesgever gekozen, dan blijft die staan: de
   * lesgever heeft altijd het laatste woord.
   */
  socket.on('kiesTeams', (n) => {
    if (![2, 4].includes(n)) return;
    const room = rooms.get(socket.data.roomId);
    if (!room || room.solo || room.teamModus || room.teamsDoorLesgever) return;
    zetTeamModus(room, n);
  });

  /* Project bewaren (autosave vanuit de editor) en terug ophalen. */
  let laatsteBewaar = 0;
  socket.on('bewaarProject', (d, cb) => {
    if (!d || typeof cb !== 'function') return;
    if (Date.now() - laatsteBewaar < 2000) return;
    laatsteBewaar = Date.now();
    const inhoud = JSON.stringify(d.werkruimte || {});
    if (inhoud.length > 200000) return; // te groot = niet bewaren
    const bestaand = typeof d.code === 'string' && CODE_VORM.test(d.code) && projecten[d.code] ? d.code : null;
    /* Eén verbinding maakt hooguit één nieuwe code aan. Zo kan niemand met een
       lusje in de console de schijf volschrijven met duizenden projecten. */
    const code = bestaand || socket.data.projectCode || nieuweProjectCode();
    socket.data.projectCode = code;
    projecten[code] = { naam: saneNaam(d.naam), werkruimte: d.werkruimte, bijgewerkt: Date.now() };
    bewaarProjectenOpSchijf();
    cb({ code });
  });

  let laatsteLaad = 0;
  socket.on('laadProject', (d, cb) => {
    if (typeof cb !== 'function') return;
    // niet eindeloos codes kunnen raden
    if (Date.now() - laatsteLaad < 400) { cb({ ok: false }); return; }
    laatsteLaad = Date.now();
    const code = String((d && d.code) || '').toUpperCase().trim();
    const p = CODE_VORM.test(code) ? projecten[code] : null;
    cb(p ? { ok: true, naam: p.naam, werkruimte: p.werkruimte } : { ok: false });
  });

  /* ---------------- de les: klasoverzicht voor de lesgever ---------------- */
  socket.on('lesStatus', (d) => {
    if (!d) return;
    const oud = klas.get(socket.id) || {};
    // een stapnummer dat geen getal is, werd NaN en bleef dan zo in het rapport staan
    const stap = klem(Math.round(Number(d.stap)) || 1, 1, 20);
    /* Les 2 heeft eigen stappen met eigen nummers (1-6). Zonder dit stond een
       les-2-leerling op het dashboard als "stap 3" van les 1. */
    const les = d.les === 2 ? 2 : 1;
    const t = vindTank(socket);
    klas.set(socket.id, {
      naam: saneNaam(d.naam),
      les,
      stap,
      status: ['bezig', 'klaar', 'vast'].includes(d.status) ? d.status : 'bezig',
      // hoeveel blokken staan er, en hoe lang is er al niets veranderd?
      blokken: klem(Number(d.blokken) || 0, 0, 999),
      stilMs: klem(Number(d.stilMs) || 0, 0, 99 * 60000),
      /* Welke van de twee vinkjes staat al groen? Daarmee zie je als lesgever
         meteen of het aan de blokken ligt (structuur) of aan het uitproberen
         (gedrag) — je weet wat je moet zeggen nog voor je bij de tafel bent. */
      checkS: !!d.checkS,
      checkG: !!d.checkG,
      code: String(d.code || '').slice(0, 12),
      // hoe staat hij ervoor in het spel zelf?
      lvl: t ? t.level : 0,
      punten: t ? t.score : 0,
      hp: t ? Math.round((t.hp / t.maxHp) * 100) : 0,
      klasse: t ? t.klasse : null,
      speelt: !!t,
      hulp: !!oud.hulp,
      hulpSinds: oud.hulpSinds || 0,
      sinds: oud.stap === stap && oud.les === les ? oud.sinds || Date.now() : Date.now(),
      bijgewerkt: Date.now(),
    });
    // voor het klasrapport achteraf: hoe ver kwam iedereen, en wanneer?
    noteerVoortgang(saneNaam(d.naam), les, stap);
  });

  /* De leerling steekt zijn hand op (of doet hem weer omlaag). */
  socket.on('hulpVraag', (aan) => {
    const l = klas.get(socket.id);
    if (!l) return;
    l.hulp = !!aan;
    l.hulpSinds = aan ? Date.now() : 0;
  });

  /* De lesgever kijkt mee en stuurt de klas — maar alleen met de juiste code
     (of vanaf de laptop zelf). Zie magLesgeven bovenaan. */
  let foutePogingen = 0;
  socket.on('lesgever', (d) => {
    if (foutePogingen >= 8) { socket.emit('lesgeverToegang', { ok: false, teVeel: true }); return; }
    if (!magLesgeven(socket, d && d.sleutel)) {
      foutePogingen++;
      socket.emit('lesgeverToegang', { ok: false });
      return;
    }
    socket.data.isLesgever = true;
    socket.join('lesgevers');
    // de code meesturen, zodat je ziet wat je op een ander toestel moet typen
    socket.emit('lesgeverToegang', { ok: true, sleutel: LESGEVER_SLEUTEL });
  });

  socket.on('lesCommando', (d) => {
    if (!socket.data.isLesgever || !d) return;
    if (d.type === 'stap' && Number.isFinite(d.stap)) {
      // voor welke les? een les-2-leerling springt niet mee met de stappen van les 1
      io.emit('lesStuur', { type: 'stap', stap: klem(d.stap, 1, 20), les: d.les === 2 ? 2 : 1 });
    } else if (d.type === 'bevries') {
      bevroren = !!d.aan;
      io.emit('lesStuur', { type: 'bevries', aan: bevroren });
    } else if (d.type === 'toonCode') {
      io.to(d.id).emit('lesStuur', { type: 'stuurCode' }); // vraag de leerling zijn blokken
    } else if (d.type === 'volg') {
      /* Live meekijken: zolang dit aanstaat vragen we de blokken elke 2 sec op.
         Eén leerling per lesgever. Vroeger bleef de vorige leerling óók
         gevolgd als je een nieuwe koos, en sprong het werkblad om de twee
         seconden heen en weer tussen die twee — je aanpassingen incluis. */
      if (d.aan && typeof d.id === 'string') gevolgd.set(socket.id, d.id);
      else gevolgd.delete(socket.id);
    } else if (d.type === 'bericht') {
      /* Een tip sturen vanachter je eigen scherm: naar één leerling of naar de
         hele klas. Precies waarvoor de lesgever anders door het lokaal moet. */
      const tekst = String(d.tekst || '').slice(0, 300);
      if (!tekst) return;
      const pakket = { type: 'bericht', tekst, aan: d.id ? 'jou' : 'klas' };
      if (d.id) io.to(d.id).emit('lesStuur', pakket);
      else io.emit('lesStuur', pakket);
    } else if (d.type === 'stapVoor' && Number.isFinite(d.stap) && d.id) {
      // één leerling verzetten zonder de rest mee te sleuren
      io.to(d.id).emit('lesStuur', { type: 'stap', stap: klem(d.stap, 1, 20), alleenJij: true });
    } else if (d.type === 'zetWerkruimte' && d.id && d.werkruimte) {
      // de lesgever grijpt in: zijn versie van de blokken gaat naar de leerling
      if (JSON.stringify(d.werkruimte).length < 200000) {
        io.to(d.id).emit('lesStuur', { type: 'werkruimte', werkruimte: d.werkruimte });
      }
    } else if (d.type === 'opruimen' && d.id) {
      io.to(d.id).emit('lesStuur', { type: 'opruimen' });
    } else if (d.type === 'hulpKlaar' && d.id) {
      const l = klas.get(d.id);
      if (l) { l.hulp = false; l.hulpSinds = 0; }
      io.to(d.id).emit('lesStuur', { type: 'hulpKlaar' });
    } else if (d.type === 'teams' && [0, 2, 4].includes(Number(d.n))) {
      lesgeverZetTeams(Number(d.n));
    } else if (d.type === 'naarArena') {
      io.emit('lesStuur', { type: 'naarArena', teams: [0, 2, 4].includes(Number(d.teams)) ? Number(d.teams) : 0 });
    } else if (d.type === 'ronde') {
      if (!rooms.has('arena')) maakRoom('arena', false);
      startRonde(rooms.get('arena'), Number(d.minuten) || 10, Number(d.doel) || 0);
    } else if (d.type === 'rondeStop') {
      const arena = rooms.get('arena');
      if (arena && arena.ronde) stopRonde(arena, 'lesgever');
      else if (arena) { arena.uitslagTot = 0; arena.gepauzeerd = false; }
    } else if (d.type === 'rapport') {
      socket.emit('klasrapport', maakRapport());
    }
  });

  /* Leerling stuurt zijn blokken door zodat de lesgever ze kan projecteren. */
  socket.on('mijnCode', (d) => {
    io.to('lesgevers').emit('leerlingCode', {
      id: socket.id,
      naam: saneNaam(d && d.naam),
      tekst: String((d && d.tekst) || '').slice(0, 4000),
      // het hele werkblad, zodat de lesgever dezelfde blokken ziet als de leerling
      werkruimte: d && d.werkruimte && JSON.stringify(d.werkruimte).length < 200000 ? d.werkruimte : null,
    });
  });

  socket.on('verlaat', () => verlaatRoom(socket));
  socket.on('disconnect', () => {
    klas.delete(socket.id); beamers.delete(socket.id); gevolgd.delete(socket.id);
    verlaatRoom(socket);
  });
});

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
  [path.join(__dirname, 'server.js'), path.join(__dirname, 'public', 'js')].forEach(kijk);
  const d = new Date(Math.min(nieuwste, GESTART_OM));
  const twee = (n) => String(n).padStart(2, '0');
  return `${twee(d.getDate())}/${twee(d.getMonth() + 1)} ${twee(d.getHours())}:${twee(d.getMinutes())}`;
}
const BRONBESTANDEN = [
  path.join(__dirname, 'server.js'),
  path.join(__dirname, 'public', 'js'),
  path.join(__dirname, 'public', 'index.html'),
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

/* Wie zit waar in de les? (socket-id → {naam, stap, status}) */
const klas = new Map();
/* Wie volgt wie? (socket-id van de lesgever → socket-id van de leerling) */
const gevolgd = new Map();
setInterval(() => {
  const leerlingen = new Set();
  for (const [lesgever, id] of gevolgd) {
    if (klas.has(id)) leerlingen.add(id);
    else gevolgd.delete(lesgever);   // weg uit de les: niet blijven vragen
  }
  for (const id of leerlingen) io.to(id).emit('lesStuur', { type: 'stuurCode' });
}, 2000);
let bevroren = false;

/*
 * Het klasrapport: hoe ver kwam elke leerling, en hoe lang deed de klas over
 * elke stap? We houden per leerling de hoogste stap bij en wanneer hij die
 * bereikte. Zo kan je na de les zien waar het spaak liep — en waar je de
 * volgende keer meer tijd voor uittrekt.
 */
const rapport = new Map();   // "les|naam" -> { naam, les, maxStap, begonnen, stapTijden }

function noteerVoortgang(naam, les, stap) {
  // les 1 en les 2 apart: stap 3 van les 2 is iets heel anders dan stap 3 van les 1
  const sleutel = `${les}|${naam}`;
  let r = rapport.get(sleutel);
  if (!r) { r = { naam, les, maxStap: stap, begonnen: Date.now(), stapTijden: {}, laatst: Date.now() }; rapport.set(sleutel, r); }
  r.laatst = Date.now();
  if (stap > r.maxStap) r.maxStap = stap;
  if (!r.stapTijden[stap]) r.stapTijden[stap] = Date.now();
}

function maakRapport() {
  const nu = Date.now();
  const leerlingen = [...rapport.values()].map((r) => {
    const stappen = Object.keys(r.stapTijden).map(Number).sort((a, b) => a - b);
    const duur = {};
    stappen.forEach((nr, i) => {
      const eind = i + 1 < stappen.length ? r.stapTijden[stappen[i + 1]] : r.laatst;
      duur[nr] = Math.max(0, Math.round((eind - r.stapTijden[nr]) / 1000));
    });
    return { naam: r.naam, les: r.les, maxStap: r.maxStap, minuten: Math.round((r.laatst - r.begonnen) / 60000), duur };
  }).sort((a, b) => b.les - a.les || b.maxStap - a.maxStap || a.naam.localeCompare(b.naam));
  // gemiddelde tijd per stap over de hele klas ("2-3" = les 2, stap 3)
  const perStap = {};
  for (const l of leerlingen) {
    for (const [nr, sec] of Object.entries(l.duur)) {
      const sleutel = l.les === 2 ? `2-${nr}` : nr;
      (perStap[sleutel] || (perStap[sleutel] = [])).push(sec);
    }
  }
  const gemiddeld = Object.fromEntries(Object.entries(perStap).map(([nr, lijst]) => [
    nr, Math.round(lijst.reduce((a, b) => a + b, 0) / lijst.length),
  ]));
  return { gemaakt: nu, leerlingen, gemiddeld };
}

/* Klasoverzicht naar de lesgever(s) sturen. */
setInterval(() => {
  const nu = Date.now();
  const lijst = [...klas.entries()]
    .filter(([, l]) => nu - l.bijgewerkt < 15000)
    .map(([id, l]) => ({
      id, naam: l.naam, les: l.les || 1, stap: l.stap, status: l.status,
      blokken: l.blokken || 0, stilMs: l.stilMs || 0,
      minuten: Math.floor((nu - l.sinds) / 60000),
      checkS: !!l.checkS, checkG: !!l.checkG, code: l.code || '',
      lvl: l.lvl || 0, punten: l.punten || 0, hp: l.hp || 0, klasse: l.klasse, speelt: !!l.speelt,
      hulp: !!l.hulp, hulpMin: l.hulp && l.hulpSinds ? Math.floor((nu - l.hulpSinds) / 60000) : 0,
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
  const arena = rooms.get('arena');
  io.to('lesgevers').emit('klasoverzicht', {
    leerlingen: lijst,
    bevroren,
    teamModus: arena ? arena.teamModus : 0,
    inArena: arena ? [...arena.tanks.values()].filter((t) => !t.ai).length : 0,
    // loopt er een ronde? dan de klok en de tussenstand mee
    ronde: arena && arena.ronde
      ? { over: Math.max(0, Math.round((arena.ronde.eind - nu) / 1000)),
          doel: arena.ronde.doel, teams: rondeStand(arena).teams }
      : null,
    verouderd: codeGewijzigdNaStart(),   // code aangepast sinds het starten?
  });
}, 1500);

function vindTank(socket) {
  const room = rooms.get(socket.data.roomId);
  return room ? room.tanks.get(socket.id) : null;
}

function verlaatRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room) {
    room.tanks.delete(socket.id);
    const spelersOver = [...room.tanks.values()].some((t) => !t.ai);
    if (!spelersOver && room.id !== 'arena') rooms.delete(roomId);
  }
  socket.leave(roomId);
  socket.data.roomId = null;
}

function klemF(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

/* ------------------------------------------------------------------ */
/* De spel-loop                                                        */
/* ------------------------------------------------------------------ */
let vorigeTick = Date.now();

/*
 * Eén fout mag nooit de hele klas platleggen. Een onverwachte fout in de
 * spel-lus of in een bericht van één browser liet vroeger het hele programma
 * stoppen: zwart venster dicht, iedereen uit het spel. Nu schrijven we de fout
 * op (hooguit één keer per tien seconden dezelfde) en draait de rest door.
 */
const gemeldeFouten = new Map();
function meldFout(waar, err) {
  const tekst = `${waar}: ${(err && err.stack) || err}`;
  const nu = Date.now();
  if (nu - (gemeldeFouten.get(tekst) || 0) < 10000) return;
  gemeldeFouten.set(tekst, nu);
  console.log(`   ⚠ fout in ${tekst}`);
}
process.on('uncaughtException', (err) => meldFout('server', err));

/*
 * EEN KLOK DIE OOK OP WINDOWS KLOPT. Op Windows gaat een timer van Node maar
 * om de 15,6 ms af. setInterval(…, 33) liep daardoor 21 keer per seconde in
 * plaats van 30, en de wereld ging 16 keer per seconde naar de leerlingen in
 * plaats van 20 (gemeten op de lesgeverslaptop). Alles bewoog schokkeriger dan
 * nodig. Deze klok onthoudt wanneer de volgende beurt had moeten komen: komt
 * een beurt te laat, dan wacht de volgende korter. Zo haal je gemiddeld
 * precies het gevraagde aantal per seconde. Online (Linux) verandert er niets.
 */
function elke(ms, fn) {
  let volgende = performance.now() + ms;
  const beurt = () => {
    fn();
    volgende += ms;
    const nu = performance.now();
    // lag de laptop even te slapen? dan niet alles inhalen, gewoon verder
    if (nu - volgende > ms * 5) volgende = nu + ms;
    const wacht = volgende - nu;
    if (wacht <= 1) setImmediate(beurt);
    else setTimeout(beurt, wacht);
  };
  setTimeout(beurt, ms);
}

elke(1000 / 30, () => {
  const nu = Date.now();
  const dt = Math.min(0.1, (nu - vorigeTick) / 1000);
  vorigeTick = nu;

  for (const room of rooms.values()) {
    try { tickRoom(room, nu, dt); } catch (err) { meldFout(`arena ${room.id}`, err); }
  }
});

function tickRoom(room, nu, dt) {
  /*
   * "Ogen op mij": dan staat ELKE arena stil. Vroeger stonden alleen de tanks
   * van de leerlingen stil, terwijl de robots in hun eigen arena gewoon bleven
   * schieten — wie twee minuten naar de lesgever keek, lag intussen drie keer
   * kapot. De klok van een lopende ronde wacht ook.
   */
  if (bevroren) {
    const ms = Math.round(dt * 1000);
    room.gestartOm += ms;
    if (room.ronde) room.ronde.eind += ms;
    if (room.uitslagTot) room.uitslagTot += ms;
    return;
  }
  bewaakRonde(room, nu);
  /*
   * Op pauze staat de wereld helemaal stil: robots, kogels en vormen bewegen
   * niet meer. Alleen mogelijk in je eigen solo-arena — in de gedeelde arena
   * zou één leerling het spel voor de hele klas stilzetten. De klant zet dit
   * aan met de rode stopknop, zodat je rustig aan je blokken kan werken
   * zonder dat een robot je ondertussen kapot schiet.
   */
  if (room.gepauzeerd) {
    room.gestartOm += Math.round(dt * 1000);   // opwarmtijd loopt niet door
    return;
  }
  // het tijdstip van deze stand van de wereld (gaat mee in elk pakketje)
  room.tickTijd = nu;
  zorgVoorAI(room);
  // vormen bijleggen hoeft geen dertig keer per seconde: om de halve seconde
  // merkt niemand, en zo telt de server niet elke tik de hele arena na
  room.vulTeller = ((room.vulTeller || 0) + 1) % 15;
  if (room.vulTeller === 1) vulVormenAan(room);
  bouwVormRaster(room);   // eerst de vakjes vullen, dan pas rekenen

  for (const v of room.vormen) {
    if (v.weg) continue;
    v.hoek += v.draai * dt;
    // "Polygons will regenerate health if they are left unharmed for at least
    // thirty seconds" (wiki). Zo kan je een dikke vorm niet in tien beurten
    // van een afstandje kapotknabbelen.
    if (v.hp < v.maxHp && nu - (v.laatsteSchade || 0) > 30000) {
      v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.08 * dt);
    }
  }

  /*
   * Crashers bewaken het nest: zien ze een speler in de buurt, dan gaan ze
   * erop af. Raken ze te ver van het nest, dan keren ze terug — zo blijven ze
   * bij de dikke vormen en heeft een beginner er buiten het midden geen last
   * van. (https://diepio.fandom.com/wiki/Crashers)
   */
  /*
   * Crashers moeten het nest écht bewaken: daar liggen de vijfhoeken en alfa's
   * die veruit het meeste opleveren. Met een klein zichtveld kon je er gewoon
   * tussendoor rijden. Ze zien je nu van verder en gaan sneller — je moet ze
   * neerschieten of wegblijven.
   */
  const CRASHER_ZICHT = 620;
  const CRASHER_SNELHEID = 210;
  for (const v of room.vormen) {
    if (v.weg || !v.jaagt) continue;
    const nest = nestVan(room);
    let doelX = nest.x + nest.w / 2, doelY = nest.y + nest.h / 2;
    const verVanNest = Math.hypot(doelX - v.x, doelY - v.y) > Math.max(nest.w, nest.h) * 0.75;
    if (!verVanNest) {
      let dichtst = null, best = CRASHER_ZICHT;
      for (const t of room.tanks.values()) {
        if (nu < t.deadUntil || isVeilig(room, t, nu)) continue;   // ook robots worden aangevallen
        const d = Math.hypot(t.x - v.x, t.y - v.y);
        if (d < best) { best = d; dichtst = t; }
      }
      if (dichtst) { doelX = dichtst.x; doelY = dichtst.y; }
      else { v.vx *= 0.9; v.vy *= 0.9; continue; }   // rustig rondhangen
    }
    const dx = doelX - v.x, dy = doelY - v.y, d = Math.hypot(dx, dy) || 1;
    v.vx += ((dx / d) * CRASHER_SNELHEID - v.vx) * Math.min(1, dt * 2.5);
    v.vy += ((dy / d) * CRASHER_SNELHEID - v.vy) * Math.min(1, dt * 2.5);
    v.x = klem(v.x + v.vx * dt, v.r, room.arena.w - v.r);
    v.y = klem(v.y + v.vy * dt, v.r, room.arena.h - v.r);
  }

  for (const t of room.tanks.values()) {
    if (nu < t.deadUntil) continue;
    if (t.deadUntil !== 0) {
      // respawn-moment
      if (t.ai) { room.tanks.delete(t.id); continue; }
      respawnZwakker(room, t);
    }

    if (t.ai) stuurAI(room, t, nu);

    // bewegen volgens intent: eerst versnellen, dan pas verplaatsen
    const len = Math.hypot(t.intent.mx, t.intent.my);
    const top = snelheidVan(t);
    let doelVx = 0, doelVy = 0;
    if (len > 0.05) {
      // schuin lopen is niet sneller dan recht: de richting wordt genormaliseerd
      const kracht = Math.min(1, len);
      doelVx = (t.intent.mx / len) * top * kracht;
      doelVy = (t.intent.my / len) * top * kracht;
      t.laatsteActie = nu;
    }
    const grip = Math.min(1, dt * (len > 0.05 ? VERSNELLING : WRIJVING));
    t.vx = (t.vx || 0) + (doelVx - (t.vx || 0)) * grip;
    t.vy = (t.vy || 0) + (doelVy - (t.vy || 0)) * grip;
    if (Math.abs(t.vx) < 1 && !doelVx) t.vx = 0;
    if (Math.abs(t.vy) < 1 && !doelVy) t.vy = 0;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    // terugslag van het laatste schot uitwerken (dooft snel uit)
    if (t.rvx || t.rvy) {
      t.x += t.rvx * dt;
      t.y += t.rvy * dt;
      const demping = Math.pow(0.06, dt);   // ~94% weg per seconde
      t.rvx *= demping;
      t.rvy *= demping;
      if (Math.abs(t.rvx) < 1 && Math.abs(t.rvy) < 1) { t.rvx = 0; t.rvy = 0; }
    }
    const straal = straalVan(t);
    t.x = Math.max(straal, Math.min(room.arena.w - straal, t.x));
    t.y = Math.max(straal, Math.min(room.arena.h - straal, t.y));
    t.angle = t.intent.angle;

    // robots kunnen de thuisbasis niet in
    if (t.ai && inBasis(room, t.x, t.y)) {
      const b = basisVan(room);
      const naarRechts = (b.x + b.w) - t.x;
      const naarBoven = t.y - b.y;
      if (naarRechts < naarBoven) t.x = b.x + b.w + straalVan(t);
      else t.y = b.y - straalVan(t);
    }

    // genezen (zoals diep.io): traag passief; maar heb je ~8 sec geen schade
    // gehad, dan schiet de regen in de snelle modus (levensregen-stat telt zwaar
    // mee). In een veilige zone (thuisbasis of eigen teamzone) genees je extra.
    if (!t.ai) {
      /*
       * Genezen werkt overal, niet alleen thuis. Buiten je basis moest je
       * vroeger 20 seconden wachten op één levenspunt — op een grote kaart is
       * teruglopen naar huis dan de enige optie, en dat is saai. Nu geldt:
       * even niet geschoten en niet geraakt, dan begint je tank te herstellen.
       * Hoe hard, dat hangt af van je stat levensregeneratie — met punten erin
       * sta je in seconden weer vol, zonder punten duurt het een minuutje.
       */
      let regen = regenPerSec(t);
      const rustig = nu - t.laatsteSchade > 5000 && nu - (t.laatsteSchot || 0) > 3000;
      if (rustig) regen = regen * 6 + 0.8 + t.stats.levensregen * 0.7;
      const veiligeZone = inBasis(room, t.x, t.y) || inEigenZone(room, t);
      if (veiligeZone) regen += 8;   // thuis blijft het snelst
      if (regen > 0) t.hp = Math.min(t.maxHp, t.hp + regen * dt);
    }

    // Botsen met vormen (zoals diep.io): je duwt ze opzij en je doet elkaar
    // lichaamsschade. Erop inrijden is dus een échte manier om een blokje
    // kapot te maken — en een gevaarlijke, want jij verliest ook levens.
    // Muren blokkeren volledig en doen geen schade.
    const mijnStraal = straalVan(t);
    const dichtbijT = vormenRondom(room, t.x, t.y, buurVormen);
    for (let i = 0; i < dichtbijT.length; i++) {
      const v = dichtbijT[i];
      if (v.weg) continue;
      const dx = t.x - v.x, dy = t.y - v.y;
      const min = mijnStraal + v.r;
      // grof filter eerst: verreweg de meeste vormen liggen niet in de buurt
      const grof = min + 1;
      if (dx > grof || dx < -grof || dy > grof || dy < -grof) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      // 1 px speling: ook wie er tegenaan geduwd blijft staan (bv. klem tegen
      // de rand) blijft schade geven en krijgen — anders stopt het schuren.
      if (d >= min + 1 || d <= 0.01) continue;
      const nx = dx / d, ny = dy / d;

      if (v.blokkeert) { // muur: gewoon terugduwen, geen schade
        if (d < min) { t.x = v.x + nx * min; t.y = v.y + ny * min; }
        continue;
      }

      /*
       * Crashers (de roze driehoekjes) RAMMEN je, ze ontploffen niet.
       * Eerst lieten we ze bij de eerste aanraking verdwijnen met één harde
       * klap; dan voelde het alsof ze door je tank heen vlogen. In diep.io
       * botsen ze echt: ze duwen je opzij en blijven tegen je aan beuken tot
       * jij of zij het niet meer houdt. Ze duwen harder en doen meer pijn dan
       * een gewoon blokje — dat is hun hele bestaansreden als bewaker van het
       * nest. Met tien levens houdt een crasher het maar even vol tegen een
       * tank die terugramt. (https://diepio.fandom.com/wiki/Crashers)
       */
      const ram = v.jaagt ? 2.6 : 1;

      // de vorm wijkt, de tank schuift een beetje terug (de tank wint)
      if (d < min) {
        const overlap = min - d;
        const deelVorm = v.jaagt ? 0.55 : 0.75;   // een crasher laat zich minder wegduwen
        v.x -= nx * overlap * deelVorm;
        v.y -= ny * overlap * deelVorm;
        // vormen mogen het speelveld niet uit geduwd worden
        v.x = klem(v.x, v.r, room.arena.w - v.r);
        v.y = klem(v.y, v.r, room.arena.h - v.r);
        t.x += nx * overlap * (1 - deelVorm);
        t.y += ny * overlap * (1 - deelVorm);
      }

      // schade in beide richtingen
      beschadigTank(room, t, v.botsschade * ram * dt, null, nu, true);
      v.hp -= botsschadeVan(t, 'vorm') * dt;
      v.laatsteSchade = nu;
      v.hitUntil = nu + 150;
      if (v.hp <= 0) {
        v.weg = true;
        toverVormOmTotDrone(room, t, v);
        if (!t.ai) {
          geefPunten(room, t, v.punten);
          stuurEvent(t, 'punten', { n: v.punten, x: Math.round(v.x), y: Math.round(v.y) });
        }
      }
    }

    // schieten
    const kl = klasseVan(t);

    /* Drone-klassen (Opzichter/Overheer) maken vanzelf helpertjes aan tot hun
       maximum. Je hoeft er dus niet voor te schieten — schieten stuurt ze
       alleen wél op je doel af. Zie https://diepio.fandom.com/wiki/Drones */
    /* Welke lopen maken drones? Bij een echte dronetank alle, maar de Hybride
       heeft er maar één achterop (de rest schiet gewone kogels). */
    const droneLopen = kl.munitie === 'drone'
      ? kl.lopen.filter((l) => !l.munitie || l.munitie === 'drone')
      : kl.lopen.filter((l) => l.munitie === 'drone');
    if (droneLopen.length && nu > (kl.munitie === 'drone' ? t.reloadUntil : (t.droneHerlaadTot || 0))) {
      const mijn = room.bullets.filter((b) => b.soort === 'drone' && !b.weg && b.eigenaar === t.id).length;
      if (mijn < (kl.droneMax || 8)) {
        if (kl.munitie === 'drone') t.reloadUntil = nu + herlaadMsVan(t);
        else t.droneHerlaadTot = nu + herlaadMsVan(t) * 2;
        const loop = droneLopen[Math.floor(Math.random() * droneLopen.length)];
        const hoek = t.angle + loop.hoek;
        room.bullets.push({
          id: room.volgendKogelId++, soort: 'drone',
          x: t.x + Math.cos(hoek) * loopLengte(loop), y: t.y + Math.sin(hoek) * loopLengte(loop),
          vx: Math.cos(hoek) * 90, vy: Math.sin(hoek) * 90,
          hoek, eigenaar: t.id, kleur: t.kleur, team: t.team,
          // Necromancer stuurt vierkanten de lucht in, de Fabriek kleine tankjes
          vorm: kl.droneVorm || 'driehoek',
          r: loop.w * 0.42 * (kl.kogelSchaal || 1),
          schade: bulletSchadeVan(t) * 0.55,
          leven: (3 + bulletPierce(t)) * (kl.kogelLeven || 1),
          dood: Infinity,           // drones blijven tot ze kapotgeschoten worden
        });
      }
    }

    /*
     * AUTOMATISCH GESCHUT (Auto 3, Auto 5). Bovenop de tank zit een torentje
     * dat helemaal zelf mikt: het zoekt de dichtstbijzijnde vijand binnen zijn
     * bereik, draait die kant op en schiet op eigen ritme. De speler hoeft er
     * niets voor te doen — dat is het hele idee van deze klasse.
     */
    if (kl.auto) {
      /* Zoek één doel voor alle koepels samen: eerst de dichtstbijzijnde
         vijand, en is die er niet, dan een vorm in de buurt. Alle koepels
         draaien mee en vuren tegelijk — zoals in diep.io. */
      let doel = null, best = kl.auto.bereik;
      for (const ander of room.tanks.values()) {
        if (ander.id === t.id || nu < ander.deadUntil || ander.onzichtbaar) continue;
        if (t.team !== null && t.team !== undefined && ander.team === t.team) continue;
        const d = Math.hypot(ander.x - t.x, ander.y - t.y);
        if (d < best) { best = d; doel = ander; }
      }
      if (!doel) {
        let vBest = kl.auto.bereik * 0.8;
        const buurt = vormenRondom(room, t.x, t.y, buurVormen);
        for (const v of buurt) {
          if (v.weg || v.type === 'muur') continue;
          const d = Math.hypot(v.x - t.x, v.y - t.y);
          if (d < vBest) { vBest = d; doel = v; }
        }
      }
      if (doel) {
        t.autoHoek = Math.atan2(doel.y - t.y, doel.x - t.x);
        if (nu > (t.autoHerlaadTot || 0)) {
          t.autoHerlaadTot = nu + kl.auto.herlaadMs;
          const snelheidA = BULLET_SPEED * bulletSnelheidFactor(t) * (kl.auto.kogelSnelheid || 1);
          const voet = kl.auto.voet || 0;
          // elke koepel vuurt: bij een Auto 3 zijn dat er drie tegelijk
          for (const montage of (kl.torens || [0])) {
            const groei = straalVan(t) / TANK_RADIUS;
            const mx = Math.cos(t.angle + montage) * voet * groei;
            const my = Math.sin(t.angle + montage) * voet * groei;
            room.bullets.push({
              id: room.volgendKogelId++, soort: 'kogel',
              x: t.x + mx + Math.cos(t.autoHoek) * (kl.auto.len + kl.auto.straal) * groei,
              y: t.y + my + Math.sin(t.autoHoek) * (kl.auto.len + kl.auto.straal) * groei,
              vx: Math.cos(t.autoHoek) * snelheidA,
              vy: Math.sin(t.autoHoek) * snelheidA,
              eigenaar: t.id, kleur: t.kleur, team: t.team,
              r: kl.auto.kogelR || kl.auto.w * 0.42 * 1.5,
              schade: bulletSchadeVan(t) * kl.auto.schade,
              leven: 1 + bulletPierce(t),
              dood: nu + BULLET_LIFE,
            });
          }
          t.laatsteSchot = nu;
        }
      } else {
        // geen doel: de koepels kijken weer voor zich uit
        t.autoHoek = t.angle;
      }
    }

    /* Ook een dronetank kan een gewone loop hebben: de Overtrapper heeft naast
       zijn twee dronebays een valstrikwerper achterop. Dit stuk werd voor élke
       dronetank overgeslagen, dus die werper deed helemaal niets. */
    const kogelLopen = kl.lopen.some((l) => (l.munitie || kl.munitie) !== 'drone' && !l.schijn);
    const droneKlasse = kl.munitie === 'drone';
    if (t.intent.shoot && kogelLopen && (droneKlasse || nu > t.reloadUntil)) {
      // bij een dronetank loopt de dronefabriek op t.reloadUntil; die laten we
      // met rust, de losse loop heeft zijn eigen ritme (loop.herlaad)
      if (!droneKlasse) t.reloadUntil = nu + herlaadMsVan(t);
      t.laatsteActie = nu;
      t.laatsteSchot = nu;           // pauzeert het genezen
      /*
       * Terugslag. Een Vernietiger of Annihilator duwt zichzelf flink achteruit
       * bij elk schot — in diep.io gebruik je dat zelfs om vooruit te komen:
       * omdraaien en achteruit "raketten". Zonder dit voelde zo'n kanon als
       * een gewoon geweer. https://diepwiki.io/#/tanks/destroyer
       */
      if (kl.recoil) {
        t.rvx = (t.rvx || 0) - Math.cos(t.angle) * kl.recoil * RECOIL_KRACHT;
        t.rvy = (t.rvy || 0) - Math.sin(t.angle) * kl.recoil * RECOIL_KRACHT;
      }
      if (!t.ai) t.beschermTot = 0; // wie schiet, geeft zijn spawnbescherming op
      const snelheid = BULLET_SPEED * kl.kogelSnelheid * bulletSnelheidFactor(t);
      /*
       * Klassen met kl.afwisselend (Twin, Dubbelflank) vuren om de beurt uit
       * één loop, precies zoals in diep.io: https://diepio.fandom.com/wiki/Twin
       * Zonder dit kwamen er twee kogels tegelijk uit, en dat is een andere
       * tank — dubbel zoveel kogels in de lucht en een heel ander schietritme.
       */
      let teVuren = kl.lopen;
      if (kl.afwisselend && kl.lopen.length > 1) {
        /* Lopen met hetzelfde groepsnummer vuren samen. De Twin heeft twee
           groepen van één loop (links, rechts); de Dubbelflank twee groepen van
           twee (de voor- én achterloop aan dezelfde kant). Zonder groepen zou
           die laatste vier losse schoten na elkaar geven i.p.v. twee paren. */
        const groepen = [...new Set(kl.lopen.map((l, i) => (l.groep === undefined ? i : l.groep)))];
        t.loopBeurt = ((t.loopBeurt || 0) + 1) % groepen.length;
        const nu = groepen[t.loopBeurt];
        teVuren = kl.lopen.filter((l, i) => (l.groep === undefined ? i : l.groep) === nu);
      }
      for (const loop of teVuren) {
        // een dronebay maakt drones, geen kogels — let op: de meeste bays laten
        // munitie leeg en erven 'drone' van de klasse, dus dát moet je testen
        if ((loop.munitie || kl.munitie) === 'drone') continue;
        if (loop.schijn) continue;                // alleen om te zien (de trapjes van de Streamliner)
        /* Een loop mag een eigen ritme hebben. De valstrikwerper achterop de
           Gunner Trapper laadt bijvoorbeeld veel trager dan de loopjes
           vooruit — anders spuwt hij valstrikken alsof het kogels zijn. Bij een
           dronetank is dat verplicht: die heeft geen gedeelde herlaadtijd voor
           kogels, dus zonder eigen timer zou zo'n loop élke tik vuren. */
        if (droneKlasse || loop.herlaad) {
          const sleutel = 'lh' + kl.lopen.indexOf(loop);
          if (nu < (t[sleutel] || 0)) continue;
          t[sleutel] = nu + herlaadMsVan(t) * (loop.herlaad || 1);
        }
        const richting = t.angle + loop.hoek + (kl.spreiding ? (Math.random() - 0.5) * 2 * kl.spreiding : 0);
        const zijHoek = t.angle + loop.hoek + Math.PI / 2;
        room.bullets.push({
          id: room.volgendKogelId++,
          // loop.start telt mee: bij de Jager staat de voorste loop verder
          // naar voren, dus daar hoort de kogel ook uit te komen
          x: t.x + Math.cos(t.angle + loop.hoek) * (loopLengte(loop)) + Math.cos(zijHoek) * loop.zij,
          y: t.y + Math.sin(t.angle + loop.hoek) * (loopLengte(loop)) + Math.sin(zijHoek) * loop.zij,
          vx: Math.cos(richting) * snelheid,
          vy: Math.sin(richting) * snelheid,
          eigenaar: t.id, kleur: t.kleur, team: t.team,
          // Zoals diep.io: een kogel VULT zijn loop. De breedte van het kanon
          // bepaalt dus de grootte — niet je level en niet je upgrades. Zo
          // heeft een robot met hetzelfde kanon even grote kogels als jij.
          // Volgorde klopt met de wiki: gunner < basis < destroyer < annihilator.
          r: loop.w * 0.42 * (kl.kogelSchaal || 1),
          soort: (loop.munitie || kl.munitie) === 'trap' ? 'trap'
            : (loop.munitie || kl.munitie) === 'raket' ? 'raket' : 'kogel',
          // raketten blijven onderweg zelf vuren (Skimmer, Rocketeer)
          raket: (loop.munitie || kl.munitie) === 'raket' ? Object.assign({ vanaf: nu }, kl.raket) : null,
          hoek: richting,
          schade: bulletSchadeVan(t) * (loop.schade || 1),
          /* kogelpantser = "bullet health": hoeveel keer de kogel iets mag raken
             (vorm, tank of vijandelijke kogel) voordat hij verdwijnt. Grote
             kogels (destroyer/annihilator) doorboren van nature meer, en
             klassen met kl.kogelLeven doorboren extra — die vermenigvuldiger
             werd hier vergeten, waardoor de Vernietiger en de Gunner Trapper
             hun doorboorkracht van de wiki niet kregen. */
          leven: (bulletPierce(t) + ((loop.munitie || kl.munitie) === 'trap' ? 3 : 0)
            + (loop.w * 0.42 >= 12 ? 2 : 0)) * (kl.kogelLeven || 1),
          // traps blijven lang liggen (wiki: ~24 sec), kogels leven 3 sec
          dood: nu + ((loop.munitie || kl.munitie) === 'trap' ? (kl.trapLeven || 24000) : BULLET_LIFE),
        });
      }
    }

    // sluiper: onzichtbaar na 2 sec niets doen
    t.onzichtbaar = !!(kl.sluip && nu - t.laatsteActie > 2000);

    // botsschade: elk paar tanks dat elkaar raakt doet lichaamsschade
    // (rammer/stekelbol via klasse-multiplier, gewone tanks via de botsschade-stat)
    for (const ander of room.tanks.values()) {
      if (ander.id === t.id || nu < ander.deadUntil) continue;
      if (Math.hypot(ander.x - t.x, ander.y - t.y) < straalVan(t) + straalVan(ander) + 4) {
        beschadigTank(room, ander, botsschadeVan(t, 'tank') * dt, t, nu, true);
      }
    }
  }

  beperkMunitie(room);
  munitieTegenMunitie(room);

  // kogels bewegen en raken vormen/tanks
  const over = [];
  vulBasisDronesAan(room, nu);

  for (const b of room.bullets) {
    if (b.weg) continue;

    /*
     * RAKETTEN (Skimmer, Rocketeer). Een raket is een dikke trage kogel die
     * onderweg zelf blijft vuren: de Skimmer schiet naar achteren, de
     * Rocketeer gebruikt zijn uitlaat om steeds harder te gaan. Zo zijn ze
     * meer dan alleen een grote kogel.
     */
    if (b.soort === 'raket' && b.raket) {
      if (b.raket.stuw) {
        const sn = Math.hypot(b.vx, b.vy) || 1;
        b.vx += (b.vx / sn) * b.raket.stuw * dt;
        b.vy += (b.vy / sn) * b.raket.stuw * dt;
      }
      if (nu > (b.raketTot || 0)) {
        b.raketTot = nu + b.raket.herlaadMs;
        const achter = Math.atan2(b.vy, b.vx) + Math.PI + (Math.random() - 0.5) * 0.5;
        room.bullets.push({
          id: room.volgendKogelId++, soort: 'kogel',
          x: b.x + Math.cos(achter) * b.r, y: b.y + Math.sin(achter) * b.r,
          vx: Math.cos(achter) * BULLET_SPEED * 0.55,
          vy: Math.sin(achter) * BULLET_SPEED * 0.55,
          eigenaar: b.eigenaar, kleur: b.kleur, team: b.team,
          r: b.r * 0.42, schade: b.schade * b.raket.schade,
          leven: 1, dood: nu + BULLET_LIFE * 0.5,
        });
      }
    }

    /*
     * Basisdrones bewaken de teamzone. Ze cirkelen rustig rond in hun eigen
     * base en schieten eropaf zodra er een vijand te dicht komt; die kan dan
     * alleen ontsnappen door weg te rijden. Precies zoals in diep.io:
     * https://diepio.fandom.com/wiki/Base_Drones
     */
    if (b.soort === 'basisdrone') {
      const zone = teamZones(room).find((z) => z.team === b.team);
      if (!zone) { b.weg = true; continue; }
      const post = basisDronePost(zone, b.post || 0, aantalBasisDrones(zone));
      let doel = null, besteD = BASISDRONE_ZICHT;
      for (const t of room.tanks.values()) {
        if (nu < t.deadUntil || t.team === b.team) continue;
        const d = Math.hypot(t.x - b.x, t.y - b.y);
        if (d < besteD) { besteD = d; doel = t; }
      }
      let doelX, doelY;
      if (doel) { doelX = doel.x; doelY = doel.y; }
      else {
        // rustig rondje draaien rond de eigen post
        const hoek = nu / 1400 + (b.post || 0) * 0.9;
        const straal = Math.min(120, Math.min(zone.w, zone.h) * 0.22);
        doelX = post.x + Math.cos(hoek) * straal;
        doelY = post.y + Math.sin(hoek) * straal;
      }
      // te ver van zijn post? eerst terug — ze mogen niet de hele arena over
      if (Math.hypot(b.x - post.x, b.y - post.y) > BASISDRONE_LOS) { doelX = post.x; doelY = post.y; }
      const dx = doelX - b.x, dy = doelY - b.y, d = Math.hypot(dx, dy) || 1;
      b.vx += ((dx / d) * BASISDRONE_SNELHEID - b.vx) * Math.min(1, dt * 3.4);
      b.vy += ((dy / d) * BASISDRONE_SNELHEID - b.vy) * Math.min(1, dt * 3.4);
      b.hoek = Math.atan2(b.vy, b.vx);
    }

    if (b.soort === 'drone') {
      // Drones zoeken zelf de dichtstbijzijnde vijand; is die er niet, dan
      // cirkelen ze rond hun baas. Schiet hun baas, dan gaan ze op zijn doel af.
      const baas = room.tanks.get(b.eigenaar);
      if (!baas || nu < baas.deadUntil) { b.weg = true; continue; }
      let doelX, doelY;
      if (baas.intent.shoot) {
        /* Klik je, dan verzamelen je drones zich op je muisaanwijzer, precies
           zoals in diep.io (https://diepio.fandom.com/wiki/Overseer). Eerder
           vlogen ze naar een punt 700 px vér in je kijkrichting, waardoor ze
           over je doel heen schoten als dat dichtbij stond. Robots hebben geen
           muis; die mikken op de richting van hun geschut. */
        if (baas.ai) {
          doelX = baas.x + Math.cos(baas.angle) * 700;
          doelY = baas.y + Math.sin(baas.angle) * 700;
        } else {
          doelX = baas.intent.tx;
          doelY = baas.intent.ty;
        }
      } else {
        let best = null, bestD = 620;
        for (const ander of room.tanks.values()) {
          if (ander.id === baas.id || nu < ander.deadUntil) continue;
          if (ander.team !== null && ander.team === baas.team) continue;
          if (isVeilig(room, ander, nu)) continue;
          const d = Math.hypot(ander.x - b.x, ander.y - b.y);
          if (d < bestD) { bestD = d; best = ander; }
        }
        if (best) { doelX = best.x; doelY = best.y; }
        else { // rustig rondcirkelen om de baas
          const a = nu / 900 + (b.id % 12) * 0.52;
          doelX = baas.x + Math.cos(a) * 130;
          doelY = baas.y + Math.sin(a) * 130;
        }
      }
      const dx = doelX - b.x, dy = doelY - b.y, d = Math.hypot(dx, dy) || 1;
      const DRONE_V = 210 + (baas.ai ? 0 : baas.stats.kogelsnelheid * 12);
      b.vx += ((dx / d) * DRONE_V - b.vx) * Math.min(1, dt * 3.2);
      b.vy += ((dy / d) * DRONE_V - b.vy) * Math.min(1, dt * 3.2);
      b.hoek = Math.atan2(b.vy, b.vx);
    } else if (b.soort === 'trap') {
      // Traps vliegen vooruit, remmen snel af en blijven dan liggen.
      b.vx *= Math.pow(0.02, dt);
      b.vy *= Math.pow(0.02, dt);
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.soort === 'drone' || b.soort === 'trap') { // binnen het veld houden
      b.x = klem(b.x, b.r, room.arena.w - b.r);
      b.y = klem(b.y, b.r, room.arena.h - b.r);
    }
    if (nu > b.dood || b.x < 0 || b.x > room.arena.w || b.y < 0 || b.y > room.arena.h) continue;

    // vijandelijke kogels lossen op aan de rand van de thuisbasis
    if (inBasis(room, b.x, b.y)) {
      const schutter = room.tanks.get(b.eigenaar);
      if (schutter && schutter.ai) continue;
    }

    let dood = false;

    // raakt een vorm? (kan er meerdere doorboren zolang er leven over is)
    /* Alleen de vormen uit de vakjes rondom deze kogel; en geen Math.hypot
       (een wortel is duur), maar de kwadraten vergelijken. */
    const dichtbij = vormenRondom(room, b.x, b.y, buurVormen);
    for (let i = 0; i < dichtbij.length; i++) {
      const v = dichtbij[i];
      if (v.weg) continue;
      const vdx = v.x - b.x, vdy = v.y - b.y, vmin = v.r + b.r;
      if (vdx > vmin || vdx < -vmin || vdy > vmin || vdy < -vmin) continue;
      if (vdx * vdx + vdy * vdy < vmin * vmin) {
        v.hp -= b.schade;
        v.laatsteSchade = nu;
        v.hitUntil = nu + 150; // wit flitsje (animatie)
        if (v.hp <= 0) {
          v.weg = true;
          const schutter = room.tanks.get(b.eigenaar);
          toverVormOmTotDrone(room, schutter, v);
          if (schutter && !schutter.ai) {
            geefPunten(room, schutter, v.punten);
            stuurEvent(schutter, 'punten', { n: v.punten, x: Math.round(v.x), y: Math.round(v.y) });
          }
        }
        /* Een drone die tegen een vierkant botst gaat NIET stuk: hij duwt door
           en blijft rondvliegen, net als in diep.io. Alleen kogels en traps
           slijten op vormen. Zonder dit smolt een zwerm weg tegen de polygons
           en waren alle drone-klassen half zo sterk als de rest. */
        if (b.soort !== 'drone' && b.soort !== 'basisdrone') {
          b.leven -= 1;
          if (b.leven <= 0) dood = true;
        }
        break; // hooguit één vorm per tik
      }
    }
    if (dood) continue;

    // raakt een tank? (elke tank hoogstens één keer per kogel)
    const blijftRammen = b.soort === 'drone' || b.soort === 'basisdrone';
    for (const t of room.tanks.values()) {
      if (t.id === b.eigenaar || nu < t.deadUntil) continue;
      /* Munitie van je eigen team vliegt DWARS DOOR je heen. Schade deed het al
         niets (zie beschadigTank), maar de kogel bleef wél in je hangen: hij
         ging stuk op jou en een drone van een teammaat duwde je opzij. Dat
         voelde als "mijn teamgenoten vallen me aan" — en het blokkeerde de
         schoten van je maatje op de vijand. */
      if (b.team !== null && b.team !== undefined && t.team === b.team) continue;
      // Een kogel raakt elke tank hoogstens één keer. Een drone blijft rammen:
      // die mag dezelfde tank opnieuw raken na een korte pauze, anders is hij
      // na één treffer nutteloos.
      const vorige = b.geraakt && b.geraakt.get(t.id);
      if (vorige && (!blijftRammen || nu - vorige < 300)) continue;
      const bmin = straalVan(t) + b.r;
      if (Math.hypot(t.x - b.x, t.y - b.y) < bmin) {
        const schutter = room.tanks.get(b.eigenaar);
        beschadigTank(room, t, b.schade, schutter, nu);
        (b.geraakt || (b.geraakt = new Map())).set(t.id, nu);
        if (!blijftRammen) {            // een kogel gaat op
          b.leven -= 1;
          if (b.leven <= 0) dood = true;
        } else {
          /*
           * Drones BOTSEN: ze vlogen vroeger dwars door je tank heen en deden
           * alleen schade, waardoor het leek alsof ze meteen ontploften. Nu
           * worden ze netjes tegen de rand van je tank gezet en geven ze je
           * een duwtje — je voelt de klap, en zij blijven bestaan om opnieuw
           * aan te vallen.
           */
          const bdx = b.x - t.x, bdy = b.y - t.y;
          const bd = Math.hypot(bdx, bdy) || 1;
          b.x = t.x + (bdx / bd) * bmin;
          b.y = t.y + (bdy / bd) * bmin;
          t.rvx = (t.rvx || 0) - (bdx / bd) * 45;
          t.rvy = (t.rvy || 0) - (bdy / bd) * 45;
        }
        break; // hooguit één tank per tik
      }
    }
    if (!dood) over.push(b);
  }
  room.bullets = over;
  // pas nu de kapotgeschoten vormen echt uit de lijst halen
  ruimKapotteVormenOp(room);
}

/*
 * Munitie tegen munitie: vijandelijke kogels schieten elkaar kapot (diep.io).
 *
 * WAAROM EEN RASTER: eerst vergeleken we élk paar munitie met elkaar. Zolang
 * er alleen kogels rondvlogen (die na 3 sec verdwijnen) viel dat niet op, maar
 * traps blijven 24 sec liggen en drones verdwijnen helemaal niet. Met 5 robots
 * die traps leggen kom je zo aan honderden stuks munitie, en dan zijn dat
 * tienduizenden vergelijkingen per tik — waardoor de server vastliep zodra je
 * hoog genoeg kwam om zulke tegenstanders tegen te komen (rond level 30).
 *
 * Nu delen we het veld op in vakjes en vergelijken we alleen munitie die in
 * hetzelfde of een aangrenzend vakje ligt. Dat schaalt lineair mee.
 */
const RASTER = 80;

function munitieTegenMunitie(room) {
  const vakjes = new Map();
  for (const b of room.bullets) {
    if (b.weg) continue;
    const k = vakNr((b.x / RASTER) | 0, (b.y / RASTER) | 0);
    let lijst = vakjes.get(k);
    if (!lijst) vakjes.set(k, (lijst = []));
    lijst.push(b);
  }
  for (const b of room.bullets) {
    if (b.weg) continue;
    const cx = (b.x / RASTER) | 0, cy = (b.y / RASTER) | 0;
    for (let dx = -1; dx <= 1 && !b.weg; dx++) {
      for (let dy = -1; dy <= 1 && !b.weg; dy++) {
        const lijst = vakjes.get(vakNr(cx + dx, cy + dy));
        if (!lijst) continue;
        for (const c of lijst) {
          // elk paar één keer, en twee stilliggende traps doen elkaar niets
          if (c.weg || c.id <= b.id) continue;
          if (b.soort === 'trap' && c.soort === 'trap') continue;
          if (!kogelsVijandig(b, c)) continue;
          if (Math.hypot(b.x - c.x, b.y - c.y) >= b.r + c.r) continue;
          b.leven -= 1; c.leven -= 1;
          if (c.leven <= 0) c.weg = true;
          if (b.leven <= 0) { b.weg = true; break; }
        }
      }
    }
  }
}

/*
 * Vangnet tegen opstoppingen: hoeveel munitie mag er per tank en per arena
 * tegelijk in het veld liggen. Traps zijn de grootste boosdoener (24 sec
 * levensduur), dus die krijgen een eigen plafond; de oudste verdwijnt.
 */
const MAX_TRAPS_PER_TANK = 24;
const MAX_MUNITIE_ARENA = 260;

function beperkMunitie(room) {
  const trapsPer = new Map();
  for (const b of room.bullets) {
    if (b.weg || b.soort !== 'trap') continue;
    const lijst = trapsPer.get(b.eigenaar) || [];
    lijst.push(b);
    trapsPer.set(b.eigenaar, lijst);
  }
  for (const lijst of trapsPer.values()) {
    // lijst staat al op leeftijd (oudste eerst, want zo zijn ze toegevoegd)
    for (let i = 0; i < lijst.length - MAX_TRAPS_PER_TANK; i++) lijst[i].weg = true;
  }
  const levend = room.bullets.filter((b) => !b.weg);
  if (levend.length > MAX_MUNITIE_ARENA) {
    // te vol: gooi de oudste NIET-drones weg (drones horen bij hun baas)
    let weg = levend.length - MAX_MUNITIE_ARENA;
    for (const b of levend) {
      if (weg <= 0) break;
      if (b.soort === 'drone') continue;
      b.weg = true; weg--;
    }
  }
}

/* Botsen twee kogels vijandig? (niet van dezelfde tank of hetzelfde team) */
function kogelsVijandig(a, c) {
  if (a.eigenaar === c.eigenaar) return false;
  if (a.team !== null && a.team !== undefined && a.team === c.team) return false;
  return true;
}

function beschadigTank(room, t, schade, dader, nu, contact) {
  // veilig in basis, eigen teamzone of tijdens spawnbescherming
  if (isVeilig(room, t, nu)) return;
  // teams (les 2): geen schade van teamgenoten
  if (dader && dader.team !== null && dader.team === t.team) return;
  t.hp -= schade;
  t.laatsteSchade = nu; // reset de snelle-regen-timer
  // treffer-flits + gebeurtenis: bij kogels altijd, bij contact hooguit ~2x/sec
  const meld = contact ? (nu - t.contactEvT > 500) : (schade >= 1);
  if (meld) {
    if (contact) t.contactEvT = nu;
    t.flashKleur = '#ff5252'; t.flashUntil = nu + 180;
    t.laatsteActie = nu;
    // de échte schade meesturen: daarmee kan de leerling zelf zijn levens
    // bijhouden, en die schade hángt af van de upgrades van de tegenstander
    stuurEvent(t, 'geraakt', { schade: Math.round(schade * 10) / 10, contact: !!contact });
    // "wanneer ik iemand raak" gaat af bij élke rake treffer (max ~4x/sec)
    if (dader && !dader.ai && dader.id !== t.id && nu - (dader.raakEvT || 0) > 250) {
      dader.raakEvT = nu;
      stuurEvent(dader, 'raak');
    }
  }
  if (t.hp <= 0 && t.deadUntil <= nu) {
    t.deaths++;
    t.deadUntil = nu + RESPAWN_MS;
    // je hoort te weten wie je te pakken had — dat is de helft van de lol
    stuurEvent(t, 'dood', dader && dader.id !== t.id
      ? { door: dader.naam, kleur: dader.kleur }
      : { door: null });
    if (dader && dader.id !== t.id) {
      if (!dader.ai) {
        // zwaardere tank verslaan = meer punten
        const punten = t.ai ? t.ai.punten : Math.max(40, 40 + t.level * 15);
        geefPunten(room, dader, punten);
        stuurEvent(dader, 'punten', { n: punten, x: Math.round(t.x), y: Math.round(t.y) });
        stuurEvent(dader, 'versla'); // 🏆 hat-blok "wanneer ik iemand versla"
      }
      /* Iedereen in de arena ziet wie wie verslaat. Dat maakt van los rondrijden
         een wedstrijd: je hoort erbij, ook als je zelf net niet aan de beurt was. */
      io.to(room.id).emit('kill', {
        dader: dader.naam, daderKleur: dader.kleur,
        slachtoffer: t.naam, slachtofferKleur: t.kleur,
      });
    }
  }
}

/* Welke sockets kijken mee op de beamer? Die krijgen de hele arena te zien. */
const beamers = new Set();

/*
 * De wereld naar de spelers sturen — maar alleen het stuk dat ze kunnen zien.
 *
 * De arena telt inmiddels honderden vormen. Die allemaal twintig keer per
 * seconde naar iedereen sturen zou megabytes per seconde kosten en de
 * chromebooks laten haperen. Elke leerling krijgt dus enkel wat binnen zijn
 * scherm past (plus een randje, zodat er niets voor je ogen "inploft").
 * Tanks gaan wél altijd volledig mee: die heb je nodig voor het scorebord en
 * de minikaart, en het zijn er maar twaalf.
 */
const ZICHT_RAND = 300;   // extra wereld buiten je scherm

let tikTeller = 0;
elke(1000 / 20, () => {
  const nu = Date.now();
  tikTeller++;
  for (const room of rooms.values()) {
    try { stuurWereld(room, nu); } catch (err) { meldFout(`versturen ${room.id}`, err); }
  }
});

const afr1 = (n) => Math.round(n * 10) / 10;
const afr2 = (n) => Math.round(n * 100) / 100;

/*
 * HOE ZWAAR IS EEN PAKKETJE? Met 25 leerlingen in de arena woog elk pakketje
 * 30 KB: elke tank ging mee met álle velden (564 bytes), ook de statpunten,
 * klassekeuze en XP van je klasgenoten, en een richthoek met vijftien cijfers
 * na de komma. Keer twintig per seconde keer 25 leerlingen is dat zo'n
 * 100 Mbit/s over de schoolwifi — daar hapert elk accesspoint van.
 *
 * Nu krijgt elke leerling:
 *  - van zichzelf: alles;
 *  - van tanks in beeld: alleen wat je nodig hebt om ze te tekenen;
 *  - van tanks ver weg: alleen plek, naam en score (minikaart en scorebord);
 *  - van kogels: geen lege velden meer, en een kort nummer voor de eigenaar
 *    in plaats van een verbindingscode van twintig tekens.
 * Velden die leeg of "nee" zijn, gaan niet mee; de browser leest een
 * ontbrekend veld vanzelf als "nee".
 */
function stuurWereld(room, nu) {
  const gedeeld = {
    // het tijdstip van de wereld: de browser schuift hiermee alles vloeiend
    // tussen twee pakketjes in
    t: room.tickTijd || nu,
    arena: room.arena,
    teamModus: room.teamModus,
    zones: teamZones(room),
    basis: basisVan(room),
    nest: nestVan(room),
    statLijst: STAT_LIJST,
    statMax: MAX_STAT,
    // loopt er een ronde? dan de klok en het doel mee (voor het scorebord)
    ronde: room.ronde
      ? { over: Math.max(0, Math.round((room.ronde.eind - nu) / 1000)), doel: room.ronde.doel }
      : null,
  };

  // wat iedereen van een tank in beeld ziet, en wat er van een verre tank overblijft
  const publiek = new Map();
  const ver = new Map();
  for (const t of room.tanks.values()) {
    const o = {
      id: t.nr, naam: t.naam, kleur: t.kleur, vorm: t.vorm, klasse: t.klasse,
      r: afr1(straalVan(t)),   // tanks groeien met hun level
      level: t.level, x: Math.round(t.x), y: Math.round(t.y), angle: afr2(t.angle),
      hp: Math.max(0, Math.round(t.hp)), maxHp: Math.round(t.maxHp), score: t.score,
    };
    if (t.rondePunten) o.rondePunten = t.rondePunten;
    if (t.ai) { o.ai = true; if (t.ai.elite) o.elite = true; }
    if (t.team !== null && t.team !== undefined) o.team = t.team;
    // waar kijkt het automatische torentje naartoe? (Auto 3 / Auto 5)
    if (t.autoHoek !== undefined) o.autoHoek = afr2(t.autoHoek);
    if (nu < t.deadUntil) o.dood = true;
    if (t.onzichtbaar) o.onzichtbaar = true;
    if (nu < t.flashUntil) o.flits = t.flashKleur;
    if (isVeilig(room, t, nu)) o.schild = true;
    if (nu < t.sayUntil) o.zeg = t.sayText;
    publiek.set(t, o);
    const v = { id: o.id, naam: o.naam, kleur: o.kleur, x: o.x, y: o.y, score: o.score };
    for (const k of ['rondePunten', 'ai', 'team', 'dood', 'onzichtbaar']) if (o[k] !== undefined) v[k] = o[k];
    ver.set(t, v);
  }
  // van jezelf: ook je statpunten, je klassekeuze en je XP
  const eigen = (t) => Object.assign({}, publiek.get(t), {
    statMax: statMaxVan(t),   // Smashers mogen 10 i.p.v. 7 per stat
    stats: t.stats,
    statPunten: t.statPunten,
    klasseAanbod: klasseAanbod(t),
    xpVolgend: xpVoorLevel(t.level + 1),
    xpDit: xpVoorLevel(t.level),
    respawnOver: nu < t.deadUntil ? Math.ceil((t.deadUntil - nu) / 1000) : 0,
  });

  /*
   * Vroeger maakten we van ALLE vormen een pakketje en filterden we dat per
   * speler. In een arena van 229 miljoen pixels zijn dat bijna vierduizend
   * objecten, twintig keer per seconde — puur weggegooid werk, want elke
   * speler ziet er maar een vijftigtal. Nu filteren we eerst op wat je kan
   * zien en maken we pas daarna het pakketje — en elk pakketje maar één keer,
   * ook als vijf leerlingen dezelfde kogel zien.
   */
  const vormKlaar = new Map();
  const pakVorm = (v) => {
    let o = vormKlaar.get(v);
    if (o) return o;
    o = { id: v.id, type: v.type, x: Math.round(v.x), y: Math.round(v.y), hoek: afr2(v.hoek) };
    if (v.hp < v.maxHp) o.hp = Math.round(v.hp);
    if (nu < (v.hitUntil || 0)) o.hit = true;
    vormKlaar.set(v, o);
    return o;
  };
  const kogelKlaar = new Map();
  const pakKogel = (b) => {
    let o = kogelKlaar.get(b);
    if (o) return o;
    o = { id: b.id, x: Math.round(b.x), y: Math.round(b.y), r: afr1(b.r), kleur: b.kleur };
    const baas = b.eigenaar !== null && b.eigenaar !== undefined ? room.tanks.get(b.eigenaar) : null;
    if (baas) o.eigenaar = baas.nr;
    if (b.soort && b.soort !== 'kogel') {
      o.soort = b.soort;
      // een raket wijst de kant op waarheen hij vliegt, zodat zijn uitlaat klopt
      o.hoek = afr2(b.soort === 'raket' ? Math.atan2(b.vy, b.vx) : (b.hoek || 0));
    }
    if (b.vorm) o.vorm = b.vorm;
    if (b.rand) o.rand = b.rand;   // Necromancer-drones houden de kleur van hun vorm
    // bijna op? dan mag hij uitdoven
    if (b.dood !== Infinity && b.dood - nu < 300) o.tl = Math.max(0, Math.round(b.dood - nu));
    kogelKlaar.set(b, o);
    return o;
  };

  /*
   * De beamer toont de hele arena op één scherm: daar is een vierkantje nog
   * geen twee pixels groot. Alles opsturen kostte 238 KB per pakketje —
   * bijna vijf megabyte per seconde voor een handvol stipjes. Hij krijgt nu
   * een greep uit de vormen (hooguit 600), en die maar vier keer per
   * seconde. De tanks komen wél elke keer mee: die moet je vlot zien lopen.
   */
  let beamerPakket = null;
  for (const id of beamers) {
    if (room.id !== 'arena') break;
    if (!beamerPakket) {
      const stap = Math.max(1, Math.ceil(room.vormen.length / 600));
      const vormen = [];
      if (tikTeller % 5 === 0) {
        for (let i = 0; i < room.vormen.length; i += stap) {
          if (!room.vormen[i].weg) vormen.push(pakVorm(room.vormen[i]));
        }
      }
      beamerPakket = Object.assign({}, gedeeld, {
        tanks: [...publiek.values()],
        vormen: tikTeller % 5 === 0 ? vormen : null,   // null = houd wat je had
        bullets: room.bullets.filter((b) => !b.weg).map(pakKogel),
      });
    }
    io.to(id).emit('state', beamerPakket);
  }

  for (const ik of room.tanks.values()) {
    if (ik.ai) continue;
    const kijk = ik.kijk || { w: 2600, h: 1600 };
    const hw = kijk.w / 2 + ZICHT_RAND, hh = kijk.h / 2 + ZICHT_RAND;
    const inBeeld = (x, y) => !(x - ik.x > hw || x - ik.x < -hw || y - ik.y > hh || y - ik.y < -hh);
    const tanks = [];
    for (const t of room.tanks.values()) {
      if (t === ik) tanks.push(eigen(t));
      else tanks.push(inBeeld(t.x, t.y) ? publiek.get(t) : ver.get(t));
    }
    const vormen = [];
    for (const v of room.vormen) if (!v.weg && inBeeld(v.x, v.y)) vormen.push(pakVorm(v));
    const bullets = [];
    for (const b of room.bullets) if (!b.weg && inBeeld(b.x, b.y)) bullets.push(pakKogel(b));
    io.to(ik.id).emit('state', Object.assign({}, gedeeld, { tanks, vormen, bullets }));
  }
}

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
