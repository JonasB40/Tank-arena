/*
 * JOYSTICK VOOR TABLETS
 *
 * Op een iPad zijn er geen pijltjestoetsen. Deze joystick drukt ze voor je in:
 * duw je hem omhoog, dan is voor het spel "pijltje omhoog" ingedrukt — precies
 * alsof je op een toetsenbord zit. Daardoor werken alle blokken uit de les
 * ongewijzigd ("als toets pijltje omhoog ingedrukt?", "wanneer toets …"), en
 * bouwt een kind op een iPad exact hetzelfde programma als zijn buur op een
 * chromebook. De pijltjes rond de joystick lichten op, zodat het ziet wélke
 * toets het op dat moment indrukt.
 *
 * Mikken en schieten gaat met de andere hand: tikken op het speelveld is "de
 * muis" (zie de pointer-events in game.js).
 *
 * Schuin duwen drukt twee pijltjes tegelijk in, net als twee toetsen op een
 * toetsenbord. Zonder eigen sturing doet de joystick niets — net zoals de
 * pijltjestoetsen niets doen zolang je die blokken nog niet gebouwd hebt.
 */
(function () {
  const basis = document.getElementById('joystick');
  const duim = document.getElementById('joystick-duim');
  const spatie = document.getElementById('spatie-knop');
  const schakel = document.getElementById('joystick-schakel');
  if (!basis || !duim || !spatie || !schakel) return;

  /* Wanneer staat hij aan? Vanzelf als het toestel vooral met een vinger
     bediend wordt (iPad, tablet). Een chromebook met aanraakscherm heeft ook
     een touchpad en een toetsenbord: daar staat hij uit, maar mag je hem met
     de 🕹️-knop aanzetten. Die keuze onthoudt het toestel. */
  const heeftAanraakscherm = (navigator.maxTouchPoints || 0) > 0;
  const vooralVinger = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  let aan = vooralVinger;
  try {
    const bewaard = localStorage.getItem('tankJoystick');
    if (bewaard !== null) aan = bewaard === '1';
  } catch { /* geen opslag: dan de automatische keuze */ }

  /* ---------------- toetsen indrukken en loslaten ---------------- */
  const ingedrukt = new Set();   // welke toetsen de joystick nú indrukt
  const pijlen = [...basis.querySelectorAll('.js-pijl')];

  function zetToetsen(nieuw) {
    const toetsen = window.runtime.toetsen;
    for (const k of [...ingedrukt]) {
      if (!nieuw.has(k)) { toetsen.delete(k); ingedrukt.delete(k); }
    }
    for (const k of nieuw) {
      if (!ingedrukt.has(k)) { toetsen.add(k); ingedrukt.add(k); }
    }
    for (const p of pijlen) p.classList.toggle('aan', ingedrukt.has(p.dataset.toets));
  }

  /* Acht richtingen van elk 45 graden, met rechts als 0 (de y-as wijst op
     het scherm naar beneden). Schuin = twee pijltjes tegelijk. */
  const RICHTINGEN = [
    ['ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowDown'], ['ArrowDown', 'ArrowLeft'],
    ['ArrowLeft'], ['ArrowLeft', 'ArrowUp'], ['ArrowUp'], ['ArrowUp', 'ArrowRight'],
  ];

  let vinger = null;   // welke vinger bestuurt de joystick?

  function volgVinger(e) {
    const r = basis.getBoundingClientRect();
    const straal = r.width / 2;
    let dx = e.clientX - (r.left + straal);
    let dy = e.clientY - (r.top + straal);
    const afstand = Math.hypot(dx, dy);
    // de duim blijft binnen de cirkel, ook als je vinger er voorbij schuift
    const maxUit = straal * 0.6;
    if (afstand > maxUit) { dx *= maxUit / afstand; dy *= maxUit / afstand; }
    duim.style.transform = `translate(${dx}px, ${dy}px)`;
    // een klein beetje uit het midden telt nog niet: anders rijdt je tank
    // al weg als je duim er alleen maar op rust
    if (afstand < straal * 0.25) { zetToetsen(new Set()); return; }
    const sector = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    zetToetsen(new Set(RICHTINGEN[sector]));
  }

  function laatLos() {
    vinger = null;
    basis.classList.remove('actief');
    duim.style.transform = '';
    zetToetsen(new Set());
  }

  basis.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (vinger !== null) return;   // al een duim erop
    vinger = e.pointerId;
    // de vinger blijft bij de joystick horen, ook als hij eroverheen schuift
    try { basis.setPointerCapture(e.pointerId); } catch { /* oudere browser */ }
    basis.classList.add('actief');
    volgVinger(e);
  });
  basis.addEventListener('pointermove', (e) => { if (e.pointerId === vinger) volgVinger(e); });
  basis.addEventListener('pointerup', (e) => { if (e.pointerId === vinger) laatLos(); });
  basis.addEventListener('pointercancel', (e) => { if (e.pointerId === vinger) laatLos(); });
  basis.addEventListener('lostpointercapture', (e) => { if (e.pointerId === vinger) laatLos(); });
  // venster kwijt (app gewisseld, scherm op slot): dan alles los
  window.addEventListener('blur', laatLos);

  /* ---------------- de spatiebalk ----------------
   * Voor "wanneer toets [spatiebalk] wordt ingedrukt" (de proef van stap 6).
   * Een tik duurt soms korter dan één tik van het programma (1/30 sec). Dan
   * zou het programma de spatie nooit zien; we houden hem dus minstens een
   * tiende van een seconde ingedrukt.
   */
  let spatieSinds = 0;
  let spatieVinger = null;
  spatie.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    spatieVinger = e.pointerId;
    try { spatie.setPointerCapture(e.pointerId); } catch { /* oudere browser */ }
    spatieSinds = Date.now();
    window.runtime.toetsen.add(' ');
    spatie.classList.add('aan');
  });
  function spatieLos(e) {
    if (e && e.pointerId !== spatieVinger) return;
    spatieVinger = null;
    spatie.classList.remove('aan');
    const nogEven = Math.max(0, 100 - (Date.now() - spatieSinds));
    setTimeout(() => { if (spatieVinger === null) window.runtime.toetsen.delete(' '); }, nogEven);
  }
  spatie.addEventListener('pointerup', spatieLos);
  spatie.addEventListener('pointercancel', spatieLos);
  window.addEventListener('blur', () => spatieLos());

  /* ---------------- aan / uit ---------------- */
  function toon() {
    document.body.classList.toggle('joystick-aan', aan);
    basis.classList.toggle('verborgen', !aan);
    spatie.classList.toggle('verborgen', !aan);
    schakel.classList.toggle('actief', aan);
    if (!aan) { laatLos(); spatieLos(); }
  }
  // de knop alleen tonen waar hij zin heeft: op een toestel met aanraakscherm
  schakel.classList.toggle('verborgen', !heeftAanraakscherm && !aan);
  schakel.addEventListener('click', () => {
    aan = !aan;
    try { localStorage.setItem('tankJoystick', aan ? '1' : '0'); } catch { /* geen opslag */ }
    toon();
    if (window.toast) {
      window.toast(aan
        ? '🕹️ Joystick aan: hij drukt de pijltjestoetsen voor je in. Tik op het speelveld om te mikken en te schieten.'
        : '🕹️ Joystick uit: rijden doe je weer met de pijltjestoetsen.');
    }
  });
  toon();

  window.joystickStaatAan = () => aan;
})();
