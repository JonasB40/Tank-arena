/*
 * De wereld naar de browsers sturen (twintig keer per seconde).
 */
const { staat, rooms, beamers } = require('./staat');
const { straalVan, MAX_STAT, STAT_LIJST, xpVoorLevel, statMaxVan, klasseAanbod } = require('./regels');
const { meldFout, elke } = require('./klok');
const { basisVan, teamZones, nestVan, isVeilig, heuvelVan, inhaalFactor, gemiddeldSpelerLevel } = require('./wereld');

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
function startVerzenden() {
  elke(1000 / 20, () => {
    const nu = Date.now();
    tikTeller++;
    for (const room of rooms.values()) {
      try { stuurWereld(room, nu); } catch (err) { meldFout(`versturen ${room.id}`, err); }
    }
  });
}

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
      ? { over: Math.max(0, Math.round((room.ronde.eind - nu) / 1000)), doel: room.ronde.doel, soort: room.ronde.soort }
      : null,
    // heuvelronde: waar ligt de heuvel, en wie houdt hem? (null = geen heuvelronde)
    heuvel: heuvelVan(room) ? Object.assign(heuvelVan(room), room.heuvelStand || { betwist: false, houder: null, aantal: 0 }) : null,
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
    // de kroon: de leerling met de meeste punten (wie hem verslaat, krijgt dubbel)
    if (room.koning === t.id) o.kroon = true;
    // net een level omhoog? dan tekent elke browser een ring rond de tank
    if (nu < (t.levelUpTot || 0)) o.lu = t.level;
    publiek.set(t, o);
    const v = { id: o.id, naam: o.naam, kleur: o.kleur, x: o.x, y: o.y, score: o.score };
    for (const k of ['rondePunten', 'ai', 'team', 'dood', 'onzichtbaar', 'kroon']) if (o[k] !== undefined) v[k] = o[k];
    ver.set(t, v);
  }
  // van jezelf: ook je statpunten, je klassekeuze en je XP
  const gemLevel = gemiddeldSpelerLevel(room);
  const eigen = (t) => Object.assign({}, publiek.get(t), {
    // levert een vorm nu anderhalve keer zoveel op? (inhaalbonus, zie regels.js)
    inhaal: inhaalFactor(room, t, gemLevel) > 1,
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
    staat.io.to(id).emit('state', beamerPakket);
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
    staat.io.to(ik.id).emit('state', Object.assign({}, gedeeld, { tanks, vormen, bullets }));
  }
}

module.exports = { startVerzenden };
