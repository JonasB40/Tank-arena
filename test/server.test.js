/*
 * De server van buitenaf getest, zoals de browsers hem gebruiken: binnenkomen,
 * rijden, projecten bewaren, en alles wat de lesgever vanaf het dashboard doet.
 * Elke test start een echte server met een tijdelijk projectbestand.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startServer, verbind, wachtOp, komtNiet, vraag, wacht } = require('./hulp');

const WERKBLAD = { blocks: { languageVersion: 0, blocks: [{ type: 'hat_start', id: 'a', x: 10, y: 10 }] } };

/** Een leerling die meedoet; geeft { s, id } (id = het korte tanknummer). */
async function leerlingIn(server, naam, modus = 'solo') {
  const s = await verbind(server.poort);
  s.emit('join', { naam, modus, niveau: 'makkelijk' });
  const { id } = await wachtOp(s, 'welkom');
  return { s, id };
}
const mijnTank = (st, id) => st.tanks.find((t) => t.id === id);

describe('spelen', () => {
  let server;
  const open = [];
  before(async () => { server = await startServer(); });
  after(async () => { for (const s of open) s.close(); await server.stop(); });

  it('een leerling komt binnen in zijn eigen arena en ziet zijn tank', async () => {
    const { s, id } = await leerlingIn(server, 'Emma');
    open.push(s);
    const st = await wachtOp(s, 'state', (x) => !!mijnTank(x, id));
    const ik = mijnTank(st, id);
    assert.equal(ik.naam, 'Emma');
    assert.deepEqual(st.arena, { w: 3200, h: 2000 });
    assert.ok(st.vormen.length > 0, 'er liggen vormen om op te schieten');
    assert.ok(ik.stats && ik.xpVolgend > 0, 'van je eigen tank krijg je ook stats en XP');
  });

  it('de tank rijdt de kant op die het programma kiest', async () => {
    const { s, id } = await leerlingIn(server, 'Rijder');
    open.push(s);
    const begin = mijnTank(await wachtOp(s, 'state', (x) => !!mijnTank(x, id)), id);
    const tik = setInterval(() => s.emit('intent', { mx: 1, my: 0, angle: 0, shoot: false }), 33);
    await wacht(900);
    clearInterval(tik);
    const na = mijnTank(await wachtOp(s, 'state'), id);
    assert.ok(na.x > begin.x + 40, `x ging van ${begin.x} naar ${na.x}`);
  });

  it('schieten maakt een kogel van jou', async () => {
    const { s, id } = await leerlingIn(server, 'Schutter');
    open.push(s);
    const tik = setInterval(() => s.emit('intent', { mx: 0, my: 0, angle: 0, shoot: true }), 33);
    const st = await wachtOp(s, 'state', (x) => x.bullets.some((b) => b.eigenaar === id));
    clearInterval(tik);
    assert.ok(st.bullets.length > 0);
  });

  it('een onmogelijke hoek (10^400 graden) laat de tank niet verdwijnen', async () => {
    const { s, id } = await leerlingIn(server, 'Raar');
    open.push(s);
    for (let i = 0; i < 10; i++) s.emit('intent', { mx: 1, my: 1, angle: '1e400', shoot: true });
    await wacht(300);
    const ik = mijnTank(await wachtOp(s, 'state', (x) => !!mijnTank(x, id)), id);
    assert.ok(Number.isFinite(ik.x) && Number.isFinite(ik.y) && Number.isFinite(ik.angle));
  });

  it('samen spelen: de gedeelde arena vult aan met robots', async () => {
    const { s, id } = await leerlingIn(server, 'Samen', 'samen');
    open.push(s);
    const st = await wachtOp(s, 'state', (x) => !!mijnTank(x, id) && x.tanks.length >= 12);
    assert.ok(st.arena.w > 3200, 'de gedeelde arena is groter');
    assert.equal(st.tanks.filter((t) => !t.ai).length, 1);
  });
});

describe('projecten bewaren', () => {
  let server;
  const open = [];
  before(async () => { server = await startServer(); });
  after(async () => { for (const s of open) s.close(); await server.stop(); });
  const nieuw = async () => { const s = await verbind(server.poort); open.push(s); return s; };

  let code;
  it('bewaren geeft een code, en met die code haal je het op een ander toestel terug', async () => {
    const a = await nieuw();
    ({ code } = await vraag(a, 'bewaarProject', { naam: 'Lotte', werkruimte: WERKBLAD }));
    assert.match(code, /^TANK-[A-Z0-9]{4}$/);
    const b = await nieuw();
    const terug = await vraag(b, 'laadProject', { code: code.toLowerCase() });
    assert.equal(terug.ok, true);
    assert.equal(terug.naam, 'Lotte');
    assert.deepEqual(terug.werkruimte, WERKBLAD);
  });

  it('een onbekende of rare code geeft niets terug', async () => {
    const a = await nieuw();
    assert.equal((await vraag(a, 'laadProject', { code: 'TANK-ZZZZ' })).ok, false);
    await wacht(450);
    assert.equal((await vraag(a, 'laadProject', { code: '__proto__' })).ok, false);
  });

  it('codes raden gaat niet snel: twee keer laden binnen 0,4 s lukt niet', async () => {
    const a = await nieuw();
    assert.equal((await vraag(a, 'laadProject', { code })).ok, true);
    assert.equal((await vraag(a, 'laadProject', { code })).ok, false);
  });

  it('één verbinding maakt hooguit één nieuwe code', async () => {
    const a = await nieuw();
    const eerste = (await vraag(a, 'bewaarProject', { naam: 'Mats', werkruimte: WERKBLAD })).code;
    await wacht(2100);
    const tweede = (await vraag(a, 'bewaarProject', { naam: 'Mats', werkruimte: WERKBLAD })).code;
    assert.equal(tweede, eerste);
  });

  it('het project staat op schijf en overleeft een herstart van de server', async () => {
    await wacht(1800);   // de server schrijft hooguit om de anderhalve seconde
    const opSchijf = JSON.parse(fs.readFileSync(server.projectBestand, 'utf8'));
    assert.ok(opSchijf[code], 'de code staat in het bestand');
    await server.stop();
    server = await startServer({ map: server.map });
    const a = await nieuw();
    const terug = await vraag(a, 'laadProject', { code });
    assert.equal(terug.ok, true);
    assert.equal(terug.naam, 'Lotte');
  });
});

describe('privacy: projecten blijven niet eeuwig bewaard', () => {
  const DAG = 24 * 60 * 60 * 1000;
  const project = (naam, dagenGeleden) => ({ naam, werkruimte: WERKBLAD, bijgewerkt: Date.now() - dagenGeleden * DAG });
  const OUD = { 'TANK-OUD1': project('Oud', 200), 'TANK-NEW1': project('Nieuw', 1) };

  it('een project dat 90 dagen niet gebruikt is, verdwijnt bij het starten — ook uit het bestand', async () => {
    const server = await startServer({ projecten: OUD });
    const s = await verbind(server.poort);
    try {
      assert.equal((await vraag(s, 'laadProject', { code: 'TANK-OUD1' })).ok, false);
      await wacht(450);
      assert.equal((await vraag(s, 'laadProject', { code: 'TANK-NEW1' })).ok, true);
      await wacht(1800);
      const opSchijf = JSON.parse(fs.readFileSync(server.projectBestand, 'utf8'));
      assert.deepEqual(Object.keys(opSchijf), ['TANK-NEW1']);
      assert.match(server.log(), /1 project opgeruimd/);
    } finally { s.close(); await server.stop(); }
  });

  it('met PROJECT_BEWAARDAGEN=0 blijft alles staan', async () => {
    const server = await startServer({ projecten: OUD, env: { PROJECT_BEWAARDAGEN: '0' } });
    const s = await verbind(server.poort);
    try {
      assert.equal((await vraag(s, 'laadProject', { code: 'TANK-OUD1' })).ok, true);
    } finally { s.close(); await server.stop(); }
  });

  it('de lesgever ziet hoeveel projecten er bewaard zijn, en kan ze allemaal wissen', async () => {
    const server = await startServer({ projecten: OUD });
    const lesgever = await verbind(server.poort);
    const leerling = await verbind(server.poort);
    try {
      lesgever.emit('lesgever', {});
      await wachtOp(lesgever, 'lesgeverToegang');
      const d = await wachtOp(lesgever, 'klasoverzicht');
      assert.deepEqual(d.projecten, { aantal: 1, bewaarDagen: 90 });
      // zonder de bevestiging gebeurt er niets
      lesgever.emit('lesCommando', { type: 'wisProjecten' });
      assert.equal(await komtNiet(lesgever, 'projectenGewist'), true);
      const gewist = wachtOp(lesgever, 'projectenGewist');
      lesgever.emit('lesCommando', { type: 'wisProjecten', bevestig: 'WIS' });
      assert.equal((await gewist).aantal, 1);
      assert.equal((await vraag(leerling, 'laadProject', { code: 'TANK-NEW1' })).ok, false);
      assert.deepEqual(JSON.parse(fs.readFileSync(server.projectBestand, 'utf8')), {}, 'meteen weg uit het bestand');
      // een leerling kan dat niet
      const leeg = await verbind(server.poort);
      leeg.emit('lesCommando', { type: 'wisProjecten', bevestig: 'WIS' });
      assert.equal(await komtNiet(leeg, 'projectenGewist'), true);
      leeg.close();
    } finally { lesgever.close(); leerling.close(); await server.stop(); }
  });
});

describe('het lesgeversdashboard', () => {
  let server, lesgever, aaron, bram;
  const open = [];
  before(async () => {
    server = await startServer();
    lesgever = await verbind(server.poort);
    open.push(lesgever);
    lesgever.emit('lesgever', {});
    const toegang = await wachtOp(lesgever, 'lesgeverToegang');
    assert.equal(toegang.ok, true, 'op de laptop zelf ben je vanzelf lesgever');
    assert.equal(toegang.sleutel, 'TESTCODE');
    aaron = await leerlingIn(server, 'Aaron');
    bram = await leerlingIn(server, 'Bram');
    open.push(aaron.s, bram.s);
    const status = (naam, stap) => ({ naam, les: 1, stap, status: 'bezig', blokken: 12, stilMs: 0, checkS: true, checkG: false, code: 'TANK-AB12' });
    aaron.s.emit('lesStatus', status('Aaron', 3));
    bram.s.emit('lesStatus', status('Bram', 5));
  });
  after(async () => { for (const s of open) s.close(); await server.stop(); });

  const overzichtMet = (test) => wachtOp(lesgever, 'klasoverzicht', (d) => test(d));
  const kaartVan = (d, naam) => d.leerlingen.find((l) => l.naam === naam);
  const commando = (d) => lesgever.emit('lesCommando', d);
  let aaronId;

  it('ziet elke leerling met zijn stap, vinkjes en spel', async () => {
    const d = await overzichtMet((x) => kaartVan(x, 'Aaron') && kaartVan(x, 'Bram'));
    const a = kaartVan(d, 'Aaron');
    aaronId = a.id;
    assert.equal(a.stap, 3);
    assert.equal(a.checkS, true);
    assert.equal(a.checkG, false);
    assert.equal(a.speelt, true);
    assert.equal(a.code, 'TANK-AB12');
  });

  it('een opgestoken hand verschijnt, en "geholpen ✓" vinkt hem af', async () => {
    aaron.s.emit('hulpVraag', true);
    await overzichtMet((x) => kaartVan(x, 'Aaron') && kaartVan(x, 'Aaron').hulp);
    const afgevinkt = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'hulpKlaar');
    commando({ type: 'hulpKlaar', id: aaronId });
    await afgevinkt;
    await overzichtMet((x) => kaartVan(x, 'Aaron') && !kaartVan(x, 'Aaron').hulp);
  });

  it('een tip voor Aaron komt alleen bij Aaron aan', async () => {
    const bijAaron = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'bericht');
    const nietBijBram = komtNiet(bram.s, 'lesStuur', (x) => x.type === 'bericht');
    commando({ type: 'bericht', id: aaronId, tekst: 'Zet je toets-blok in het als-blok!' });
    const b = await bijAaron;
    assert.equal(b.tekst, 'Zet je toets-blok in het als-blok!');
    assert.equal(b.aan, 'jou');
    assert.equal(await nietBijBram, true);
  });

  it('een tip aan de hele klas komt bij iedereen aan', async () => {
    const beide = Promise.all([aaron.s, bram.s].map((s) => wachtOp(s, 'lesStuur', (x) => x.type === 'bericht' && x.aan === 'klas')));
    commando({ type: 'bericht', id: null, tekst: 'Nog vijf minuten!' });
    await beide;
  });

  it('één leerling een stap verder zetten, en de hele klas', async () => {
    const alleenAaron = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'stap');
    const nietBram = komtNiet(bram.s, 'lesStuur', (x) => x.type === 'stap');
    commando({ type: 'stapVoor', id: aaronId, stap: 4 });
    assert.deepEqual(await alleenAaron, { type: 'stap', stap: 4, alleenJij: true });
    assert.equal(await nietBram, true);

    const klas = Promise.all([aaron.s, bram.s].map((s) => wachtOp(s, 'lesStuur', (x) => x.type === 'stap' && x.stap === 6)));
    commando({ type: 'stap', stap: 6, les: 1 });
    for (const x of await klas) assert.equal(x.les, 1);
  });

  it('blokken opvragen, aanpassen en terugsturen', async () => {
    const gevraagd = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'stuurCode');
    commando({ type: 'toonCode', id: aaronId });
    await gevraagd;
    const ontvangen = wachtOp(lesgever, 'leerlingCode', (x) => x.id === aaronId);
    aaron.s.emit('mijnCode', { naam: 'Aaron', tekst: 'wanneer op groene vlag wordt geklikt', werkruimte: WERKBLAD });
    const code = await ontvangen;
    assert.deepEqual(code.werkruimte, WERKBLAD);

    const aangepast = JSON.parse(JSON.stringify(WERKBLAD));
    aangepast.blocks.blocks.push({ type: 'hat_dood', id: 'b', x: 200, y: 10 });
    const terug = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'werkruimte');
    commando({ type: 'zetWerkruimte', id: aaronId, werkruimte: aangepast });
    assert.deepEqual((await terug).werkruimte, aangepast);
  });

  it('live volgen vraagt de blokken om de twee seconden op, en stopt weer', async () => {
    commando({ type: 'volg', id: aaronId, aan: true });
    await wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'stuurCode', 3500);
    await wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'stuurCode', 3500);
    commando({ type: 'volg', id: aaronId, aan: false });
    await wacht(300);
    assert.equal(await komtNiet(aaron.s, 'lesStuur', (x) => x.type === 'stuurCode', 2600), true);
  });

  it('🧹 opruimen komt bij de leerling aan', async () => {
    const op = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'opruimen');
    commando({ type: 'opruimen', id: aaronId });
    await op;
  });

  it('"ogen op mij" zet iedereen stil, ook wie later binnenkomt', async () => {
    const beide = Promise.all([aaron.s, bram.s].map((s) => wachtOp(s, 'lesStuur', (x) => x.type === 'bevries' && x.aan)));
    commando({ type: 'bevries', aan: true });
    await beide;
    // wie nu binnenkomt, hoort het meteen
    let gehoord = null;
    const laat = await verbind(server.poort, (s) => s.on('lesStuur', (x) => { if (x.type === 'bevries') gehoord = x; }));
    open.push(laat);
    await wacht(300);
    assert.deepEqual(gehoord, { type: 'bevries', aan: true });
    // de wereld staat echt stil: rijden lukt niet
    const st1 = mijnTank(await wachtOp(aaron.s, 'state', (x) => !!mijnTank(x, aaron.id)), aaron.id);
    const tik = setInterval(() => aaron.s.emit('intent', { mx: 1, my: 0, angle: 0, shoot: false }), 33);
    await wacht(600);
    clearInterval(tik);
    const st2 = mijnTank(await wachtOp(aaron.s, 'state'), aaron.id);
    assert.equal(st2.x, st1.x);
    const weer = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'bevries' && !x.aan);
    commando({ type: 'bevries', aan: false });
    await weer;
  });

  it('teams, iedereen naar de arena, en een ronde', async () => {
    commando({ type: 'teams', n: 2 });
    await overzichtMet((x) => x.teamModus === 2);
    const naar = wachtOp(bram.s, 'lesStuur', (x) => x.type === 'naarArena');
    commando({ type: 'naarArena', teams: 2 });
    assert.equal((await naar).teams, 2);

    const speler = await leerlingIn(server, 'Arena', 'samen');
    open.push(speler.s);
    const st = await wachtOp(speler.s, 'state', (x) => !!mijnTank(x, speler.id));
    assert.equal(st.zones.length, 2, 'twee teamzones');
    assert.ok([0, 1].includes(mijnTank(st, speler.id).team), 'de speler zit in een team');

    const start = wachtOp(speler.s, 'rondeStart');
    commando({ type: 'ronde', minuten: 5, doel: 1000 });
    assert.equal((await start).minuten, 5);
    const d = await overzichtMet((x) => !!x.ronde);
    assert.ok(d.ronde.over > 290 && d.ronde.over <= 300);
    const klaar = wachtOp(speler.s, 'rondeKlaar');
    commando({ type: 'rondeStop' });
    assert.equal((await klaar).reden, 'lesgever');
    commando({ type: 'teams', n: 0 });
    await overzichtMet((x) => x.teamModus === 0);
  });

  it('een heuvelronde: de heuvel zit in het pakketje en staat op het dashboard', async () => {
    const speler = await leerlingIn(server, 'Heuvel', 'samen');
    open.push(speler.s);
    const start = wachtOp(speler.s, 'rondeStart');
    commando({ type: 'ronde', minuten: 5, doel: 0, soort: 'heuvel' });
    assert.equal((await start).soort, 'heuvel');
    const st = await wachtOp(speler.s, 'state', (x) => !!x.heuvel);
    assert.equal(st.heuvel.x, Math.round(st.arena.w / 2));
    assert.ok(st.heuvel.r > 300);
    assert.equal(st.ronde.soort, 'heuvel');
    const d = await overzichtMet((x) => x.ronde && x.ronde.soort === 'heuvel');
    assert.ok('heuvel' in d.ronde);
    const klaar = wachtOp(speler.s, 'rondeKlaar');
    commando({ type: 'rondeStop' });
    await klaar;
  });

  it('het geluid van de hele klas uit — ook voor wie later binnenkomt — en weer aan', async () => {
    const beide = Promise.all([aaron.s, bram.s].map((s) => wachtOp(s, 'lesStuur', (x) => x.type === 'geluid' && x.aan === false)));
    commando({ type: 'geluid', aan: false });
    await beide;
    await overzichtMet((x) => x.klasStil === true);
    let gehoord = null;
    const laat = await verbind(server.poort, (s) => s.on('lesStuur', (x) => { if (x.type === 'geluid') gehoord = x; }));
    open.push(laat);
    await wacht(300);
    assert.deepEqual(gehoord, { type: 'geluid', aan: false });
    const weer = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'geluid' && x.aan === true);
    commando({ type: 'geluid', aan: true });
    await weer;
    await overzichtMet((x) => x.klasStil === false);
  });

  it('ziet welke stappen een leerling al haalde, en of zijn hint openstaat', async () => {
    aaron.s.emit('lesStatus', {
      naam: 'Aaron', les: 1, stap: 4, status: 'bezig', blokken: 12, stilMs: 0, checkS: true, checkG: false,
      code: 'TANK-AB12', gehaald: [3, 1, 2, 2, 99, 'x', -1], hint: true,
    });
    const d = await overzichtMet((x) => kaartVan(x, 'Aaron') && kaartVan(x, 'Aaron').stap === 4);
    assert.deepEqual(kaartVan(d, 'Aaron').gehaald, [1, 2, 3], 'dubbel, onzin en buiten bereik vallen weg');
    assert.equal(kaartVan(d, 'Aaron').hint, true);
  });

  it('ziet wat er opvalt aan zijn programma (los, geen startblok, staat uit, niet herstart)', async () => {
    bram.s.emit('lesStatus', {
      naam: 'Bram', les: 1, stap: 5, status: 'vast', blokken: 9, stilMs: 0, checkS: false, checkG: false,
      los: 3, geenStart: true, draait: true, verouderd: true,
    });
    let d = await overzichtMet((x) => kaartVan(x, 'Bram') && kaartVan(x, 'Bram').los === 3);
    const b = kaartVan(d, 'Bram');
    assert.equal(b.status, 'vast');
    assert.equal(b.geenStart, true);
    assert.equal(b.draait, true);
    assert.equal(b.verouderd, true);
    // onzin wordt netjes een getal binnen de grenzen
    bram.s.emit('lesStatus', { naam: 'Bram', les: 1, stap: 5, status: 'bezig', los: 'veel', draait: 0 });
    d = await overzichtMet((x) => kaartVan(x, 'Bram') && kaartVan(x, 'Bram').status === 'bezig');
    assert.equal(kaartVan(d, 'Bram').los, 0);
    assert.equal(kaartVan(d, 'Bram').draait, false);
    bram.s.emit('lesStatus', { naam: 'Bram', les: 1, stap: 5, status: 'bezig', los: 5000 });
    d = await overzichtMet((x) => kaartVan(x, 'Bram') && kaartVan(x, 'Bram').los > 0);
    assert.equal(kaartVan(d, 'Bram').los, 99);
  });

  it('telt hoe vaak een leerling zijn hand opsteekt (ook in het rapport)', async () => {
    const kaart = kaartVan(await overzichtMet((x) => !!kaartVan(x, 'Bram')), 'Bram');
    const voor = kaart.hulpKeer;
    bram.s.emit('hulpVraag', true);
    bram.s.emit('hulpVraag', true);   // nog eens drukken terwijl hij al omhoog is: telt niet dubbel
    await overzichtMet((x) => kaartVan(x, 'Bram') && kaartVan(x, 'Bram').hulpKeer === voor + 1);
    await wacht(1700);                // een volledig overzicht later: nog altijd maar één keer
    assert.equal(kaartVan(await overzichtMet((x) => !!kaartVan(x, 'Bram')), 'Bram').hulpKeer, voor + 1);
    commando({ type: 'hulpKlaar', id: kaart.id });
    await overzichtMet((x) => kaartVan(x, 'Bram') && !kaartVan(x, 'Bram').hulp);
    bram.s.emit('hulpVraag', true);
    const d = await overzichtMet((x) => kaartVan(x, 'Bram') && kaartVan(x, 'Bram').hulpKeer === voor + 2);
    assert.equal(kaartVan(d, 'Bram').hulp, true);
    bram.s.emit('hulpVraag', false);
    const rapport = wachtOp(lesgever, 'klasrapport');
    commando({ type: 'rapport' });
    const r = await rapport;
    assert.equal(r.leerlingen.find((l) => l.naam === 'Bram').hulp, voor + 2);
  });

  it('het klasrapport kent elke leerling en zijn hoogste stap', async () => {
    const rapport = wachtOp(lesgever, 'klasrapport');
    commando({ type: 'rapport' });
    const r = await rapport;
    const a = r.leerlingen.find((l) => l.naam === 'Aaron');
    assert.ok(a && a.maxStap >= 3);
  });

  it('een leerling kan geen lesgeverscommando\'s sturen', async () => {
    const niets = komtNiet(aaron.s, 'lesStuur', (x) => x.type === 'bevries' || x.type === 'bericht');
    bram.s.emit('lesCommando', { type: 'bevries', aan: true });
    bram.s.emit('lesCommando', { type: 'bericht', id: null, tekst: 'haha' });
    assert.equal(await niets, true);
  });

  /* Wie 15 seconden niets meldt, valt uit het overzicht (zie stuurKlasoverzicht):
     de leerlingen van deze tests laten dus eerst even van zich horen. */
  const meldStatus = (wie, naam) => wie.s.emit('lesStatus', { naam, les: 1, stap: 3, status: 'bezig', blokken: 5, stilMs: 0 });

  it('een hand met een reden: de lesgever ziet waarom (en een oude true/false werkt nog)', async () => {
    meldStatus(aaron, 'Aaron');
    await overzichtMet((x) => !!kaartVan(x, 'Aaron'));
    aaron.s.emit('hulpVraag', { aan: true, reden: 'blok-zoeken' });
    let d = await overzichtMet((x) => kaartVan(x, 'Aaron') && kaartVan(x, 'Aaron').hulpReden === 'blok-zoeken');
    assert.equal(kaartVan(d, 'Aaron').hulp, true);
    commando({ type: 'hulpKlaar', id: aaronId });
    d = await overzichtMet((x) => kaartVan(x, 'Aaron') && !kaartVan(x, 'Aaron').hulp);
    assert.equal(kaartVan(d, 'Aaron').hulpReden, null, 'na "geholpen" is ook de reden weg');
    // onzin als reden: de hand gaat wel omhoog, zonder reden
    aaron.s.emit('hulpVraag', { aan: true, reden: '<script>' });
    d = await overzichtMet((x) => kaartVan(x, 'Aaron') && kaartVan(x, 'Aaron').hulp);
    assert.equal(kaartVan(d, 'Aaron').hulpReden, null);
    aaron.s.emit('hulpVraag', false);
    await overzichtMet((x) => kaartVan(x, 'Aaron') && !kaartVan(x, 'Aaron').hulp);
    aaron.s.emit('hulpVraag', true);   // een browser van vóór de redenen
    await overzichtMet((x) => kaartVan(x, 'Aaron') && kaartVan(x, 'Aaron').hulp);
    aaron.s.emit('hulpVraag', false);
  });

  it('een leerling op de beamer: zijn naam, zijn blokken en wat hij ziet, en weer terug', async () => {
    meldStatus(aaron, 'Aaron');
    meldStatus(bram, 'Bram');
    await overzichtMet((x) => !!kaartVan(x, 'Aaron') && !!kaartVan(x, 'Bram'));
    const beamer = await verbind(server.poort);
    open.push(beamer);
    beamer.emit('beamer', {});
    await wachtOp(beamer, 'state');
    const naam = wachtOp(beamer, 'spotlight', (x) => x && x.id === aaronId);
    const codeGevraagd = wachtOp(aaron.s, 'lesStuur', (x) => x.type === 'stuurCode');
    commando({ type: 'beamer', id: aaronId });
    const info = await naam;
    assert.equal(info.naam, 'Aaron');
    assert.equal(typeof info.stap, 'number');
    await codeGevraagd;
    // zijn blokken komen ook op de beamer
    const blokken = wachtOp(beamer, 'spotlightCode', (x) => x.id === aaronId);
    aaron.s.emit('mijnCode', { naam: 'Aaron', tekst: 'wanneer op groene vlag wordt geklikt', werkruimte: WERKBLAD });
    assert.deepEqual((await blokken).werkruimte, WERKBLAD);
    // en wat hij ziet, met zijn tanknummer erbij (ook al speelt hij solo)
    const zicht = await wachtOp(beamer, 'spotState');
    assert.equal(zicht.spotNr, aaron.id);
    assert.ok(zicht.tanks.some((t) => t.id === aaron.id));
    let d = await overzichtMet((x) => x.spotlight === aaronId);
    assert.equal(d.spotlight, aaronId);
    // terug naar de arena
    const terug = wachtOp(beamer, 'spotlight', (x) => x === null);
    commando({ type: 'beamer', id: null });
    await terug;
    d = await overzichtMet((x) => x.spotlight === null);
    assert.equal(await komtNiet(beamer, 'spotState', () => true, 600), true);
    // een id die niet in de klas zit, zet niemand op de beamer
    commando({ type: 'beamer', id: 'bestaat-niet' });
    d = await overzichtMet((x) => x.spotlight === null);
    // een leerling kan het niet
    bram.s.emit('lesCommando', { type: 'beamer', id: kaartVan(d, 'Bram').id });
    assert.equal(await komtNiet(beamer, 'spotlight', (x) => x !== null, 2500), true);
  });

  it('zoomt de beamer in, dan krijgt hij de vormen van dát stuk arena', async () => {
    const beamer = await verbind(server.poort);
    open.push(beamer);
    beamer.emit('beamer', {});
    const eerst = await wachtOp(beamer, 'state', (x) => Array.isArray(x.vormen) && x.vormen.length > 0);
    const zicht = { x: 1000, y: 1000, w: 3000, h: 1800 };
    beamer.emit('beamerKijk', zicht);
    await wacht(300);
    const st = await wachtOp(beamer, 'state', (x) => Array.isArray(x.vormen) && x.vormen.length > 0);
    const rand = 300;
    for (const v of st.vormen) {
      assert.ok(v.x >= zicht.x - rand && v.x <= zicht.x + zicht.w + rand
        && v.y >= zicht.y - rand && v.y <= zicht.y + zicht.h + rand, `vorm ${v.id} ligt buiten het beeld van de beamer`);
    }
    // overal in de arena verspreid lag de eerste greep wél
    assert.ok(eerst.vormen.some((v) => v.x > zicht.x + zicht.w + rand || v.y > zicht.y + zicht.h + rand));
  });
});
