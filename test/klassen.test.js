/*
 * Rooktest: elke tankklasse één keer echt laten rijden en schieten, in een
 * arena met robots die drones maken. Drones, valstrikken, raketten,
 * automatische koepels en terugslag lopen elk langs een eigen stuk van de
 * spel-lus. Daarna mag de server geen enkele fout gemeld hebben.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { KLASSEN } = require('../public/js/klassen.js');
const { startServer, verbind, wachtOp, wacht } = require('./hulp');

describe('de gedeelde arena met alles aan', () => {
  it('14 leerlingen, 2 teams, robots en een heuvelronde: de arena groeit, geen fouten', async () => {
    const server = await startServer({ env: { TESTVRIJEKLASSE: '1' } });
    const open = [];
    try {
      const lesgever = await verbind(server.poort);
      open.push(lesgever);
      lesgever.emit('lesgever', {});
      await wachtOp(lesgever, 'lesgeverToegang');
      lesgever.emit('lesCommando', { type: 'teams', n: 2 });
      const kinderen = [];
      for (let i = 0; i < 14; i++) {
        const s = await verbind(server.poort);
        open.push(s);
        s.emit('join', { naam: `Kind${i}`, modus: 'samen' });
        kinderen.push(s);
      }
      lesgever.emit('lesCommando', { type: 'ronde', minuten: 5, doel: 0, soort: 'heuvel' });
      const klassen = ['necromancer', 'overtrapper', 'skimmer', 'auto5', 'twin', 'vernietiger', 'rammer'];
      kinderen.forEach((s, i) => s.emit('kiesKlasse', { klasse: klassen[i % klassen.length] }));
      const eind = Date.now() + 4000;
      let hoek = 0;
      while (Date.now() < eind) {
        hoek += 0.3;
        for (const s of kinderen) s.emit('intent', { mx: Math.cos(hoek), my: Math.sin(hoek), angle: hoek, shoot: true });
        await wacht(50);
      }
      const st = await wachtOp(kinderen[0], 'state', (x) => !!x.heuvel);
      assert.ok(st.arena.w > 22000, `de arena groeide naar ${st.arena.w}`);
      assert.equal(st.zones.length, 2);
      assert.doesNotMatch(server.log(), /fout in/, server.log());
    } finally {
      for (const s of open) s.close();
      await server.stop();
    }
  });
});

describe('elke tankklasse', () => {
  let server, s, id;
  before(async () => {
    server = await startServer({
      env: {
        TESTROBOTS: '3',              // meteen robots, ook in je eigen arena
        TESTKLASSE: 'necromancer',    // robots met een zwerm drones
        TESTVRIJEKLASSE: '1',         // de speler mag elke klasse kiezen
        TESTSPELERKLASSE: 'basis', TESTLEVEL: '45',
      },
    });
    s = await verbind(server.poort);
    s.emit('join', { naam: 'Proever', modus: 'solo', niveau: 'moeilijk' });
    ({ id } = await wachtOp(s, 'welkom'));
  });
  after(async () => { s.close(); await server.stop(); });

  it('rijdt en schiet met alle 48 klassen zonder fout op de server', async () => {
    const klassen = Object.keys(KLASSEN);
    assert.equal(klassen.length, 48);
    let hoek = 0;
    for (const klasse of klassen) {
      s.emit('kiesKlasse', { klasse });
      const tot = Date.now() + 250;
      while (Date.now() < tot) {
        hoek += 0.4;
        s.emit('intent', { mx: Math.cos(hoek), my: Math.sin(hoek), angle: hoek, shoot: true, tx: 1600, ty: 1000 });
        await wacht(33);
      }
      const st = await wachtOp(s, 'state', (x) => !!x.tanks.find((t) => t.id === id));
      const ik = st.tanks.find((t) => t.id === id);
      if (!ik.dood) assert.equal(ik.klasse, klasse);
    }
    // nog even laten lopen: kogels, drones en valstrikken raken van alles
    await wacht(1500);
    assert.doesNotMatch(server.log(), /fout in/, server.log());
  });
});
