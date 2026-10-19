/*
 * De runtime (runtime.js): voert het programma van een kind uit zoals Scratch
 * dat doet. Getest met een nagemaakt spel en een nagemaakte klok, zodat we
 * elke tik zelf kunnen zetten.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { laadBestanden, compileer, blok, stapel, waarde, getal, hoek, werkblad } = require('./browserbestanden');

/** Een verse runtime met een nagemaakt spel. */
function maakRuntime() {
  let tik = null;
  const klok = { nu: 1000000 };
  const verstuurd = [];
  const spel = {
    muisWereld: { x: 500, y: 100 }, muisKnop: false,
    mijnTank: () => ({ x: 100, y: 100, hp: 50, maxHp: 50, score: 0, level: 1, stats: {} }),
    stuurIntent: (i) => verstuurd.push(Object.assign({}, i)),
    stuurActie: () => {}, kiesStat: () => {}, toonUpgrade: () => {}, wordKlasse: () => {},
    dichtstbijVijand: () => null, dichtstbijVorm: () => null, afstandVijand: () => 9999,
    raakIk: () => false, geraaktDoorKogel: () => false, inBasis: () => false,
    krachtKogel: () => 0, besteScore: () => 0, mijnPlaats: () => 1, maxLevens: () => 50,
  };
  const o = laadBestanden(['blokken.js', 'compiler.js', 'runtime.js'], {
    spel,
    speelGeluid: () => {},
    setInterval: (fn) => { tik = fn; return 1; },
    Date: { now: () => klok.nu },
    addEventListener: () => {},
  });
  return {
    runtime: o.runtime,
    /** Start dit werkblad zoals de groene vlag. */
    start(blad) {
      const programma = compileer(o, blad);
      o.compileerProject = () => programma;
      o.runtimeStart();
      return programma;
    },
    /** De blokken die in de laatste tik uitgevoerd zijn (die lichten op). */
    opgelicht: () => new Set([...o.runtime.actief].filter(([, tijd]) => tijd === klok.nu).map(([id]) => id)),
    stop: () => o.runtimeStop(),
    /** Eén tik verder (1/30 s); geeft wat er naar de server ging. */
    tik(ms = 1000 / 30) { klok.nu += ms; tik(); return verstuurd[verstuurd.length - 1]; },
    toets: (k, aan) => (aan ? o.runtime.toetsen.add(k) : o.runtime.toetsen.delete(k)),
  };
}

const start = (...b) => Object.assign(blok('hat_start'), { next: stapel(...b) });
const herhaal = (...b) => blok('herhaal_continu', null, { DOEN: stapel(...b) });
const rijOmhoog = () => [blok('richt_rij', null, { HOEK: hoek(0) }), blok('neem_stappen', null, { N: getal(10) })];
const alsToets = (toets, ...dan) => blok('als_blok', null, { COND: waarde(blok('toets_ingedrukt', { TOETS: toets })), DAN: stapel(...dan) });
const bijna = (a, b) => Math.abs(a - b) < 1e-9;

describe('de runtime', () => {
  it('zonder groene vlag gebeurt er niets', () => {
    const r = maakRuntime();
    assert.equal(r.tik(), undefined);
  });

  it('herhaal + als toets: de tank rijdt alleen zolang de toets ingedrukt is', () => {
    const r = maakRuntime();
    r.start(werkblad(start(herhaal(alsToets('ArrowUp', ...rijOmhoog())))));
    let uit = r.tik();
    assert.equal(uit.my, 0);
    r.toets('ArrowUp', true);
    uit = r.tik();
    assert.ok(bijna(uit.my, -1) && bijna(uit.mx, 0), `omhoog = my -1, kreeg ${uit.mx},${uit.my}`);
    r.toets('ArrowUp', false);
    assert.equal(r.tik().my, 0);
  });

  it('zonder herhaal zet de tank maar één stapje (het probleem van stap 2)', () => {
    const r = maakRuntime();
    r.start(werkblad(start(...rijOmhoog())));
    assert.ok(bijna(r.tik().my, -1));
    assert.equal(r.tik().my, 0);
  });

  it('herhaal 3 keer doet één rondje per tik, en stopt dan', () => {
    const r = maakRuntime();
    r.start(werkblad(start(blok('herhaal_n', null, { N: getal(3), DOEN: stapel(...rijOmhoog()) }))));
    const rondjes = [1, 2, 3, 4, 5].map(() => r.tik().my);
    assert.deepEqual(rondjes.map((m) => Math.round(m)), [-1, -1, -1, 0, 0]);
  });

  it('wacht pauzeert alleen zijn eigen stapeltje', () => {
    const r = maakRuntime();
    r.start(werkblad(
      start(herhaal(...rijOmhoog())),
      start(blok('wacht_blok', null, { SEC: getal(1) }), blok('schiet_blok')),
    ));
    const eerst = r.tik();
    assert.ok(bijna(eerst.my, -1), 'het rijden loopt gewoon door');
    assert.equal(eerst.shoot, false, 'het andere stapeltje wacht nog');
    r.tik(500);
    assert.equal(r.tik(600).shoot, true, 'na een seconde schiet het');
  });

  it('een signaal start het stapeltje dat erop wacht (de tik erna)', () => {
    const r = maakRuntime();
    r.start(werkblad(
      start(blok('zend_signaal', { NAAM: 'bonus' })),
      Object.assign(blok('hat_signaal', { NAAM: 'bonus' }), { next: stapel(blok('schiet_blok')) }),
    ));
    assert.equal(r.tik().shoot, false);
    assert.equal(r.tik().shoot, true);
    assert.equal(r.runtime.telOntvangen, 1);
  });

  it('variabelen en rekenen: delen door nul geeft 0, geen fout', () => {
    const r = maakRuntime();
    const deel = blok('op_reken', { OP: '/' }, { A: getal(10), B: getal(0) });
    r.start({
      variables: [{ name: 'x', id: 'vx' }],
      blocks: { languageVersion: 0, blocks: [Object.assign({ x: 0, y: 0 }, start(blok('variables_set', { VAR: { id: 'vx' } }, { VALUE: waarde(deel) })))] },
    });
    r.tik();
    assert.equal(r.runtime.vars.x, 0);
  });

  it('licht op wat er echt uitgevoerd wordt: alleen de gekozen tak van een als-blok', () => {
    const r = maakRuntime();
    const [script] = r.start(werkblad(start(herhaal(alsToets('ArrowUp', ...rijOmhoog())))));
    const lus = script.body[0];
    const als = lus.body[0];
    const [richt, stappen] = als.dan;
    for (const x of [script, lus, als, richt, stappen]) assert.equal(typeof x.id, 'string');

    r.tik();
    let aan = r.opgelicht();
    assert.ok(aan.has(script.id) && aan.has(lus.id) && aan.has(als.id), 'startblok, lus en als-blok gloeien');
    assert.ok(!aan.has(richt.id) && !aan.has(stappen.id), 'zonder toets wordt de tak niet uitgevoerd');

    r.toets('ArrowUp', true);
    r.tik();
    aan = r.opgelicht();
    assert.ok(aan.has(richt.id) && aan.has(stappen.id), 'met de toets ingedrukt licht de tak op');

    r.stop();
    assert.equal(r.runtime.actief.size, 0, 'na de stopknop licht niets meer op');
  });

  it('een wacht-blok blijft oplichten zolang het wacht', () => {
    const r = maakRuntime();
    const [script] = r.start(werkblad(start(blok('wacht_blok', null, { SEC: getal(1) }), blok('schiet_blok'))));
    const [wacht, schiet] = script.body;
    r.tik();
    r.tik(300);
    assert.ok(r.opgelicht().has(wacht.id));
    assert.ok(!r.opgelicht().has(schiet.id));
    r.tik(800);
    assert.ok(r.opgelicht().has(schiet.id));
  });

  it('"ogen op de lesgever": alles staat stil, ook met een toets ingedrukt', () => {
    const r = maakRuntime();
    r.start(werkblad(start(herhaal(alsToets('ArrowUp', ...rijOmhoog())))));
    r.toets('ArrowUp', true);
    r.runtime.bevroren = true;
    const uit = r.tik();
    assert.equal(uit.my, 0);
    assert.equal(uit.shoot, false);
  });
});
