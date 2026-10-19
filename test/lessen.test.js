/*
 * De lessen nagekeken zonder browser: de echte blokken, de echte compiler en
 * de echte controles uit stappen.js. Verandert er iets aan een blok of aan een
 * stap, dan zie je hier meteen of een lesstap nog haalbaar is — en niet pas
 * als een kind in de klas vastloopt.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  laadBestanden, compileer, blok, stapel, waarde, getal, hoek, werkblad, JS,
} = require('./browserbestanden');

const omgeving = laadBestanden(['blokken.js', 'compiler.js', 'voorbeeld.js', 'stappen.js', 'codetekst.js']);
const { STAPPEN, LES2_STAPPEN } = omgeving;
const structuurOk = (stap, programma) => !!stap.check.structuur(programma);

/* Kleine programma's zoals een kind ze per stap bouwt. */
const start = (...blokken) => Object.assign(blok('hat_start'), blokken.length ? { next: stapel(...blokken) } : {});
const rijd = () => [blok('richt_rij', null, { HOEK: hoek(0) }), blok('neem_stappen', null, { N: getal(10) })];
const alsToets = (toets, graden) => blok('als_blok', null, {
  COND: waarde(blok('toets_ingedrukt', { TOETS: toets })),
  DAN: stapel(blok('richt_rij', null, { HOEK: hoek(graden) }), blok('neem_stappen', null, { N: getal(10) })),
});
const herhaal = (...binnen) => blok('herhaal_continu', null, { DOEN: stapel(...binnen) });

describe('de lessen', () => {
  it('les 1 heeft 15 stappen en les 2 zes, elk met een controle en uitleg', () => {
    assert.equal(STAPPEN.length, 15);
    assert.equal(LES2_STAPPEN.length, 6);
    for (const s of [...STAPPEN, ...LES2_STAPPEN]) {
      assert.equal(typeof s.check.structuur, 'function', `stap ${s.nr}`);
      assert.equal(typeof s.check.gedrag, 'function', `stap ${s.nr}`);
      assert.ok(s.titel && s.probleem && s.doel && s.hint, `stap ${s.nr} mist tekst`);
    }
  });

  it('de voorbeeldoplossing voor de lesgever haalt elke stap van les 1', () => {
    const programma = compileer(omgeving, omgeving.VOORBEELD_OPLOSSING);
    // [...] maakt er een gewone lijst van (die uit de afgeschermde omgeving vergelijkt anders)
    const niet = [...STAPPEN.filter((s) => !structuurOk(s, programma)).map((s) => s.nr)];
    assert.deepEqual(niet, [], `deze stappen haalt het voorbeeld niet: ${niet.join(', ')}`);
  });

  it('een leeg werkblad haalt geen enkele stap', () => {
    const leeg = compileer(omgeving, omgeving.SJABLOON);
    for (const s of [...STAPPEN, ...LES2_STAPPEN]) assert.equal(structuurOk(s, leeg), false, `stap ${s.nr}`);
  });

  it('elke stap begint met een probleem: wat stap 1 haalt, haalt stap 2 nog niet', () => {
    const [s1, s2, s3, s4] = STAPPEN;
    const na1 = compileer(omgeving, werkblad(start(...rijd())));
    assert.equal(structuurOk(s1, na1), true);
    assert.equal(structuurOk(s2, na1), false);

    const na2 = compileer(omgeving, werkblad(start(herhaal(...rijd()))));
    assert.equal(structuurOk(s2, na2), true);
    assert.equal(structuurOk(s3, na2), false);

    const na3 = compileer(omgeving, werkblad(start(herhaal(alsToets('ArrowUp', 0)))));
    assert.equal(structuurOk(s3, na3), true);
    assert.equal(structuurOk(s4, na3), false);

    const na4 = compileer(omgeving, werkblad(start(herhaal(
      alsToets('ArrowUp', 0), alsToets('ArrowRight', 90), alsToets('ArrowDown', 180), alsToets('ArrowLeft', -90)))));
    assert.equal(structuurOk(s4, na4), true);
  });

  it('stap 2: een stappen-blok ónder de herhaal-lus telt niet als herhalen', () => {
    const fout = compileer(omgeving, werkblad(Object.assign(blok('hat_start'), {
      next: stapel(blok('herhaal_continu'), ...rijd()),
    })));
    assert.equal(structuurOk(STAPPEN[1], fout), false);
  });

  it('stap 5 zegt "bijna!" als het richt-blok wel in de lus staat maar niet bovenaan', () => {
    const p = compileer(omgeving, werkblad(start(herhaal(alsToets('ArrowUp', 0), blok('richt_muis')))));
    const s5 = STAPPEN[4];
    assert.equal(structuurOk(s5, p), false);
    assert.match(s5.check.structuurTekst(p), /bijna/);
  });

  it('een stapeltje zonder 🚩 erboven doet niets', () => {
    const p = compileer(omgeving, werkblad(blok('herhaal_continu', null, { DOEN: stapel(...rijd()) })));
    assert.deepEqual(JSON.parse(JSON.stringify(p)), []);
  });
});

describe('zien wat je programma doet', () => {
  it('elk commando draagt het id van zijn blok (zodat het kan oplichten)', () => {
    const B = omgeving.Blockly;
    const ws = new B.Workspace();
    B.serialization.workspaces.load(omgeving.VOORBEELD_OPLOSSING, ws);
    const bestaand = new Set(ws.getAllBlocks(false).map((b) => b.id));
    const programma = omgeving.compileerProject(ws);
    ws.dispose();
    const alle = [];
    for (const s of programma) { alle.push(s); omgeving.alleCmds(s.body, alle); }
    assert.ok(alle.length > 40);
    for (const c of alle) assert.ok(bestaand.has(c.id), `${c.t || 'startblok'} zonder geldig id`);
  });

  it('een stapel zonder startblok en een los waardeblokje worden herkend', () => {
    const B = omgeving.Blockly;
    const ws = new B.Workspace();
    B.serialization.workspaces.load(werkblad(
      start(herhaal(...rijd())),
      Object.assign(blok('herhaal_continu', null, { DOEN: stapel(...rijd()) }), { id: 'los1' }),
      Object.assign(blok('toets_ingedrukt', { TOETS: 'ArrowUp' }), { id: 'los2' }),
      Object.assign(blok('hat_dood'), { id: 'hoed' }),
    ), ws);
    const los = JSON.parse(JSON.stringify(omgeving.losseStapels(ws)));
    ws.dispose();
    assert.deepEqual(los.sort((a, b) => a.id.localeCompare(b.id)), [
      { id: 'los1', soort: 'stapel' },
      { id: 'los2', soort: 'waarde' },
    ]);
  });
});

describe('de blokken', () => {
  /* Alle bloktypes die blokken.js maakt. */
  const bron = fs.readFileSync(path.join(JS, 'blokken.js'), 'utf8');
  const types = [...bron.matchAll(/\{\s*type: '([a-z_]+)', message0/g)].map((m) => m[1]);
  const hoedjes = new Set(['hat_start', 'hat_toets', 'hat_geraakt', 'hat_levelup', 'hat_dood', 'hat_versla', 'hat_statpunt', 'hat_signaal']);
  const runtimeBron = fs.readFileSync(path.join(JS, 'runtime.js'), 'utf8');
  const B = omgeving.Blockly;

  it('er zijn blokken gevonden', () => assert.ok(types.length > 40, `${types.length} blokken`));

  it('elk blok wordt door de compiler begrepen én door de runtime uitgevoerd', () => {
    const ws = new B.Workspace();
    const onbekend = [];
    for (const type of types) {
      if (hoedjes.has(type)) continue;
      const b = ws.newBlock(type);
      if (b.outputConnection) {
        // een waardeblok: de keuzes van een keuzelijst zijn elk een eigen waarde
        const lijst = b.getField('W');
        const waarden = lijst ? lijst.getOptions(false).map(([, v]) => v) : [null];
        for (const w of waarden) {
          if (w) b.setFieldValue(w, 'W');
          const x = omgeving.exprVan(b);
          if (type !== 'math_number' && x.e === 'num' && x.v === 0) onbekend.push(`${type} (compiler)`);
          else if (!runtimeBron.includes(`case '${x.e}'`)) onbekend.push(`${type}${w ? ':' + w : ''} → ${x.e} (runtime)`);
        }
      } else {
        const c = omgeving.cmdVan(b);
        if (!c) onbekend.push(`${type} (compiler)`);
        else if (!runtimeBron.includes(`case '${c.t}'`)) onbekend.push(`${type} → ${c.t} (runtime)`);
      }
    }
    ws.dispose();
    assert.deepEqual(onbekend, []);
  });

  it('elk hoedblok start een stapeltje', () => {
    for (const type of hoedjes) {
      const p = compileer(omgeving, werkblad(Object.assign(blok(type), { next: stapel(blok('schiet_blok')) })));
      assert.equal(p.length, 1, type);
      assert.equal(p[0].body[0].t, 'schiet', type);
    }
  });

  it('de lesgever kan elk programma als tekst lezen', () => {
    const tekst = omgeving.programmaAlsTekst(compileer(omgeving, omgeving.VOORBEELD_OPLOSSING));
    assert.match(tekst, /wanneer op groene vlag wordt geklikt/);
    assert.doesNotMatch(tekst, /undefined|\?\?/);
  });
});
