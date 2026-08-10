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
const { KLASSEN, UPGRADE_BOOM, TIER_LEVEL } = require('./public/js/klassen.js');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

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

/* ------------------------------------------------------------------ */
/* Constanten                                                          */
/* ------------------------------------------------------------------ */
const ARENA = { w: 3200, h: 2000 };
const TANK_RADIUS = 22;
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
  driehoek: { r: 19, hp: 30, punten: 25, kleur: '#FC7677', botsschade: 9 },
  vijfhoek: { r: 30, hp: 150, punten: 130, kleur: '#4C6FF0', botsschade: 12 },   // duidelijk blauw
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

/*
 * AI-profielen bepalen alleen hoe AGRESSIEF/scherp een robot is
 * (snelheid, reactietijd, schietafstand). De KRACHT (hp, schade) hangt
 * af van het level van de robot — zie maakAiTank.
 */
const AI_PROFIELEN = {
  makkelijk: { snelheid: 90, reactieMs: 900, herlaadMs: 900, schietAfstand: 360, kleur: '#e8a0b4' },
  gemiddeld: { snelheid: 120, reactieMs: 560, herlaadMs: 620, schietAfstand: 410, kleur: '#c75b7a' },
  moeilijk: { snelheid: 150, reactieMs: 320, herlaadMs: 440, schietAfstand: 470, kleur: '#8e1e3f' },
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
  45: ['octotank', 'vernietiger', 'overheer', 'dritrapper', 'annihilator', 'drietwin'],
  30: ['driedubbel', 'gunner', 'opzichter', 'trapper', 'jager'],
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
 * Steilere XP-curve zodat je niet te snel omhoog vliegt (level 15 ≈ 1400 XP
 * ≈ ~10 vijfhoeken, level 30 ≈ 7900, level 45 ≈ 21700). Zo blijft levelen
 * en klassekeuze iets om naartoe te werken.
 */
/*
 * De échte diep.io-tabel (https://diepio.fandom.com/wiki/Levels): hoeveel
 * punten je totaal nodig hebt voor elk level. Onze eigen formule week hier
 * flink van af, waardoor levelen anders aanvoelde dan in het spel dat de
 * kinderen kennen. Ter controle: één vijfhoek (130 XP) = level 7 met 6
 * statpunten, precies zoals in diep.io.
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
let projecten = {};
try { projecten = JSON.parse(fs.readFileSync(PROJECT_BESTAND, 'utf8')); } catch { /* nog geen bestand */ }

let schrijfTimer = null;
function bewaarProjectenOpSchijf() {
  clearTimeout(schrijfTimer);
  schrijfTimer = setTimeout(() => {
    fs.writeFile(PROJECT_BESTAND, JSON.stringify(projecten), () => {});
  }, 1500);
}

const CODE_TEKENS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // geen 0/O/1/I-verwarring
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
  const room = {
    id, solo,
    niveau: NIVEAUS[niveau] ? niveau : 'makkelijk',
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
    basis: { x: 0, y: ARENA.h - 380, w: 380, h: 380 },
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

function teamZones(room) {
  if (room.teamModus === 2) {
    return [
      { team: 0, x: 0, y: 0, w: 190, h: ARENA.h },
      { team: 1, x: ARENA.w - 190, y: 0, w: 190, h: ARENA.h },
    ];
  }
  if (room.teamModus === 4) {
    const z = 300;
    return [
      { team: 0, x: 0, y: 0, w: z, h: z },
      { team: 1, x: ARENA.w - z, y: 0, w: z, h: z },
      { team: 2, x: 0, y: ARENA.h - z, w: z, h: z },
      { team: 3, x: ARENA.w - z, y: ARENA.h - z, w: z, h: z },
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
function zetTeamModus(room, n) {
  if (!room || ![0, 2, 4].includes(n)) return;
  room.teamModus = n;
  for (const t of room.tanks.values()) {
    if (t.ai) continue;
    if (n) wijsTeamToe(room, t);
    else { t.team = null; t.kleur = '#3498db'; }
    spawnTank(room, t);
  }
}

function wijsTeamToe(room, t) {
  if (!room.teamModus) { t.team = null; return; }
  const telling = new Array(room.teamModus).fill(0);
  for (const ander of room.tanks.values()) {
    if (!ander.ai && ander.team !== null && ander.id !== t.id) telling[ander.team]++;
  }
  t.team = telling.indexOf(Math.min(...telling));
  t.kleur = TEAM_KLEUREN[t.team];
  const zone = teamZones(room).find((z) => z.team === t.team);
  if (zone) {
    t.x = zone.x + 40 + Math.random() * (zone.w - 80);
    t.y = zone.y + 40 + Math.random() * (zone.h - 80);
  }
}

function doelAantalVormen(room) {
  const spelers = [...room.tanks.values()].filter((t) => !t.ai).length;
  return room.solo ? 42 : Math.min(90, 44 + spelers * 4);
}

function vulVormenAan(room) {
  const doel = doelAantalVormen(room);
  // bewakers van het nest: altijd een handvol, meestal kleine
  const CRASHERS = room.solo ? 7 : 12;
  while (room.vormen.filter((v) => v.jaagt).length < CRASHERS) {
    spawnVorm(room, Math.random() < 0.75 ? 'crasher' : 'grotecrasher');
  }
  /*
   * Vaste aantallen per soort in plaats van een loterij: zo is de kaart altijd
   * evenwichtig gevuld en niet de ene keer vol vijfhoeken en de andere keer
   * leeg. De verhouding volgt diep.io: vierkanten overal, driehoeken vlot te
   * vinden, vijfhoeken al schaarser, en de zeshoek is écht een buitenkans.
   * Het nest in het midden is — net als het Pentagon Nest — vooral gevuld met
   * vijfhoeken en een paar alfa's, bewaakt door de crashers.
   */
  /*
   * Verhouding zoals in diep.io: vierkanten overal, driehoeken vlot te vinden,
   * vijfhoeken duidelijk schaarser. Ik had ze eerder te ruim gezet omdat ze
   * bijna allemaal in het nest zaten; daardoor stonden er in de gedeelde arena
   * evenveel vijfhoeken als driehoeken. Buiten het nest ontmoet je nu grofweg
   * 1 vijfhoek per 3 driehoeken en per 5 vierkanten.
   */
  const quota = room.solo
    ? { vierkant: 26, driehoek: 16, vijfhoek: 8, nestVijfhoek: 7, alfa: 2, zeshoek: 2, zeshoekBuiten: 1 }
    : { vierkant: 44, driehoek: 27, vijfhoek: 10, nestVijfhoek: 11, alfa: 3, zeshoek: 3, zeshoekBuiten: 1 };

  const aantal = (type) => room.vormen.filter((v) => v.type === type).length;
  const buiten = (type) => room.vormen.filter((v) => v.type === type && !inNest(v.x, v.y)).length;
  while (aantal('vierkant') < quota.vierkant) spawnVorm(room, 'vierkant');
  while (aantal('driehoek') < quota.driehoek) spawnVorm(room, 'driehoek');
  /*
   * Vijfhoeken zaten bijna allemaal in het nest, achter de crashers. Wie het
   * midden meed, kwam er dus nooit een tegen en bleef eeuwig vierkanten
   * schieten. Nu vullen we eerst het aantal BUITEN het nest aan, zodat er
   * altijd een handvol te vinden is op de rest van de kaart.
   */
  while (buiten('vijfhoek') < quota.vijfhoek) spawnVorm(room, 'vijfhoek', false);
  while (aantal('vijfhoek') < quota.vijfhoek + quota.nestVijfhoek) spawnVorm(room, 'vijfhoek', true);
  while (aantal('alfa') < quota.alfa) spawnVorm(room, 'alfa');
  // en één zeshoek zwerft buiten rond: de buitenkans moet wél te vinden zijn
  while (buiten('zeshoek') < quota.zeshoekBuiten) spawnVorm(room, 'zeshoek', false);
  while (aantal('zeshoek') < quota.zeshoek) spawnVorm(room, 'zeshoek', true);
  // ruimere dekking om je achter te verstoppen
  while (room.vormen.filter((v) => v.type === 'muur').length < (room.solo ? 16 : 24)) {
    spawnVorm(room, 'muur');
  }
}

/*
 * Het "nest": het middengebied waar alleen de dikke vormen leven. In diep.io
 * spawnen zeshoeken en alfa's uitsluitend in het Pentagon Nest — een plek waar
 * een beginner niet komt. Bij ons stonden ze overal, ook naast de veilige
 * basis, waardoor je met één zeshoek (1500 XP, precies zoals diep.io) in één
 * klap van level 1 naar 15 sprong. De getallen klopten; de plek niet.
 */
const NEST = { x: ARENA.w * 0.34, y: ARENA.h * 0.3, w: ARENA.w * 0.32, h: ARENA.h * 0.4 };
const inNest = (x, y) => x >= NEST.x && x <= NEST.x + NEST.w && y >= NEST.y && y <= NEST.y + NEST.h;

function spawnVorm(room, type, inHetNest) {
  const def = VORM_TYPES[type];
  let x, y;
  // Alleen alfa's en de nestbewakers horen per se in het nest; van de andere
  // soorten bepaalt de aanroeper waar ze komen (zie de quota hieronder).
  if (inHetNest || type === 'alfa' || def.jaagt) {
    x = NEST.x + Math.random() * NEST.w;
    y = NEST.y + Math.random() * NEST.h;
  } else {
    do {                                    // buiten het nest, mooi verspreid
      x = 80 + Math.random() * (ARENA.w - 160);
      y = 80 + Math.random() * (ARENA.h - 160);
    } while (inNest(x, y));
  }
  if (inBasis(room, x, y)) { x = ARENA.w / 2; y = ARENA.h / 2; }
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
function nieuweTank(id, naam) {
  return {
    id, naam,
    kleur: '#3498db', vorm: 'cirkel', klasse: 'basis', team: null,
    score: 0, level: 1, statPunten: 0,
    stats: legeStats(),
    x: 100 + Math.random() * (ARENA.w - 200),
    y: 100 + Math.random() * (ARENA.h - 200),
    angle: 0,
    intent: { mx: 0, my: 0, angle: 0, shoot: false, tx: 0, ty: 0 },
    hp: 90, maxHp: 90,
    deaths: 0, deadUntil: 0, reloadUntil: 0,
    flashKleur: null, flashUntil: 0,
    sayText: null, sayUntil: 0,
    laatsteActie: Date.now(), onzichtbaar: false,
    beschermTot: 0, contactEvT: 0, laatsteSchade: 0,
    ai: null,
  };
}

/* Hoe ver steekt deze loop uit vanaf het midden van de tank? */
function loopLengte(loop) { return (loop.start || 0) + loop.len; }

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
// Movement Speed: hoe hoger je level, hoe trager je van nature wordt (diep.io).
function snelheidVan(t) {
  if (t.ai) return t.ai.snelheid;
  return (150 - Math.min(45, t.level) * 0.9) + t.stats.snelheid * 15 + (klasseVan(t).snelheidBonus || 0);
}

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
  t.x = 100 + Math.random() * (ARENA.w - 200);
  t.y = 100 + Math.random() * (ARENA.h - 200);
  const basis = basisVan(room);
  if (!t.ai && basis) {
    // je start veilig in de thuisbasis (solo én in de gedeelde arena
    // zolang de lesgever geen teams heeft aangezet)
    t.x = basis.x + 60 + Math.random() * (basis.w - 120);
    t.y = basis.y + 60 + Math.random() * (basis.h - 120);
  }
  if (t.ai && basis && inBasis(room, t.x, t.y)) {
    t.x = ARENA.w / 2; t.y = ARENA.h / 2;
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

/* Bij dood: respawn als zwakkere versie (zoals diep.io). */
function respawnZwakker(room, t) {
  t.score = Math.floor(t.score / 2);
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
  // rustige start: de eerste robot komt pas na de opwarmtijd
  if (!process.env.TESTROBOTS && Date.now() - room.gestartOm < OPWARM_MS) return;
  const score = spelerScoreVoorAI(room);
  const n = NIVEAUS[room.niveau] || NIVEAUS.gemiddeld;
  const doel = process.env.TESTROBOTS ? Number(process.env.TESTROBOTS) : (room.solo
    ? Math.min(n.max, 1 + Math.floor(score / n.perScore))
    : Math.min(10, 2 + spelers + Math.floor(score / 500)));
  const huidige = [...room.tanks.values()].filter((t) => t.ai).length;
  for (let i = huidige; i < doel; i++) {
    const t = maakAiTank(room, n);
    room.tanks.set(t.id, t);
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
  }
  const t = nieuweTank(`ai-${room.id}-${room.volgendAiId++}`, '🤖 Robot');
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
  t.naam = `🤖 ${elite ? 'ELITE' : n.profiel} · lvl ${lvl}`;
  t.kleur = elite ? '#6a1b9a' : p.kleur;
  t.klasse = robotKlasseVoorLevel(lvl);
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

  // dichtstbijzijnde speler zoeken
  let speler = null, dSpeler = Infinity;
  for (const ander of room.tanks.values()) {
    if (ander.ai || nu < ander.deadUntil) continue;
    if (isVeilig(room, ander, nu)) continue; // veilige spelers negeren
    const d = Math.hypot(ander.x - t.x, ander.y - t.y);
    if (d < dSpeler) { dSpeler = d; speler = ander; }
  }

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

  // rustig zwerven en vormen farmen
  let vorm = null, dVorm = Infinity;
  for (const v of room.vormen) {
    if (v.type === 'muur') continue;
    const d = Math.hypot(v.x - t.x, v.y - t.y);
    if (d < dVorm) { dVorm = d; vorm = v; }
  }
  if (!a.doelPunt || Math.hypot(a.doelPunt.x - t.x, a.doelPunt.y - t.y) < 60 || nu > a.doelPuntTot) {
    a.doelPunt = vorm && Math.random() < 0.7
      ? { x: vorm.x, y: vorm.y }
      : { x: 200 + Math.random() * (ARENA.w - 400), y: 200 + Math.random() * (ARENA.h - 400) };
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

  socket.on('join', (data) => {
    const totaal = [...rooms.values()].reduce((n, r) => n + [...r.tanks.values()].filter((t) => !t.ai).length, 0);
    if (totaal >= MAX_SPELERS) { socket.emit('vol'); return; }

    verlaatRoom(socket);
    const modus = data && data.modus === 'samen' ? 'samen' : 'solo';
    const roomId = modus === 'solo' ? `solo-${socket.id}` : 'arena';
    const room = rooms.get(roomId) || maakRoom(roomId, modus === 'solo', data && data.niveau);

    const t = nieuweTank(socket.id, saneNaam(data && data.naam));
    t.kleur = KLEUREN[Math.floor(Math.random() * 8)];
    room.tanks.set(socket.id, t);
    if (room.teamModus) wijsTeamToe(room, t);
    spawnTank(room, t);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('welkom', { id: socket.id, arena: ARENA, modus });
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
    t.intent = {
      mx: klemF(inp.mx, -1, 1), my: klemF(inp.my, -1, 1),
      angle: Number(inp.angle) || 0,
      shoot: !!inp.shoot,
      // waar de muis in de wereld staat: drones vliegen daar naartoe
      tx: klem(Number(inp.tx) || t.x, 0, ARENA.w),
      ty: klem(Number(inp.ty) || t.y, 0, ARENA.h),
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
    if (klasseAanbod(t).includes(data.klasse)) {
      t.klasse = data.klasse;
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

  /* De beamer kijkt mee naar de gedeelde arena. */
  socket.on('beamer', () => {
    if (!rooms.has('arena')) maakRoom('arena', false);
    socket.join('arena');
    socket.data.isBeamer = true;
  });

  /* Les 2: de lesgever (admin, via de beamer) kiest 0, 2 of 4 teams. */
  socket.on('zetTeams', (n) => {
    if (!socket.data.isBeamer) return;
    zetTeamModus(rooms.get('arena'), n);
  });

  /*
   * Een leerling die in het startmenu "2 teams" of "4 teams" kiest, zet die
   * opstelling ook echt aan — anders klikt hij op iets dat niets doet en staat
   * hij zonder veilige zone in de arena. De lesgever kan het op de beamer
   * altijd overrulen; dat blijft de laatste stem.
   */
  socket.on('kiesTeams', (n) => {
    if (![2, 4].includes(n)) return;
    const room = rooms.get(socket.data.roomId);
    if (!room || room.solo || room.teamModus === n) return;
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
    const code = projecten[d.code] ? d.code : nieuweProjectCode();
    projecten[code] = { naam: saneNaam(d.naam), werkruimte: d.werkruimte, bijgewerkt: Date.now() };
    bewaarProjectenOpSchijf();
    cb({ code });
  });

  socket.on('laadProject', (d, cb) => {
    if (typeof cb !== 'function') return;
    const code = String((d && d.code) || '').toUpperCase().trim();
    const p = projecten[code];
    cb(p ? { ok: true, naam: p.naam, werkruimte: p.werkruimte } : { ok: false });
  });

  /* ---------------- de les: klasoverzicht voor de lesgever ---------------- */
  socket.on('lesStatus', (d) => {
    if (!d) return;
    klas.set(socket.id, {
      naam: saneNaam(d.naam),
      stap: klem(d.stap, 1, 20),
      status: ['bezig', 'klaar', 'vast'].includes(d.status) ? d.status : 'bezig',
      sinds: (klas.get(socket.id) || {}).stap === d.stap ? (klas.get(socket.id) || {}).sinds || Date.now() : Date.now(),
      bijgewerkt: Date.now(),
    });
  });

  /* De lesgever kijkt mee en stuurt de klas. */
  socket.on('lesgever', () => {
    socket.data.isLesgever = true;
    socket.join('lesgevers');
  });

  socket.on('lesCommando', (d) => {
    if (!socket.data.isLesgever || !d) return;
    if (d.type === 'stap' && Number.isFinite(d.stap)) {
      io.emit('lesStuur', { type: 'stap', stap: klem(d.stap, 1, 20) });
    } else if (d.type === 'bevries') {
      bevroren = !!d.aan;
      io.emit('lesStuur', { type: 'bevries', aan: bevroren });
    } else if (d.type === 'toonCode') {
      io.to(d.id).emit('lesStuur', { type: 'stuurCode' }); // vraag de leerling zijn blokken
    }
  });

  /* Leerling stuurt zijn blokken door zodat de lesgever ze kan projecteren. */
  socket.on('mijnCode', (d) => {
    io.to('lesgevers').emit('leerlingCode', {
      id: socket.id,
      naam: saneNaam(d && d.naam),
      tekst: String((d && d.tekst) || '').slice(0, 4000),
    });
  });

  socket.on('verlaat', () => verlaatRoom(socket));
  socket.on('disconnect', () => { klas.delete(socket.id); verlaatRoom(socket); });
});

/* Wie zit waar in de les? (socket-id → {naam, stap, status}) */
const klas = new Map();
let bevroren = false;

/* Klasoverzicht naar de lesgever(s) sturen. */
setInterval(() => {
  const nu = Date.now();
  const lijst = [...klas.entries()]
    .filter(([, l]) => nu - l.bijgewerkt < 15000)
    .map(([id, l]) => ({ id, naam: l.naam, stap: l.stap, status: l.status, minuten: Math.floor((nu - l.sinds) / 60000) }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
  io.to('lesgevers').emit('klasoverzicht', { leerlingen: lijst, bevroren });
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

setInterval(() => {
  const nu = Date.now();
  const dt = Math.min(0.1, (nu - vorigeTick) / 1000);
  vorigeTick = nu;

  for (const room of rooms.values()) {
    tickRoom(room, nu, dt);
  }
}, 1000 / 30);

function tickRoom(room, nu, dt) {
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
  zorgVoorAI(room);
  vulVormenAan(room);

  for (const v of room.vormen) {
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
  const CRASHER_ZICHT = 340;
  const CRASHER_SNELHEID = 145;
  for (const v of room.vormen) {
    if (!v.jaagt) continue;
    let doelX = NEST.x + NEST.w / 2, doelY = NEST.y + NEST.h / 2;
    const verVanNest = Math.hypot(doelX - v.x, doelY - v.y) > Math.max(NEST.w, NEST.h) * 0.75;
    if (!verVanNest) {
      let dichtst = null, best = CRASHER_ZICHT;
      for (const t of room.tanks.values()) {
        if (t.ai || nu < t.deadUntil || isVeilig(room, t, nu)) continue;
        const d = Math.hypot(t.x - v.x, t.y - v.y);
        if (d < best) { best = d; dichtst = t; }
      }
      if (dichtst) { doelX = dichtst.x; doelY = dichtst.y; }
      else { v.vx *= 0.9; v.vy *= 0.9; continue; }   // rustig rondhangen
    }
    const dx = doelX - v.x, dy = doelY - v.y, d = Math.hypot(dx, dy) || 1;
    v.vx += ((dx / d) * CRASHER_SNELHEID - v.vx) * Math.min(1, dt * 2.5);
    v.vy += ((dy / d) * CRASHER_SNELHEID - v.vy) * Math.min(1, dt * 2.5);
    v.x = klem(v.x + v.vx * dt, v.r, ARENA.w - v.r);
    v.y = klem(v.y + v.vy * dt, v.r, ARENA.h - v.r);
  }

  for (const t of room.tanks.values()) {
    if (nu < t.deadUntil) continue;
    if (t.deadUntil !== 0) {
      // respawn-moment
      if (t.ai) { room.tanks.delete(t.id); continue; }
      respawnZwakker(room, t);
    }

    if (t.ai) stuurAI(room, t, nu);

    // bewegen volgens intent
    const len = Math.hypot(t.intent.mx, t.intent.my);
    if (len > 0.05) {
      const v = snelheidVan(t) * dt;
      t.x += (t.intent.mx / len) * v;
      t.y += (t.intent.my / len) * v;
      t.laatsteActie = nu;
    }
    t.x = Math.max(TANK_RADIUS, Math.min(ARENA.w - TANK_RADIUS, t.x));
    t.y = Math.max(TANK_RADIUS, Math.min(ARENA.h - TANK_RADIUS, t.y));
    t.angle = t.intent.angle;

    // robots kunnen de thuisbasis niet in
    if (t.ai && inBasis(room, t.x, t.y)) {
      const b = basisVan(room);
      const naarRechts = (b.x + b.w) - t.x;
      const naarBoven = t.y - b.y;
      if (naarRechts < naarBoven) t.x = b.x + b.w + TANK_RADIUS;
      else t.y = b.y - TANK_RADIUS;
    }

    // genezen (zoals diep.io): traag passief; maar heb je ~8 sec geen schade
    // gehad, dan schiet de regen in de snelle modus (levensregen-stat telt zwaar
    // mee). In een veilige zone (thuisbasis of eigen teamzone) genees je extra.
    if (!t.ai) {
      let regen = regenPerSec(t);
      if (nu - t.laatsteSchade > 8000) regen *= 5;             // snelle regen
      const veiligeZone = inBasis(room, t.x, t.y) || inEigenZone(room, t);
      if (veiligeZone) regen += 8;
      if (regen > 0) t.hp = Math.min(t.maxHp, t.hp + regen * dt);
    }

    // Botsen met vormen (zoals diep.io): je duwt ze opzij en je doet elkaar
    // lichaamsschade. Erop inrijden is dus een échte manier om een blokje
    // kapot te maken — en een gevaarlijke, want jij verliest ook levens.
    // Muren blokkeren volledig en doen geen schade.
    for (let i = 0; i < room.vormen.length; i++) {
      const v = room.vormen[i];
      const dx = t.x - v.x, dy = t.y - v.y;
      const d = Math.hypot(dx, dy);
      const min = TANK_RADIUS + v.r;
      // 1 px speling: ook wie er tegenaan geduwd blijft staan (bv. klem tegen
      // de rand) blijft schade geven en krijgen — anders stopt het schuren.
      if (d >= min + 1 || d <= 0.01) continue;
      const nx = dx / d, ny = dy / d;

      if (v.blokkeert) { // muur: gewoon terugduwen, geen schade
        if (d < min) { t.x = v.x + nx * min; t.y = v.y + ny * min; }
        continue;
      }

      // de vorm wijkt, de tank schuift een beetje terug (de tank wint)
      if (d < min) {
        const overlap = min - d;
        v.x -= nx * overlap * 0.75;
        v.y -= ny * overlap * 0.75;
        // vormen mogen het speelveld niet uit geduwd worden
        v.x = klem(v.x, v.r, ARENA.w - v.r);
        v.y = klem(v.y, v.r, ARENA.h - v.r);
        t.x += nx * overlap * 0.25;
        t.y += ny * overlap * 0.25;
      }

      // schade in beide richtingen
      beschadigTank(room, t, v.botsschade * dt, null, nu, true);
      v.hp -= botsschadeVan(t, 'vorm') * dt;
      v.laatsteSchade = nu;
      v.hitUntil = nu + 150;
      if (v.hp <= 0) {
        room.vormen.splice(i--, 1);
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
    if (kl.munitie === 'drone' && nu > t.reloadUntil && kl.lopen.length) {
      const mijn = room.bullets.filter((b) => b.soort === 'drone' && !b.weg && b.eigenaar === t.id).length;
      if (mijn < (kl.droneMax || 8)) {
        t.reloadUntil = nu + herlaadMsVan(t);
        const loop = kl.lopen[Math.floor(Math.random() * kl.lopen.length)];
        const hoek = t.angle + loop.hoek;
        room.bullets.push({
          id: room.volgendKogelId++, soort: 'drone',
          x: t.x + Math.cos(hoek) * loopLengte(loop), y: t.y + Math.sin(hoek) * loopLengte(loop),
          vx: Math.cos(hoek) * 90, vy: Math.sin(hoek) * 90,
          hoek, eigenaar: t.id, kleur: t.kleur, team: t.team,
          r: loop.w * 0.42,
          schade: bulletSchadeVan(t) * 0.55,
          leven: 3 + bulletPierce(t),
          dood: Infinity,           // drones blijven tot ze kapotgeschoten worden
        });
      }
    }

    if (t.intent.shoot && nu > t.reloadUntil && kl.lopen.length && kl.munitie !== 'drone') {
      t.reloadUntil = nu + herlaadMsVan(t);
      t.laatsteActie = nu;
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
          r: loop.w * 0.42,
          soort: kl.munitie === 'trap' ? 'trap' : 'kogel',
          hoek: richting,
          schade: bulletSchadeVan(t) * (loop.schade || 1),
          // kogelpantser = "bullet health": hoeveel keer de kogel iets mag raken
          // (vorm, tank of vijandelijke kogel) voordat hij verdwijnt. Grote
          // kogels (destroyer/annihilator) doorboren van nature meer.
          leven: bulletPierce(t) + (kl.munitie === 'trap' ? 3 : 0) + (loop.w * 0.42 >= 12 ? 2 : 0),
          // traps blijven lang liggen (wiki: ~24 sec), kogels leven 3 sec
          dood: nu + (kl.munitie === 'trap' ? (kl.trapLeven || 24000) : BULLET_LIFE),
        });
      }
    }

    // sluiper: onzichtbaar na 2 sec niets doen
    t.onzichtbaar = !!(kl.sluip && nu - t.laatsteActie > 2000);

    // botsschade: elk paar tanks dat elkaar raakt doet lichaamsschade
    // (rammer/stekelbol via klasse-multiplier, gewone tanks via de botsschade-stat)
    for (const ander of room.tanks.values()) {
      if (ander.id === t.id || nu < ander.deadUntil) continue;
      if (Math.hypot(ander.x - t.x, ander.y - t.y) < TANK_RADIUS * 2 + 4) {
        beschadigTank(room, ander, botsschadeVan(t, 'tank') * dt, t, nu, true);
      }
    }
  }

  beperkMunitie(room);
  munitieTegenMunitie(room);

  // kogels bewegen en raken vormen/tanks
  const over = [];
  for (const b of room.bullets) {
    if (b.weg) continue;

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
      b.x = klem(b.x, b.r, ARENA.w - b.r);
      b.y = klem(b.y, b.r, ARENA.h - b.r);
    }
    if (nu > b.dood || b.x < 0 || b.x > ARENA.w || b.y < 0 || b.y > ARENA.h) continue;

    // vijandelijke kogels lossen op aan de rand van de thuisbasis
    if (inBasis(room, b.x, b.y)) {
      const schutter = room.tanks.get(b.eigenaar);
      if (schutter && schutter.ai) continue;
    }

    let dood = false;

    // raakt een vorm? (kan er meerdere doorboren zolang er leven over is)
    for (let i = 0; i < room.vormen.length; i++) {
      const v = room.vormen[i];
      if (Math.hypot(v.x - b.x, v.y - b.y) < v.r + b.r) {
        v.hp -= b.schade;
        v.laatsteSchade = nu;
        v.hitUntil = nu + 150; // wit flitsje (animatie)
        if (v.hp <= 0) {
          room.vormen.splice(i, 1);
          const schutter = room.tanks.get(b.eigenaar);
          if (schutter && !schutter.ai) {
            geefPunten(room, schutter, v.punten);
            stuurEvent(schutter, 'punten', { n: v.punten, x: Math.round(v.x), y: Math.round(v.y) });
          }
        }
        b.leven -= 1;
        if (b.leven <= 0) dood = true;
        break; // hooguit één vorm per tik
      }
    }
    if (dood) continue;

    // raakt een tank? (elke tank hoogstens één keer per kogel)
    for (const t of room.tanks.values()) {
      if (t.id === b.eigenaar || nu < t.deadUntil) continue;
      // Een kogel raakt elke tank hoogstens één keer. Een drone blijft rammen:
      // die mag dezelfde tank opnieuw raken na een korte pauze, anders is hij
      // na één treffer nutteloos.
      const vorige = b.geraakt && b.geraakt.get(t.id);
      if (vorige && (b.soort !== 'drone' || nu - vorige < 600)) continue;
      if (Math.hypot(t.x - b.x, t.y - b.y) < TANK_RADIUS + b.r) {
        const schutter = room.tanks.get(b.eigenaar);
        beschadigTank(room, t, b.schade, schutter, nu);
        (b.geraakt || (b.geraakt = new Map())).set(t.id, nu);
        if (b.soort !== 'drone') {      // drones stuiteren af i.p.v. op te gaan
          b.leven -= 1;
          if (b.leven <= 0) dood = true;
        }
        break; // hooguit één tank per tik
      }
    }
    if (!dood) over.push(b);
  }
  room.bullets = over;
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
    const k = ((b.x / RASTER) | 0) + ',' + ((b.y / RASTER) | 0);
    let lijst = vakjes.get(k);
    if (!lijst) vakjes.set(k, (lijst = []));
    lijst.push(b);
  }
  for (const b of room.bullets) {
    if (b.weg) continue;
    const cx = (b.x / RASTER) | 0, cy = (b.y / RASTER) | 0;
    for (let dx = -1; dx <= 1 && !b.weg; dx++) {
      for (let dy = -1; dy <= 1 && !b.weg; dy++) {
        const lijst = vakjes.get((cx + dx) + ',' + (cy + dy));
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
    stuurEvent(t, 'dood');
    if (dader && !dader.ai && dader.id !== t.id) {
      // zwaardere tank verslaan = meer punten
      const punten = t.ai ? t.ai.punten : Math.max(40, 40 + t.level * 15);
      geefPunten(room, dader, punten);
      stuurEvent(dader, 'punten', { n: punten, x: Math.round(t.x), y: Math.round(t.y) });
      stuurEvent(dader, 'versla'); // 🏆 hat-blok "wanneer ik iemand versla"
    }
  }
}

/* De wereld per room naar de spelers sturen. */
setInterval(() => {
  const nu = Date.now();
  for (const room of rooms.values()) {
    const staat = {
      arena: ARENA,
      teamModus: room.teamModus,
      zones: teamZones(room),
      basis: basisVan(room),
      nest: NEST,
      statLijst: STAT_LIJST,
      statMax: MAX_STAT,
      tanks: [...room.tanks.values()].map((t) => ({
        id: t.id, naam: t.naam, kleur: t.kleur, vorm: t.vorm, klasse: t.klasse,
        statMax: statMaxVan(t),   // Smashers mogen 10 i.p.v. 7 per stat
        ai: !!t.ai, elite: !!(t.ai && t.ai.elite), level: t.level, team: t.team,
        x: Math.round(t.x), y: Math.round(t.y), angle: t.angle,
        hp: Math.max(0, Math.round(t.hp)), maxHp: Math.round(t.maxHp),
        score: t.score, dood: nu < t.deadUntil, onzichtbaar: !!t.onzichtbaar,
        respawnOver: nu < t.deadUntil ? Math.ceil((t.deadUntil - nu) / 1000) : 0,
        flits: nu < t.flashUntil ? t.flashKleur : null,
        schild: isVeilig(room, t, nu),
        zeg: nu < t.sayUntil ? t.sayText : null,
        stats: t.ai ? null : t.stats,
        statPunten: t.statPunten,
        klasseAanbod: t.ai ? [] : klasseAanbod(t),
        xpVolgend: xpVoorLevel(t.level + 1),
        xpDit: xpVoorLevel(t.level),
      })),
      bullets: room.bullets.map((b) => ({
        id: b.id, eigenaar: b.eigenaar, soort: b.soort || 'kogel',
        x: Math.round(b.x), y: Math.round(b.y), kleur: b.kleur, r: b.r,
        hoek: b.hoek ? Math.round(b.hoek * 100) / 100 : 0,
        tl: b.dood === Infinity ? 9999 : Math.max(0, b.dood - nu),
      })),
      vormen: room.vormen.map((v) => ({
        id: v.id, type: v.type, jaagt: v.jaagt, x: Math.round(v.x), y: Math.round(v.y),
        r: v.r, hp: Math.round(v.hp), maxHp: v.maxHp, kleur: v.kleur, hoek: v.hoek,
        hit: nu < (v.hitUntil || 0),
      })),
    };
    io.to(room.id).emit('state', staat);
  }
}, 1000 / 20);

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
  throw err;
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
  console.log(`   Beamer (groot scherm): http://localhost:${PORT}/beamer`);
  console.log('');
});
