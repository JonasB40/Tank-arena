/*
 * De spelregels en de toegang, rechtstreeks nagerekend (zonder server).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.LESGEVER_SLEUTEL = 'Geheim7';
const regels = require('../server/regels');
const toegang = require('../server/toegang');

describe('de spelregels (zoals diep.io)', () => {
  it('levels volgen de echte diep.io-tabel', () => {
    assert.equal(regels.levelVan(0), 1);
    assert.equal(regels.levelVan(130), 7, 'één vijfhoek = level 7');
    assert.equal(regels.levelVan(787), 15);
    assert.equal(regels.levelVan(23536), 45);
    assert.equal(regels.levelVan(10 ** 9), 45, 'nooit boven level 45');
  });

  it('in totaal 33 statpunten: te weinig om alles te maxen, je moet kiezen', () => {
    let som = 0;
    for (let l = 2; l <= 45; l++) som += regels.statPuntenBijLevel(l);
    assert.equal(som, 33);
  });

  it('levens, herladen en kogelschade kloppen met de wiki', () => {
    const tank = (stats, level = 1) => ({ level, klasse: 'basis', stats: Object.assign(regels.legeStats(), stats) });
    assert.equal(regels.maxHpVan(tank({})), 50);
    assert.equal(regels.maxHpVan(tank({}, 45)), 138);
    assert.equal(Math.round(regels.herlaadMsVan(tank({ herladen: 7 }))), 320);
    assert.equal(regels.bulletSchadeVan(tank({ kogelschade: 7 })), 28);
  });

  it('een naam wordt veilig: geen HTML, niet te lang, nooit leeg', () => {
    assert.equal(regels.saneNaam('<b>Emma</b>'), 'bEmma/b');
    assert.equal(regels.saneNaam('Abcdefghijklmnopqrstuvwxyz').length, 16);
    assert.equal(regels.saneNaam('   '), 'Speler');
  });
});

describe('wie mag lesgeven', () => {
  const socket = (adres, metProxy) => ({ handshake: { address: adres, headers: metProxy ? { 'x-forwarded-for': '1.2.3.4' } : {} } });

  it('op de laptop zelf hoef je geen code te typen', () => {
    assert.equal(toegang.magLesgeven(socket('127.0.0.1')), true);
    assert.equal(toegang.magLesgeven(socket('::ffff:127.0.0.1')), true);
  });

  it('op een ander toestel (of online, via een proxy) is de code nodig', () => {
    assert.equal(toegang.magLesgeven(socket('10.0.0.57')), false);
    assert.equal(toegang.magLesgeven(socket('127.0.0.1', true)), false, 'een proxy-verzoek is nooit "deze laptop"');
    assert.equal(toegang.magLesgeven(socket('10.0.0.57'), 'fout'), false);
    assert.equal(toegang.magLesgeven(socket('10.0.0.57'), ' geheim7 '), true, 'hoofdletters en spaties maken niet uit');
  });
});

describe('projectopslag', () => {
  it('zonder testbestand bewaart de server in projecten.json naast server.js', () => {
    const oud = process.env.PROJECT_BESTAND;
    delete process.env.PROJECT_BESTAND;
    delete require.cache[require.resolve('../server/projecten')];
    const { PROJECT_BESTAND } = require('../server/projecten');
    if (oud) process.env.PROJECT_BESTAND = oud;
    assert.equal(PROJECT_BESTAND, path.join(__dirname, '..', 'projecten.json'));
  });
});
