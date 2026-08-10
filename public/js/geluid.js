/*
 * Geluidjes — zelf gegenereerd met WebAudio, dus geen bestanden nodig.
 * Kort en zacht gehouden: 20 Chromebooks in één lokaal is snel veel.
 * De 🔊-knop in de bovenbalk dempt alles (onthouden per toestel).
 */
let audioCtx = null;
let gedempt = localStorage.getItem('tankGeluidUit') === '1';
let laatsteGeluid = 0;

function haalAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function toon(freq, duur, golf, volume, glijNaar) {
  if (gedempt) return;
  try {
    const c = haalAudioCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = golf;
    o.frequency.value = freq;
    if (glijNaar) o.frequency.exponentialRampToValueAtTime(glijNaar, c.currentTime + duur);
    g.gain.value = volume;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + duur);
  } catch { /* geen audio beschikbaar */ }
}

const GELUIDEN = {
  pew: () => toon(900, 0.1, 'square', 0.045, 320),
  tik: () => toon(220, 0.07, 'sawtooth', 0.07, 120),
  plop: () => toon(320, 0.14, 'sine', 0.11, 80),
  boing: () => toon(140, 0.28, 'sine', 0.11, 620),
  tada: () => {
    toon(523, 0.12, 'triangle', 0.09);
    setTimeout(() => toon(659, 0.12, 'triangle', 0.09), 110);
    setTimeout(() => toon(784, 0.22, 'triangle', 0.09), 220);
  },
};

function speelGeluid(naam) {
  const nu = Date.now();
  if (nu - laatsteGeluid < 60) return; // niet stapelen
  laatsteGeluid = nu;
  (GELUIDEN[naam] || (() => {}))();
}

function zetGeluid(aan) {
  gedempt = !aan;
  localStorage.setItem('tankGeluidUit', gedempt ? '1' : '0');
}
function geluidStaatAan() { return !gedempt; }
