/*
 * TWEE JOYSTICKS VOOR TABLETS
 *
 * Op een iPad is er geen toetsenbord en geen muis. Daarom staan er twee
 * joysticks op het speelveld, zoals in de diep.io-app:
 *
 *  - LINKS rijden. Deze joystick drukt de pijltjestoetsen voor je in: duw je
 *    hem omhoog, dan is voor het spel "pijltje omhoog" ingedrukt — precies
 *    alsof je op een toetsenbord zit. Schuin duwen drukt twee pijltjes
 *    tegelijk in. De pijltjes rond de joystick lichten op, zodat je ziet wélke
 *    toets je op dat moment indrukt.
 *  - RECHTS mikken en schieten. Deze joystick is "de muis": het mikpunt ligt
 *    in de richting waarin je hem duwt (hoe verder, hoe verder weg), en zolang
 *    je duwt is "muis ingedrukt?" waar. Laat je los, dan blijft het geschut die
 *    kant op wijzen.
 *
 * Daardoor werken alle blokken uit de les ongewijzigd ("als toets pijltje
 * omhoog ingedrukt?", "richt het geschut naar de muis", "muis ingedrukt?"),
 * en bouwt een kind op een iPad exact hetzelfde programma als zijn buur op een
 * chromebook. Zonder eigen sturing doen de joysticks dus ook niets — net zoals
 * de toetsen en de muis niets doen zolang je die blokken nog niet gebouwd hebt.
 *
 * Tikken op het speelveld blijft ook werken als muis; dat neemt het dan over.
 */
(function () {
  const rijStok = document.getElementById('joystick');
  const rijDuim = document.getElementById('joystick-duim');
  const richtStok = document.getElementById('richtstok');
  const richtDuim = document.getElementById('richtstok-duim');
  const spatie = document.getElementById('spatie-knop');
  const schakel = document.getElementById('joystick-schakel');
  if (!rijStok || !rijDuim || !richtStok || !richtDuim || !spatie || !schakel) return;

  /* Wanneer staan ze aan? Vanzelf als het toestel vooral met een vinger
     bediend wordt (iPad, tablet). Een chromebook met aanraakscherm heeft ook
     een touchpad en een toetsenbord: daar staan ze uit, maar mag je ze met
     de 🕹️-knop aanzetten. Die keuze onthoudt het toestel. */
  const heeftAanraakscherm = (navigator.maxTouchPoints || 0) > 0;
  const vooralVinger = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  let aan = vooralVinger;
  try {
    const bewaard = localStorage.getItem('tankJoystick');
    if (bewaard !== null) aan = bewaard === '1';
  } catch { /* geen opslag: dan de automatische keuze */ }

  /*
   * Eén joystick: houdt bij welke vinger hem vasthoudt, laat de duim
   * meebewegen (binnen de cirkel) en meldt richting en kracht. Een klein
   * beetje uit het midden telt nog niet: anders reageert hij al als je duim
   * er alleen maar op rust.
   */
  function maakStok(basis, duim, { beweeg, los }) {
    let vinger = null;
    function volg(e) {
      const r = basis.getBoundingClientRect();
      const straal = r.width / 2;
      let dx = e.clientX - (r.left + straal);
      let dy = e.clientY - (r.top + straal);
      const afstand = Math.hypot(dx, dy);
      // de duim blijft binnen de cirkel, ook als je vinger er voorbij schuift
      const maxUit = straal * 0.6;
      const kracht = Math.min(1, afstand / maxUit);
      if (afstand > maxUit) { dx *= maxUit / afstand; dy *= maxUit / afstand; }
      duim.style.transform = `translate(${dx}px, ${dy}px)`;
      if (afstand < straal * 0.25) beweeg(null);
      else beweeg({ x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy), kracht });
    }
    function laatLos() {
      if (vinger === null) return;
      vinger = null;
      basis.classList.remove('actief');
      duim.style.transform = '';
      los();
    }
    basis.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (vinger !== null) return;   // er rust al een duim op
      vinger = e.pointerId;
      // de vinger blijft bij deze joystick horen, ook als hij eroverheen schuift
      try { basis.setPointerCapture(e.pointerId); } catch { /* oudere browser */ }
      basis.classList.add('actief');
      volg(e);
    });
    basis.addEventListener('pointermove', (e) => { if (e.pointerId === vinger) volg(e); });
    for (const soort of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      basis.addEventListener(soort, (e) => { if (e.pointerId === vinger) laatLos(); });
    }
    // venster kwijt (app gewisseld, scherm op slot): dan alles los
    window.addEventListener('blur', laatLos);
    return { laatLos };
  }

  /* ---------------- links: rijden (de pijltjestoetsen) ---------------- */
  const ingedrukt = new Set();   // welke toetsen de joystick nú indrukt
  const pijlen = [...rijStok.querySelectorAll('.js-pijl')];

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

  const rijden = maakStok(rijStok, rijDuim, {
    beweeg(r) {
      if (!r) { zetToetsen(new Set()); return; }
      const sector = ((Math.round(Math.atan2(r.y, r.x) / (Math.PI / 4)) % 8) + 8) % 8;
      zetToetsen(new Set(RICHTINGEN[sector]));
    },
    los() { zetToetsen(new Set()); },
  });

  /* ---------------- rechts: mikken en schieten (de muis) ----------------
   * Het mikpunt ligt tussen 100 en 600 pixels van je tank, naargelang hoe ver
   * je de joystick duwt. Voor het geschut maakt dat niets uit (de richting is
   * dezelfde), maar drones van een Opzichter of Overheer vliegen naar dat punt:
   * zo kan je ook met een vinger bepalen hoe ver ze gaan.
   */
  const MIK_DICHTBIJ = 100, MIK_VER = 600;
  let laatsteRichting = null;
  const mikken = maakStok(richtStok, richtDuim, {
    beweeg(r) {
      if (!r) {
        // terug in het midden: niet meer schieten, wel dezelfde kant op blijven wijzen
        if (laatsteRichting) window.spel.zetRichtStok(Object.assign({}, laatsteRichting, { vuurt: false }));
        return;
      }
      laatsteRichting = { x: r.x, y: r.y, afstand: MIK_DICHTBIJ + r.kracht * (MIK_VER - MIK_DICHTBIJ) };
      window.spel.zetRichtStok(Object.assign({}, laatsteRichting, { vuurt: true }));
    },
    los() {
      if (laatsteRichting) window.spel.zetRichtStok(Object.assign({}, laatsteRichting, { vuurt: false }));
    },
  });

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
    if (spatieVinger === null && !spatie.classList.contains('aan')) return;
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
    for (const el of [rijStok, richtStok, spatie]) el.classList.toggle('verborgen', !aan);
    schakel.classList.toggle('actief', aan);
    // de minikaart moet weten of ze boven de richtjoystick hoort
    if (window.spel && window.spel.meetRichtstokOpnieuw) window.spel.meetRichtstokOpnieuw();
    if (!aan) {
      rijden.laatLos();
      mikken.laatLos();
      spatieLos();
      // de muis neemt het weer over
      laatsteRichting = null;
      if (window.spel && window.spel.zetRichtStok) window.spel.zetRichtStok(null);
    }
  }
  // de knop alleen tonen waar hij zin heeft: op een toestel met aanraakscherm
  schakel.classList.toggle('verborgen', !heeftAanraakscherm && !aan);
  schakel.addEventListener('click', () => {
    aan = !aan;
    try { localStorage.setItem('tankJoystick', aan ? '1' : '0'); } catch { /* geen opslag */ }
    toon();
    if (window.toast) {
      window.toast(aan
        ? '🕹️ Joysticks aan: links rijden, rechts mikken en schieten.'
        : '🕹️ Joysticks uit: rijden doe je weer met de pijltjestoetsen, mikken met de muis.');
    }
  });
  toon();

  window.joystickStaatAan = () => aan;
})();
