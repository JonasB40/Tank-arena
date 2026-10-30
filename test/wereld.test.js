/*
 * De gedeelde arena zonder server nagerekend: meegroeien met de klas, de
 * inhaalbonus, de kroon (met premie) en de heuvelronde. We sturen de tijd zelf
 * vooruit en vangen op wat de server naar de browsers zou sturen.
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { staat, rooms } = require('../server/staat');
const verstuurd = [];
staat.io = { to: (doel) => ({ emit: (type, data) => verstuurd.push({ doel, type, data }) }), emit: () => {} };

const regels = require('../server/regels');
const wereld = require('../server/wereld');
const { beschadigTank } = require('../server/spellus');

let volgnr = 0;
/** Een nieuwe gedeelde arena met n leerlingen (en geen robots). */
function arenaMet(n, solo = false) {
  rooms.clear();
  const room = wereld.maakRoom(solo ? 'solo-test' : 'arena', solo);
  for (let i = 0; i < n; i++) {
    const t = wereld.nieuweTank(`speler-${++volgnr}`, `Kind${i}`);
    room.tanks.set(t.id, t);
    wereld.spawnTank(room, t);
  }
  return room;
}
const spelers = (room) => [...room.tanks.values()];
/** De tijd vooruit: zoveel seconden in tikken van 1/30 s. */
function laatLopen(room, seconden, start, stap) {
  let nu = start;
  for (let i = 0; i < seconden * 30; i++) { nu += 1000 / 30; stap(room, nu, 1 / 30); }
  return nu;
}

beforeEach(() => { verstuurd.length = 0; });

describe('de arena groeit mee met de klas', () => {
  it('tot twaalf leerlingen blijft ze even groot', () => {
    const room = arenaMet(8);
    laatLopen(room, 5, Date.now(), wereld.pasArenaGrootteAan);
    assert.deepEqual(room.arena, regels.GEDEELDE_ARENA);
  });

  it('met 25 leerlingen groeit ze zacht tot de juiste maat, en de thuisbasis groeit mee', () => {
    const room = arenaMet(25);
    const doel = regels.gedeeldeArenaVoor(25);
    let nu = laatLopen(room, 1, Date.now(), wereld.pasArenaGrootteAan);
    assert.ok(room.arena.w > regels.GEDEELDE_ARENA.w && room.arena.w < doel.w, 'na één seconde half onderweg');
    nu = laatLopen(room, 20, nu, wereld.pasArenaGrootteAan);
    assert.deepEqual(room.arena, doel);
    assert.equal(room.basis.y + room.basis.h, doel.h, 'de thuisbasis blijft in de hoek linksonder');
    // de constante zelf is niet mee veranderd
    assert.deepEqual(regels.GEDEELDE_ARENA, { w: 22000, h: 10400 });
  });

  it('nieuwe vormen komen eerst in het nieuwe stuk', () => {
    const room = arenaMet(25);
    const oud = { w: room.arena.w, h: room.arena.h };
    laatLopen(room, 20, Date.now(), wereld.pasArenaGrootteAan);
    const voor = room.vormen.length;
    wereld.vulVormenAan(room);
    const nieuw = room.vormen.slice(voor).filter((v) => !v.jaagt && v.type !== 'alfa');
    const inNieuwStuk = nieuw.filter((v) => v.x >= oud.w || v.y >= oud.h).length;
    assert.ok(nieuw.length > 500, `${nieuw.length} nieuwe vormen`);
    assert.ok(inNieuwStuk / nieuw.length > 0.8, `${inNieuwStuk} van ${nieuw.length} in het nieuwe stuk`);
  });

  it('krimpt pas als de klas een minuut kleiner is, en ruimt op wat buiten de rand valt', () => {
    const room = arenaMet(25);
    let nu = laatLopen(room, 20, Date.now(), wereld.pasArenaGrootteAan);
    const groot = room.arena.w;
    for (const t of spelers(room).slice(5)) room.tanks.delete(t.id);   // 20 leerlingen weg
    nu = laatLopen(room, 55, nu, wereld.pasArenaGrootteAan);
    assert.equal(room.arena.w, groot, 'na 55 s nog niet gekrompen');
    laatLopen(room, 25, nu, wereld.pasArenaGrootteAan);
    assert.deepEqual(room.arena, regels.GEDEELDE_ARENA);
    const buiten = room.vormen.filter((v) => !v.weg && (v.x > room.arena.w || v.y > room.arena.h));
    assert.equal(buiten.length, 0);
  });

  it('een eigen oefenarena groeit nooit', () => {
    const room = arenaMet(30, true);
    laatLopen(room, 5, Date.now(), wereld.pasArenaGrootteAan);
    assert.deepEqual(room.arena, regels.ARENA);
  });
});

describe('inhaalbonus voor wie achterop raakt', () => {
  it('tot level 15 leveren vormen anderhalve keer zoveel op, alleen in de gedeelde arena', () => {
    const room = arenaMet(3);
    const [a] = spelers(room);
    a.level = 5;
    assert.equal(wereld.inhaalFactor(room, a), 1.5);
    assert.equal(wereld.puntenVoorVorm(room, a, 130), 195);
    const solo = arenaMet(1, true);
    assert.equal(wereld.inhaalFactor(solo, spelers(solo)[0]), 1);
  });

  it('ook wie tien levels onder het klasgemiddelde zit, en niet wie gewoon meedoet', () => {
    const room = arenaMet(3);
    const [a, b, c] = spelers(room);
    a.level = 20; b.level = 40; c.level = 42;   // gemiddelde 34
    assert.equal(wereld.inhaalFactor(room, a), 1.5);
    a.level = 30;                                // gemiddelde 37,3
    assert.equal(wereld.inhaalFactor(room, a), 1);
  });
});

describe('de kroon en de premie', () => {
  it('de leerling met de meeste punten krijgt de kroon (vanaf 500 punten en 3 leerlingen)', () => {
    const room = arenaMet(3);
    const [a, b, c] = spelers(room);
    a.score = 300; b.score = 900; c.score = 100;
    wereld.bepaalKoning(room);
    assert.equal(room.koning, b.id);
    assert.ok(verstuurd.some((x) => x.doel === b.id && x.data.type === 'kroon'), 'de koning hoort het');
    b.score = 400;
    wereld.bepaalKoning(room);
    assert.equal(room.koning, null, 'onder de 500 punten geen kroon');
    const twee = arenaMet(2);
    spelers(twee)[0].score = 5000;
    wereld.bepaalKoning(twee);
    assert.equal(twee.koning, null, 'met twee leerlingen geen kroon');
  });

  it('wie de koning verslaat, krijgt dubbele punten — en iedereen ziet het', () => {
    const room = arenaMet(3);
    const [koning, jager] = spelers(room);
    koning.score = 1000; koning.level = 20;
    wereld.bepaalKoning(room);
    assert.equal(room.koning, koning.id);
    const nu = Date.now();
    koning.beschermTot = 0;
    koning.x = koning.y = jager.x = jager.y = 5000;   // midden in het veld, niet in de basis
    const voor = jager.score;
    beschadigTank(room, koning, 99999, jager, nu);
    assert.equal(jager.score - voor, 2 * (40 + 20 * 15), 'dubbele punten');
    const kill = verstuurd.find((x) => x.type === 'kill');
    assert.equal(kill.data.premie, true);
    assert.equal(room.koning, null, 'de kroon is af');
  });
});

describe('heuvel veroveren', () => {
  const opDeHeuvel = (room, t) => { const h = wereld.heuvelVan(room); t.x = h.x; t.y = h.y; };

  it('zonder heuvelronde is er geen heuvel', () => {
    const room = arenaMet(2);
    wereld.startRonde(room, 5, 0, 'punten');
    assert.equal(wereld.heuvelVan(room), null);
  });

  it('één team op de heuvel verdient punten; twee teams = betwist, niemand verdient', () => {
    const room = arenaMet(4);
    wereld.zetTeamModus(room, 2);
    wereld.startRonde(room, 5, 0, 'heuvel');
    const [a, b] = spelers(room).filter((t) => t.team === 0);
    const [c] = spelers(room).filter((t) => t.team === 1);
    opDeHeuvel(room, a); opDeHeuvel(room, b);
    let nu = laatLopen(room, 2, Date.now(), wereld.bewaakHeuvel);
    assert.equal(room.heuvelStand.houder.team, 0);
    assert.ok(Math.abs(a.rondePunten - 2 * regels.HEUVEL_PUNTEN_PER_SEC) <= 1, `${a.rondePunten} punten na 2 s`);
    assert.equal(wereld.rondeStand(room).teams[0].team, 0);
    opDeHeuvel(room, c);
    const voor = a.rondePunten;
    laatLopen(room, 2, nu, wereld.bewaakHeuvel);
    assert.equal(room.heuvelStand.betwist, true);
    assert.equal(a.rondePunten, voor, 'betwist: geen punten');
  });

  it('zonder teams telt één tank alleen op de heuvel', () => {
    const room = arenaMet(2);
    wereld.startRonde(room, 5, 0, 'heuvel');
    const [a] = spelers(room);
    opDeHeuvel(room, a);
    laatLopen(room, 1, Date.now(), wereld.bewaakHeuvel);
    assert.equal(room.heuvelStand.houder.nr, a.nr);
    assert.ok(a.rondePunten >= regels.HEUVEL_PUNTEN_PER_SEC - 1);
  });

  it('de heuvel groeit mee met de arena', () => {
    const room = arenaMet(25);
    wereld.startRonde(room, 5, 0, 'heuvel');
    const klein = wereld.heuvelVan(room).r;
    laatLopen(room, 20, Date.now(), wereld.pasArenaGrootteAan);
    const h = wereld.heuvelVan(room);
    assert.ok(h.r > klein * 1.3);
    assert.equal(h.x, room.arena.w / 2);
  });
});
