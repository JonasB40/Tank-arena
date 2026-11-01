/*
 * TOESTELTEST: vóór de les nagaan of een toestel (vooral een iPad) klaar is.
 * Te openen via het startmenu → meer opties → 🔧 Test dit toestel, of met
 * ?toesteltest achter het adres.
 *
 * Een deel kijkt het vanzelf na: de schermmaat, aanraakscherm, de verbinding
 * met de server, volledig scherm, voorlezen en geluid. Twee dingen kan alleen
 * een echte vinger testen, en precies die liepen op de iPads mis:
 *  1. een getal typen in een vakje dat even klein is als dat in een blok —
 *     zoomt Safari dan de pagina in?
 *  2. knijpen met twee vingers — zoomt dat de pagina in?
 * Zoomt de pagina tijdens de test, dan zien we dat aan visualViewport.scale.
 */
(function () {
  const vak = document.getElementById('toesteltest');
  const lijst = document.getElementById('tt-lijst');
  const besluit = document.getElementById('tt-besluit');
  const vv = window.visualViewport;
  let regels = [];
  let proefTypen = null;    // null = nog niet gedaan, true = goed, false = ingezoomd
  let proefKnijpen = null;
  let hoogsteZoom = 1;

  const isIpad = /iPad/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS doet zich voor als een Mac
  const aanraak = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;

  function regel(sleutel, ok, tekst, extra) {
    const r = { sleutel, ok, tekst, extra: extra || '' };
    const i = regels.findIndex((x) => x.sleutel === sleutel);
    if (i >= 0) regels[i] = r; else regels.push(r);
    teken();
  }

  function teken() {
    const icoon = (ok) => (ok === true ? '✅' : ok === false ? '❌' : ok === 'let' ? '⚠️' : '⏳');
    lijst.innerHTML = regels.map((r) => `<li>${icoon(r.ok)} ${r.tekst}${r.extra}</li>`).join('');
    const fout = regels.filter((r) => r.ok === false);
    const open = proefTypen === null || proefKnijpen === null;
    besluit.className = fout.length ? 'fout' : open ? '' : 'goed';
    besluit.textContent = fout.length
      ? `Let op: ${fout.length === 1 ? 'één punt' : fout.length + ' punten'} met ❌ — zie hierboven.`
      : open ? 'Doe nog de twee proefjes hieronder.' : '✅ Dit toestel is klaar voor de les.';
  }

  function scherm() {
    const b = window.innerWidth, h = window.innerHeight;
    const liggend = b > h;
    const indeling = b <= 600 ? 'telefoon: alles onder elkaar, de pagina scrolt'
      : b <= 900 ? 'rechtop: blokken boven, speelveld onder'
        : 'blokken links, speelveld rechts';
    regel('scherm', b >= 600 ? true : 'let',
      `Scherm: ${b}×${h} ${liggend ? '(liggend)' : '(rechtop)'} → ${indeling}`,
      b < 600 ? ' — klein; een iPad of chromebook werkt beter' : '');
  }

  function start() {
    regels = [];
    proefTypen = null;
    proefKnijpen = null;
    hoogsteZoom = vv ? vv.scale : 1;
    vak.classList.remove('verborgen');
    document.getElementById('tt-getal').value = '10';

    regel('toestel', true, `Toestel: ${isIpad ? 'iPad' : aanraak ? 'met aanraakscherm' : 'met muis en toetsenbord'}`
      + `${isIpad ? ' (Safari)' : ''}`);
    scherm();
    regel('aanraak', true, aanraak
      ? 'Aanraakscherm: ja → de joysticks verschijnen vanzelf op het speelveld'
      : 'Aanraakscherm: nee → rijden met de pijltjes, mikken met de muis');
    regel('zoom', !vv || vv.scale <= 1.01, vv && vv.scale > 1.01
      ? `De pagina staat nu ingezoomd (${vv.scale.toFixed(2)}×) — tik op 🔍 Zoom in het werkblad`
      : 'De pagina staat op ware grootte');

    // verbinding: hoe snel antwoordt de server?
    regel('server', null, 'Verbinding met de server: meten…');
    const t0 = performance.now();
    fetch('/info', { cache: 'no-store' })
      .then((r) => r.json())
      .then(() => {
        const ms = Math.round(performance.now() - t0);
        regel('server', ms < 400 ? true : 'let', `Verbinding met de server: ${ms} ms${ms < 400 ? '' : ' — traag; staat de wifi goed?'}`);
      })
      .catch(() => regel('server', false, 'Verbinding met de server: geen antwoord — zit dit toestel op hetzelfde wifi?'));

    const vol = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    regel('vol', vol ? true : 'let', vol ? 'Volledig scherm (⛶): kan'
      : 'Volledig scherm (⛶): kan hier niet — het speelveld wordt wel groot, maar de browserbalk blijft staan');

    // voorlezen: is er een Nederlandse stem?
    const spraak = window.speechSynthesis;
    const zoekStem = () => {
      const stemmen = spraak ? spraak.getVoices() : [];
      const nl = stemmen.find((v) => /^nl[-_]BE/i.test(v.lang)) || stemmen.find((v) => /^nl/i.test(v.lang));
      if (!spraak) regel('spraak', 'let', 'Voorlezen (🔊): niet beschikbaar in deze browser');
      else if (nl) regel('spraak', true, `Voorlezen (🔊): Nederlandse stem "${nl.name}"`, ' <button class="tt-knop" data-tt="spraak">▶ test</button>');
      else regel('spraak', stemmen.length ? 'let' : null, stemmen.length
        ? 'Voorlezen (🔊): geen Nederlandse stem gevonden — installeer er een in de instellingen (Toegankelijkheid → Gesproken materiaal → Stemmen)'
        : 'Voorlezen (🔊): stemmen laden…', ' <button class="tt-knop" data-tt="spraak">▶ test</button>');
    };
    zoekStem();
    if (spraak) setTimeout(zoekStem, 1200);

    regel('geluid', window.AudioContext || window.webkitAudioContext ? true : 'let',
      'Geluid: hoor je een piepje?', ' <button class="tt-knop" data-tt="geluid">▶ test</button>');

    regel('typen', null, 'Proef 1 — een getal typen: nog niet gedaan');
    regel('knijpen', null, 'Proef 2 — knijpen met twee vingers: nog niet gedaan');
  }

  /* ---------- de twee proefjes ---------- */
  // Proef 1: het vakje is even klein als een getal in een blok (11 px)
  const getal = document.getElementById('tt-getal');
  getal.addEventListener('focus', () => {
    setTimeout(() => {
      const ingezoomd = vv && vv.scale > 1.01;
      proefTypen = !ingezoomd;
      regel('typen', proefTypen, proefTypen
        ? 'Proef 1 — een getal typen: de pagina zoomde niet in ✓'
        : `Proef 1 — een getal typen: Safari zoomde de pagina in (${vv.scale.toFixed(2)}×). Ververs de pagina (de nieuwste versie voorkomt dit) of tik op 🔍 Zoom.`);
    }, 700);
  });
  // Proef 2: knijpen. We houden de hoogste zoom bij zolang de test openstaat.
  const knijp = document.getElementById('tt-knijp');
  let vingers = 0;
  knijp.addEventListener('touchstart', (e) => { vingers = Math.max(vingers, e.touches.length); }, { passive: true });
  knijp.addEventListener('touchend', () => {
    if (vingers < 2) return;   // dat was geen knijpbeweging
    setTimeout(() => {
      proefKnijpen = hoogsteZoom <= 1.01;
      regel('knijpen', proefKnijpen, proefKnijpen
        ? 'Proef 2 — knijpen met twee vingers: de pagina bleef op ware grootte ✓'
        : `Proef 2 — knijpen: de pagina zoomde in (${hoogsteZoom.toFixed(2)}×). Tik op 🔍 Zoom om terug te gaan.`);
      vingers = 0;
    }, 400);
  });
  // geen aanraakscherm? dan valt er niets te knijpen
  knijp.addEventListener('click', () => {
    if (aanraak) return;
    proefKnijpen = true;
    regel('knijpen', true, 'Proef 2 — knijpen: niet nodig op een toestel zonder aanraakscherm');
  });
  if (vv) vv.addEventListener('resize', () => { if (!vak.classList.contains('verborgen')) hoogsteZoom = Math.max(hoogsteZoom, vv.scale); });
  window.addEventListener('resize', () => { if (!vak.classList.contains('verborgen')) scherm(); });

  lijst.addEventListener('click', (e) => {
    const k = e.target.closest('[data-tt]');
    if (!k) return;
    if (k.dataset.tt === 'geluid') {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 660; g.gain.value = 0.08;
        o.connect(g); g.connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.25);
      } catch { /* geen geluid */ }
    } else if (k.dataset.tt === 'spraak' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance('Hallo! Ik lees de opdracht voor.');
      const stemmen = speechSynthesis.getVoices();
      const nl = stemmen.find((v) => /^nl[-_]BE/i.test(v.lang)) || stemmen.find((v) => /^nl/i.test(v.lang));
      u.lang = nl ? nl.lang : 'nl-BE';
      if (nl) u.voice = nl;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  });

  document.getElementById('tt-sluit').addEventListener('click', () => {
    vak.classList.add('verborgen');
    getal.blur();
  });
  document.getElementById('toesteltest-knop').addEventListener('click', start);
  if (/[?&]toesteltest\b/.test(location.search)) start();
})();
