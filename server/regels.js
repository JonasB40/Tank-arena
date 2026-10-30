/*
 * De spelregels: alle getallen en formules uit diep.io, op één plek.
 * Hoe groot een tank is, hoeveel XP een level kost, hoe hard een kogel
 * aankomt. Alleen rekenwerk, geen arena: de tests rekenen hier rechtstreeks mee.
 */

const { KLASSEN, UPGRADE_BOOM, TIER_LEVEL } = require('../public/js/klassen.js');

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
 * DE GEDEELDE ARENA GROEIT MEE MET DE KLAS. GEDEELDE_ARENA is de maat voor
 * TANKS_IN_ARENA tanks (zolang er minder leerlingen zijn, vullen robots aan
 * tot twaalf). Komen er meer leerlingen bij, dan krijgt elke tank evenveel
 * ruimte als in een arena van twaalf: de oppervlakte groeit mee, de vorm
 * blijft. Zo doet diep.io het ook — de kaart wordt groter met de spelers.
 * Met 25 leerlingen is de arena ongeveer 1,4 keer zo breed en hoog.
 */
function gedeeldeArenaVoor(aantalTanks) {
  const factor = Math.sqrt(Math.max(TANKS_IN_ARENA, aantalTanks) / TANKS_IN_ARENA);
  const w = Math.round((GEDEELDE_ARENA.w * factor) / 100) * 100;
  return { w, h: Math.round((w * GEDEELDE_ARENA.h) / GEDEELDE_ARENA.w) };
}

/*
 * INHAALBONUS. In de gedeelde arena rijdt een kind dat net binnenkomt tussen
 * klasgenoten die al een uur spelen. Tot level INHAAL_LEVEL, of zolang je
 * INHAAL_ACHTERSTAND levels onder het gemiddelde van de klas zit, leveren
 * vormen INHAAL_FACTOR keer zoveel punten op. (Een sterke tank verslaan
 * levert vanzelf al meer op: dat hoeft geen bonus.)
 */
const INHAAL_LEVEL = 15;
const INHAAL_ACHTERSTAND = 10;
const INHAAL_FACTOR = 1.5;

/*
 * DE KROON. Wie in de gedeelde arena de meeste punten heeft, draagt een 👑 —
 * en wie hem verslaat, krijgt dubbele punten. Zo blijft één sterke speler niet
 * de hele les ongestoord de baas: de rest van de klas heeft een reden om hem
 * samen aan te pakken. Pas vanaf KROON_MIN_PUNTEN en met minstens
 * KROON_MIN_SPELERS leerlingen (met z'n tweeën is "de koning" gewoon de ander).
 */
const KROON_MIN_PUNTEN = 500;
const KROON_MIN_SPELERS = 3;

/*
 * DE HEUVEL (rondesoort "heuvel veroveren"): een cirkel midden in de arena.
 * Staan er alleen tanks van één team op, dan verdient elk van die tanks
 * HEUVEL_PUNTEN_PER_SEC rondepunten per seconde. De straal geldt voor de
 * gewone arena en groeit mee als de arena groeit.
 */
const HEUVEL_STRAAL = 650;
const HEUVEL_PUNTEN_PER_SEC = 20;
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

// Reload: 0,6 sec per kogel, elk punt maal 0,914 (0 -> 600ms, 7 -> 320ms).
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

function klemF(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

module.exports = { HEUVEL_PUNTEN_PER_SEC, HEUVEL_STRAAL, INHAAL_ACHTERSTAND, INHAAL_FACTOR, INHAAL_LEVEL, KROON_MIN_PUNTEN, KROON_MIN_SPELERS, gedeeldeArenaVoor, AGGRO_MS, AI_PROFIELEN, ARENA, BULLET_LIFE, BULLET_SPEED, DETECTIE_R, GEDEELDE_ARENA, KLASSEN, KLEUREN, MAX_SPELERS, MAX_STAT, NIVEAUS, ONTSNAP_R, OPWARM_MS, RECOIL_KRACHT, RESPAWN_MS, ROBOT_NAMEN, SPAWN_BESCHERMING_MS, STAT_LIJST, TANKS_IN_ARENA, TANK_RADIUS, TIER_LEVEL, VERSNELLING, VORM_INFO, VORM_TYPES, WRIJVING, botsschadeVan, bulletPierce, bulletSchadeVan, bulletSnelheidFactor, herlaadMsVan, klasseAanbod, klasseVan, klem, klemF, legeStats, levelVan, maxHpVan, randInt, regenPerSec, robotKlasseVoorLevel, saneNaam, snelheidVan, statMaxVan, statPuntenBijLevel, straalVan, xpVoorLevel };
