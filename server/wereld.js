/*
 * De wereld: arena's, teams, rondes, vormen en tanks.
 * Een arena ("room") is ofwel je eigen oefenarena (solo-…) of de gedeelde
 * arena van de klas. Hier staat hoe je er een maakt en wat erin ligt.
 */
const { staat, rooms } = require('./staat');
const { HEUVEL_PUNTEN_PER_SEC, HEUVEL_STRAAL, INHAAL_ACHTERSTAND, INHAAL_FACTOR, INHAAL_LEVEL, KROON_MIN_PUNTEN, KROON_MIN_SPELERS, TANKS_IN_ARENA, gedeeldeArenaVoor, TIER_LEVEL, ARENA, GEDEELDE_ARENA, SPAWN_BESCHERMING_MS, legeStats, VORM_TYPES, ROBOT_NAMEN, AI_PROFIELEN, NIVEAUS, levelVan, klasseVan, maxHpVan, statPuntenBijLevel } = require('./regels');

function maakRoom(id, solo, niveau) {
  // een eigen kopie: de gedeelde arena groeit mee met de klas (pasArenaGrootteAan)
  const arena = Object.assign({}, solo ? ARENA : GEDEELDE_ARENA);
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
function startRonde(room, minuten, doel, soort) {
  if (!room) return;
  for (const t of room.tanks.values()) { t.rondePunten = 0; t.heuvelRest = 0; }
  room.ronde = {
    eind: Date.now() + Math.max(1, Math.min(60, minuten || 10)) * 60000,
    doel: Math.max(0, Math.min(100000, doel || 0)),
    // 'punten' (wie verdient het meest) of 'heuvel' (wie houdt de heuvel)
    soort: soort === 'heuvel' ? 'heuvel' : 'punten',
  };
  room.heuvelStand = null;
  room.gepauzeerd = false;
  staat.io.to(room.id).emit('rondeStart', { minuten: minuten || 10, doel: doel || 0, soort: room.ronde.soort });
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
  staat.io.to(room.id).emit('rondeKlaar', Object.assign({ reden }, stand));
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

/*
 * DE HEUVEL (rondesoort "heuvel veroveren"). Een cirkel midden in de arena,
 * even groot ten opzichte van de arena als die groeit. Staan er tanks van maar
 * één team op (zonder teams: maar één tank), dan verdient elk van die tanks
 * rondepunten. Staan er twee teams op, dan is hij betwist en verdient niemand
 * iets. Zo moet een team samenwerken: de heuvel innemen én verdedigen — los
 * punten jagen helpt je team hier niet.
 */
function heuvelVan(room) {
  if (!room.ronde || room.ronde.soort !== 'heuvel') return null;
  return {
    x: Math.round(room.arena.w / 2), y: Math.round(room.arena.h / 2),
    r: Math.round(HEUVEL_STRAAL * (room.arena.w / GEDEELDE_ARENA.w)),
  };
}

function opHeuvel(room, t) {
  const h = heuvelVan(room);
  return !!h && Math.hypot(t.x - h.x, t.y - h.y) <= h.r;
}

function bewaakHeuvel(room, nu, dt) {
  const h = heuvelVan(room);
  if (!h) { room.heuvelStand = null; return; }
  const erop = [];
  for (const t of room.tanks.values()) {
    if (nu < t.deadUntil) continue;
    if (Math.hypot(t.x - h.x, t.y - h.y) <= h.r) erop.push(t);
  }
  // een "partij" is een team, of zonder teams één tank
  const partijVan = (t) => (t.team !== null && t.team !== undefined ? 'team' + t.team : 'tank' + t.id);
  const partijen = new Set(erop.map(partijVan));
  const stand = { betwist: partijen.size > 1, aantal: erop.length, houder: null };
  if (partijen.size === 1) {
    const eerste = erop[0];
    stand.houder = eerste.team !== null && eerste.team !== undefined
      ? { team: eerste.team }
      : { nr: eerste.nr, naam: eerste.naam, kleur: eerste.kleur };
    for (const t of erop) {
      // de punten sparen we op en delen we in hele punten uit
      t.heuvelRest = (t.heuvelRest || 0) + HEUVEL_PUNTEN_PER_SEC * dt;
      const heel = Math.floor(t.heuvelRest);
      if (heel > 0) { t.heuvelRest -= heel; t.rondePunten = (t.rondePunten || 0) + heel; }
    }
  }
  room.heuvelStand = stand;
}

/*
 * De arena groeit mee met de klas (zie gedeeldeArenaVoor in regels.js).
 * Groeien gebeurt meteen, maar zacht: een paar procent per seconde, zodat
 * niemand de rand ziet verspringen. Krimpen pas als de klas een minuut lang
 * kleiner is: een leerling die even zijn pagina ververst, laat de arena niet
 * slinken en weer groeien.
 */
const KRIMP_NA_MS = 60000;
function pasArenaGrootteAan(room, nu, dt) {
  if (room.solo) return;
  let spelers = 0;
  for (const t of room.tanks.values()) if (!t.ai) spelers++;
  const doel = gedeeldeArenaVoor(Math.max(TANKS_IN_ARENA, spelers));
  const a = room.arena;
  if (doel.w >= a.w) room.kleinerSinds = 0;
  else if (!room.kleinerSinds) room.kleinerSinds = nu;
  if (doel.w === a.w) return;
  if (doel.w < a.w && nu - room.kleinerSinds < KRIMP_NA_MS) return;

  const oud = { w: a.w, h: a.h };
  const stap = Math.max(40, a.w * 0.04 * dt);   // ongeveer 4% per seconde
  if (Math.abs(doel.w - a.w) <= stap) { a.w = doel.w; a.h = doel.h; }
  else {
    a.w = Math.round(a.w + Math.sign(doel.w - a.w) * stap);
    a.h = Math.round((a.w * GEDEELDE_ARENA.h) / GEDEELDE_ARENA.w);
  }
  room.basis.y = a.h - room.basis.h;   // de thuisbasis blijft in de hoek linksonder

  if (a.w > oud.w) {
    // gegroeid: nieuwe vormen eerst in het nieuwe stuk (zie spawnVorm), anders
    // ligt daar een halve minuut niets terwijl het oude stuk vol ligt
    if (!room.groeiVan || nu > room.groeiVan.tot) room.groeiVan = { w: oud.w, h: oud.h };
    room.groeiVan.tot = nu + 30000;
  } else {
    // gekrompen: wat nu buiten de rand ligt, verdwijnt (tanks en drones
    // houdt de spel-lus vanzelf binnen het veld)
    for (const v of room.vormen) {
      if (v.x > a.w - v.r || v.y > a.h - v.r) v.weg = true;
    }
  }
}

/*
 * INHAALBONUS (zie regels.js): in de gedeelde arena leveren vormen meer op
 * voor wie nog onder level 15 zit of ver achter de klas aanhinkt. In je eigen
 * oefenarena niet: daar begint iedereen gelijk.
 */
function gemiddeldSpelerLevel(room) {
  let som = 0, n = 0;
  for (const s of room.tanks.values()) if (!s.ai) { som += s.level; n++; }
  return n ? som / n : 1;
}
function inhaalFactor(room, t, gemiddeld) {
  if (room.solo || t.ai) return 1;
  if (t.level < INHAAL_LEVEL) return INHAAL_FACTOR;
  const gem = gemiddeld === undefined ? gemiddeldSpelerLevel(room) : gemiddeld;
  return t.level <= gem - INHAAL_ACHTERSTAND ? INHAAL_FACTOR : 1;
}
const puntenVoorVorm = (room, t, punten) => Math.round(punten * inhaalFactor(room, t));

/* DE KROON (zie regels.js): wie draagt hem nu? */
function bepaalKoning(room) {
  if (room.solo) { room.koning = null; return; }
  let beste = null, spelers = 0;
  for (const t of room.tanks.values()) {
    if (t.ai) continue;
    spelers++;
    if (t.score >= KROON_MIN_PUNTEN && (!beste || t.score > beste.score)) beste = t;
  }
  const nieuw = beste && spelers >= KROON_MIN_SPELERS ? beste.id : null;
  if (nieuw === room.koning) return;
  room.koning = nieuw;
  // de nieuwe koning mag het weten: vanaf nu jagen de anderen op hem
  if (beste && nieuw) stuurEvent(beste, 'kroon');
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

/* Een naam die in deze arena nog vrij is (anders rijden er twee Trumpies rond). */
function vrijeRobotNaam(room) {
  const bezet = new Set([...room.tanks.values()].map((t) => t.robotNaam).filter(Boolean));
  const vrij = ROBOT_NAMEN.filter((n) => !bezet.has(n));
  const lijst = vrij.length ? vrij : ROBOT_NAMEN;
  return lijst[Math.floor(Math.random() * lijst.length)];
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
    // net gegroeid? dan liefst in het nieuwe stuk (buiten de oude rechthoek)
    const groei = room.groeiVan && Date.now() < room.groeiVan.tot ? room.groeiVan : null;
    let pogingen = groei ? 10 : 0;
    do {                                    // buiten het nest, mooi verspreid
      x = 80 + Math.random() * (room.arena.w - 160);
      y = 80 + Math.random() * (room.arena.h - 160);
    } while (inNest(room, x, y) || (pogingen-- > 0 && x < groei.w && y < groei.h));
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
  staat.io.to(t.id).emit('ev', Object.assign({ type }, extra || {}));
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
      // iedereen in de buurt ziet een ring rond je tank (zie verzenden.js)
      t.levelUpTot = Date.now() + 1200;
      stuurEvent(t, 'statpunt', { punten: t.statPunten }); // voor het hat-blok
    }
  }
}

function vindTank(socket) {
  const room = rooms.get(socket.data.roomId);
  return room ? room.tanks.get(socket.id) : null;
}

module.exports = { bepaalKoning, bewaakHeuvel, gemiddeldSpelerLevel, heuvelVan, inhaalFactor, opHeuvel, pasArenaGrootteAan, puntenVoorVorm, TEAM_KLEUREN, basisVan, bewaakRonde, bouwVormRaster, buurVormen, geefPunten, inBasis, inEigenZone, isVeilig, lesgeverZetTeams, maakRoom, nestVan, nieuweTank, respawnZwakker, rondeStand, spawnTank, startRonde, stopRonde, stuurEvent, teamZones, vakNr, vindTank, vormenRondom, vrijeRobotNaam, vulVormenAan, wijsTeamToe, zetTeamModus };
