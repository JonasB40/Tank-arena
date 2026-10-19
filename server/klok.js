/*
 * Een klok die ook op Windows klopt, en een vangnet voor fouten.
 */

/*
 * Eén fout mag nooit de hele klas platleggen. Een onverwachte fout in de
 * spel-lus of in een bericht van één browser liet vroeger het hele programma
 * stoppen: zwart venster dicht, iedereen uit het spel. Nu schrijven we de fout
 * op (hooguit één keer per tien seconden dezelfde) en draait de rest door.
 */
const gemeldeFouten = new Map();
function meldFout(waar, err) {
  const tekst = `${waar}: ${(err && err.stack) || err}`;
  const nu = Date.now();
  if (nu - (gemeldeFouten.get(tekst) || 0) < 10000) return;
  gemeldeFouten.set(tekst, nu);
  console.log(`   ⚠ fout in ${tekst}`);
}

/*
 * EEN KLOK DIE OOK OP WINDOWS KLOPT. Op Windows gaat een timer van Node maar
 * om de 15,6 ms af. setInterval(…, 33) liep daardoor 21 keer per seconde in
 * plaats van 30, en de wereld ging 16 keer per seconde naar de leerlingen in
 * plaats van 20 (gemeten op de lesgeverslaptop). Alles bewoog schokkeriger dan
 * nodig. Deze klok onthoudt wanneer de volgende beurt had moeten komen: komt
 * een beurt te laat, dan wacht de volgende korter. Zo haal je gemiddeld
 * precies het gevraagde aantal per seconde. Online (Linux) verandert er niets.
 */
function elke(ms, fn) {
  let volgende = performance.now() + ms;
  const beurt = () => {
    fn();
    volgende += ms;
    const nu = performance.now();
    // lag de laptop even te slapen? dan niet alles inhalen, gewoon verder
    if (nu - volgende > ms * 5) volgende = nu + ms;
    const wacht = volgende - nu;
    if (wacht <= 1) setImmediate(beurt);
    else setTimeout(beurt, wacht);
  };
  setTimeout(beurt, ms);
}

module.exports = { elke, meldFout };
