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
