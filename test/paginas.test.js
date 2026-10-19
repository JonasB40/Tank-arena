/*
 * De drie pagina's (leerling, lesgever, beamer) zonder browser nagekeken:
 * bestaat elk script, past alles samen zonder dubbele namen, en bestaat elk
 * HTML-element waar de code naar vraagt? Precies de fouten die je anders pas
 * ziet als je de pagina opent — of erger: als een leerling op een knop drukt.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MAP = path.join(__dirname, '..');
const PUBLIC = path.join(MAP, 'public');
const PAGINAS = ['index.html', 'lesgever.html', 'beamer.html'];

function scriptsVan(pagina) {
  const html = fs.readFileSync(path.join(PUBLIC, pagina), 'utf8');
  const uit = [];
  for (const m of html.matchAll(/<script(?:\s+src="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)) {
    uit.push(m[1] ? { src: m[1] } : { inline: m[2] });
  }
  return { html, scripts: uit };
}

describe('de pagina\'s', () => {
  for (const pagina of PAGINAS) {
    const { html, scripts } = scriptsVan(pagina);

    it(`${pagina}: elk script bestaat`, () => {
      for (const { src } of scripts.filter((s) => s.src)) {
        if (src === '/socket.io/socket.io.js') continue;   // die maakt de server zelf
        const bestand = src.startsWith('/blockly/')
          ? path.join(MAP, 'node_modules', 'blockly', src.slice('/blockly/'.length))
          : path.join(PUBLIC, src);
        assert.ok(fs.existsSync(bestand), `${src} bestaat niet`);
      }
    });

    /* Onze eigen scripts delen in de browser één ruimte voor hun namen. Staat
       dezelfde naam (let/const/class) in twee bestanden, dan weigert de
       browser het tweede bestand — en werkt de halve pagina niet. */
    const eigen = scripts
      .filter((s) => s.inline !== undefined || (s.src && s.src.startsWith('js/')))
      .map((s) => (s.src ? { naam: s.src, code: fs.readFileSync(path.join(PUBLIC, s.src), 'utf8') } : { naam: 'inline', code: s.inline }));

    it(`${pagina}: alle scripts samen zijn geldige code zonder dubbele namen`, () => {
      const samen = eigen.map((s) => `/* ==== ${s.naam} ==== */\n${s.code}\n;`).join('\n');
      assert.doesNotThrow(() => new vm.Script(samen, { filename: pagina }));
    });

    it(`${pagina}: elk element dat de code opvraagt, staat in de pagina`, () => {
      const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      // ook elementen die een script zelf in de pagina zet (id="..." in een stukje HTML)
      for (const s of eigen) for (const m of s.code.matchAll(/\bid=\\?"([a-z0-9-]+)\\?"/g)) ids.add(m[1]);
      const gevraagd = new Set();
      for (const s of eigen) {
        for (const m of s.code.matchAll(/getElementById\('([^'$]+)'\)/g)) gevraagd.add(m[1]);
      }
      const ontbreekt = [...gevraagd].filter((id) => !ids.has(id) && !OPTIONEEL.has(id));
      assert.deepEqual(ontbreekt, []);
    });
  }
});

/* Elementen die een script opvraagt maar die niet op elke pagina staan; de
   code kijkt daar zelf na of ze er zijn (editor.js draait ook op het dashboard). */
const OPTIONEEL = new Set([
  'knop-opruimen', 'knop-inklappen', 'label-inklappen', 'modus-starter', 'modus-expert', 'blok-uitleg',
  'var-overlay', 'var-naam', 'serverversie',
  'vlag',   // de groene vlag knippert bij gewijzigde blokken; het dashboard heeft er geen
]);

describe('Blockly', () => {
  const pakket = JSON.parse(fs.readFileSync(path.join(MAP, 'package.json'), 'utf8'));
  const geinstalleerd = JSON.parse(fs.readFileSync(path.join(MAP, 'node_modules', 'blockly', 'package.json'), 'utf8')).version;

  it('staat vast op één versie, en die is geïnstalleerd', () => {
    assert.match(pakket.dependencies.blockly, /^\d+\.\d+\.\d+$/, 'geen ^ of ~: anders komt er stilletjes een nieuwere');
    assert.equal(geinstalleerd, pakket.dependencies.blockly);
  });

  it('heeft nog de onderdelen waar het makkelijke wikkelen op leunt', () => {
    const Blockly = require(path.join(MAP, 'node_modules', 'blockly', 'blockly_compressed.js'));
    const strategie = Blockly.dragging && Blockly.dragging.BlockDragStrategy;
    assert.ok(strategie, 'Blockly.dragging.BlockDragStrategy bestaat niet meer');
    for (const naam of ['getConnectionCandidate', 'endDrag', 'getLocalConnections']) {
      assert.equal(typeof strategie.prototype[naam], 'function', naam);
    }
  });
});
