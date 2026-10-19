/*
 * Upgrades: een nieuwe tankklasse kiezen en de statpuntenbalken.
 * Deel van het spel in de browser (spel-*.js, geladen in deze volgorde).
 */

/* ---------------- upgrade-popups ---------------- */
const popupKlasse = document.getElementById('popup-klasse');
let laatsteKlasseAanbod = '';      // welk aanbod hebben we al getoond?
let klassePopupGesloten = false;   // heeft de leerling bewust weggeklikt?

/*
 * Kaartjes zoals in diep.io: elk voorstel krijgt een eigen pastelkleur met
 * de tank erop en de naam op een bandje onderaan. Het venster blijft klein en
 * in de hoek staan, zodat je tank zichtbaar blijft en je gewoon door kan
 * rijden tot je gekozen hebt.
 */
const KAART_KLEUREN = [
  ['#7fe3dc', '#48b3ab'],  // cyaan
  ['#9ce77f', '#63b249'],  // groen
  ['#f39494', '#c26060'],  // rood
  ['#f2df90', '#c0aa55'],  // geel
  ['#b7a5f0', '#8270c2'],  // paars
  ['#f3b880', '#c1854d'],  // oranje
];

/* Hoe ver reikt deze tank echt, van zijn middelpunt tot zijn verste punt? */
const gemetenStralen = new Map();
function meetTankStraal(klasse, kleur) {
  if (gemetenStralen.has(klasse)) return gemetenStralen.get(klasse);
  const M = 200, doek = document.createElement('canvas');
  doek.width = M; doek.height = M;
  const g = doek.getContext('2d');
  g.translate(M / 2, M / 2);
  drawTank(g, {
    klasse, vorm: (KLASSEN[klasse] && KLASSEN[klasse].vorm) || 'cirkel', kleur, angle: 0, naam: '', hp: 1, maxHp: 1,
    zeg: null, flits: null, schild: false, onzichtbaar: false, alleenVorm: true,
  }, false);
  const d = g.getImageData(0, 0, M, M).data;
  let straal = 22;
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < M; x++) {
      if (d[(y * M + x) * 4 + 3] > 20) straal = Math.max(straal, Math.hypot(x - M / 2, y - M / 2));
    }
  }
  gemetenStralen.set(klasse, straal);
  return straal;
}

function toonKlassePopup(ik) {
  const lijst = document.getElementById('klasse-lijst');
  lijst.innerHTML = '';
  ik.klasseAanbod.forEach((k, i) => {
    const def = KLASSEN[k];
    const [bg, rand] = KAART_KLEUREN[i % KAART_KLEUREN.length];
    const kaart = document.createElement('button');
    kaart.className = 'klasse-kaart';
    kaart.style.setProperty('--bg', bg);
    kaart.style.setProperty('--rand', rand);

    /* De tank past zich aan het kaartje aan. We rekenen de verste hoek van elk
       kanon uit — niet alleen hoe LANG hij is, maar ook hoe breed en hoe ver
       opzij. Anders viel een Overseer (twee brede dronebays opzij) half buiten
       het kaartje, terwijl een sluipschutter juist piepklein stond. */
    const B = 74, H = 56, dpr = Math.min(2, window.devicePixelRatio || 1);
    const mini = document.createElement('canvas');
    mini.width = B * dpr; mini.height = H * dpr;
    mini.style.width = B + 'px'; mini.style.height = H + 'px';
    /* Uitrekenen hoe groot een tank wórdt is lastig: een dronebay waaiert open,
       een valstrikwerper heeft een trechter, een trapezium loopt taps. Daarom
       tekenen we hem eerst één keer op een kladdoek, meten we op hoe ver hij
       werkelijk reikt, en pas dán tekenen we hem passend op het kaartje. */
    const schaal = Math.min(0.95, (Math.min(B, H) / 2 - 3) / meetTankStraal(k, ik.kleur));
    const g = mini.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(B / 2, H / 2);
    /* De Sluiper ziet er precies uit als de Sluipschutter — in diep.io is dat
       ook zo, want het verschil zit in zijn kunstje: hij wordt onzichtbaar als
       hij stilstaat. Op het kaartje tonen we hem daarom half doorschijnend,
       anders kiest een leerling tussen twee identieke plaatjes. */
    if (def && def.sluip) g.globalAlpha = 0.45;
    g.scale(schaal, schaal);
    drawTank(g, {
      // de Necromancer heeft een vierkante romp: die hoort ook op zijn kaartje
      klasse: k, vorm: (def && def.vorm) || 'cirkel', kleur: ik.kleur, angle: Math.PI * 0.75, naam: '',
      hp: 1, maxHp: 1, zeg: null, flits: null, schild: false, onzichtbaar: false,
      alleenVorm: true,
    }, false);

    const label = document.createElement('span');
    label.className = 'kl-naam';
    label.textContent = def ? def.naam : k;
    /* Zie je met deze klasse verder? Dat is in diep.io het grote voordeel van
       de sluipschuttertak, dus zeg het erbij. */
    if (def && def.zicht > 1) label.title = 'je ziet ' + Math.round((def.zicht - 1) * 100) + '% meer van het speelveld';
    kaart.appendChild(mini);
    kaart.appendChild(label);
    if (def && def.zicht > 1) {
      const oog = document.createElement('span');
      oog.className = 'kl-zicht';
      oog.textContent = '🔭';
      oog.title = label.title;
      kaart.appendChild(oog);
    }
    kaart.addEventListener('click', () => {
      socket.emit('kiesKlasse', { klasse: k });
      popupKlasse.classList.add('verborgen');
      toast(`Je bent nu een ${def ? def.naam : k}! 🎉`
        + (def && def.zicht > 1 ? ' 🔭 Je ziet nu verder!' : ''));
    });
    lijst.appendChild(kaart);
  });
  popupKlasse.classList.remove('verborgen');
}
document.getElementById('klasse-sluit').addEventListener('click', () => {
  popupKlasse.classList.add('verborgen');
  klassePopupGesloten = true;   // niet meteen opnieuw openklappen
});

/* De 8 eigenschappen zoals diep.io — sleutels moeten matchen met de server. */
const STAT_META = {
  levensregen: ['🩹', 'Levensregen'],
  maxlevens: ['❤️', 'Max levens'],
  botsschade: ['💢', 'Botsschade'],
  /* Let op de ️-tekens achter 🛡 en 🏎: zonder dat variatieteken tekent Windows
     ze als smalle zwart-wit-lettertekens tussen de kleuremoji — dat viel op als
     dun lijnwerk in het rijtje. Voor "Herladen" stond hier een pistool, dat op
     Windows als groen waterpistooltje verscheen; ronddraaiende pijlen passen
     ook gewoon beter bij herladen. */
  kogelpantser: ['🛡️', 'Kogelpantser'],
  kogelschade: ['💥', 'Kogelschade'],
  kogelsnelheid: ['🚀', 'Kogelsnelheid'],
  herladen: ['🔄', 'Herladen'],
  snelheid: ['🏎️', 'Snelheid'],
};
/*
 * Kies je een dronetank of een valstrikker, dan gaan je punten niet meer over
 * kógels. In diep.io heten die drie balkjes dan ook anders: Drone Damage,
 * Drone Speed en Drone Health. Wij doen hetzelfde — anders zit een leerling
 * punten in "kogelschade" te steken terwijl hij geen enkele kogel schiet.
 * (https://diepio.fandom.com/wiki/Overseer)
 */
const STAT_NAAM_PER_MUNITIE = {
  drone: { kogelschade: ['💥', 'Droneschade'], kogelsnelheid: ['🚀', 'Dronesnelheid'], kogelpantser: ['🛡️', 'Dronelevens'] },
  trap: { kogelschade: ['💥', 'Valstrikschade'], kogelsnelheid: ['🚀', 'Werpafstand'], kogelpantser: ['🛡️', 'Valstriklevens'] },
  raket: { kogelschade: ['💥', 'Raketschade'], kogelsnelheid: ['🚀', 'Raketsnelheid'], kogelpantser: ['🛡️', 'Raketpantser'] },
};

/* Welk label hoort er bij deze stat, voor de klasse die je nú bent? */
function statLabel(stat) {
  const ik = spel.mijnTank();
  const kl = ik && KLASSEN[ik.klasse];
  const per = kl && STAT_NAAM_PER_MUNITIE[kl.munitie];
  return (per && per[stat]) || STAT_META[stat] || ['•', stat];
}

function statMaxVan() {
  const ik = spel.mijnTank();          // Smashers mogen 10 punten per stat
  return (ik && ik.statMax) || (staat && staat.statMax) || 7;
}
function statVolgorde() { return (staat && staat.statLijst) || Object.keys(STAT_META); }

/* Een balkje zoals in diep.io: ▰▰▰▱▱▱▱  3/7 */
function statBalk(waarde, max) {
  return '▰'.repeat(waarde) + '▱'.repeat(Math.max(0, max - waarde)) + ` ${waarde}/${max}`;
}

/* Cijfertoetsen [1]..[8] upgraden meteen de bijhorende eigenschap (zoals diep.io). */
window.addEventListener('keydown', (e) => {
  if (!mijnId) return;
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const n = parseInt(e.key, 10);
  if (!(n >= 1 && n <= 8)) return;
  const ik = spel.mijnTank();
  const stat = statVolgorde()[n - 1];
  if (!ik || !stat) return;
  if (ik.statPunten <= 0) { toast('Geen statpunten over — verdien eerst meer punten! 🏆'); return; }
  if ((ik.stats[stat] || 0) >= statMaxVan()) { toast(`${statLabel(stat)[1]} is al maximaal! ⭐`); return; }
  socket.emit('kiesStat', { stat });
  const [, label] = statLabel(stat);
  toast(`⬆️ ${label} verbeterd! (toets ${n})`);
});

/* ---------------- upgradebalken linksonder (zoals diep.io) ----------------
 * Acht balkjes die gewoon in beeld blijven staan. Elke stat heeft zijn eigen
 * kleur: het gevulde stuk laat zien hoeveel punten er al in zitten, en het
 * plusje wordt kleurig zodra je iets te besteden hebt. Vroeger klapte hier een
 * apart venster open; dat onderbrak het spel terwijl je in diep.io gewoon
 * doorspeelt en tussendoor op een plusje tikt.
 */
const STAT_KLEUR = {
  levensregen: '#f0a17f',
  maxlevens: '#e07fd2',
  botsschade: '#a58ce8',
  kogelsnelheid: '#7f92ef',
  kogelpantser: '#7fcdef',
  kogelschade: '#f2716e',
  herladen: '#86dd7f',
  snelheid: '#6fded2',
};

function bouwStatBalken() {
  const el = document.getElementById('stat-balken');
  if (el.dataset.gebouwd === '1') return;
  el.dataset.gebouwd = '1';
  el.innerHTML = '';
  statVolgorde().forEach((stat, i) => {
    const [icoon, label] = statLabel(stat);
    const rij = document.createElement('div');
    rij.className = 'stat-balk-rij';
    rij.dataset.stat = stat;
    rij.dataset.toets = i + 1;
    rij.style.setProperty('--kleur', STAT_KLEUR[stat] || '#9aa4b8');
    rij.innerHTML =
      '<div class="sb-balk"><span class="sb-vul"></span>'
      + '<span class="sb-tekst">' + icoon + ' ' + label
      + ' <b class="sb-toets">[' + (i + 1) + ']</b></span></div>';
    const knop = document.createElement('button');
    knop.className = 'sb-plus';
    knop.textContent = '+';
    knop.title = label + ' verbeteren (toets ' + (i + 1) + ')';
    /* De knoppen worden één keer gemaakt en daarna alleen bijgewerkt. Zouden we
       ze 30x/s opnieuw opbouwen, dan liep een muisklik halverwege stuk. */
    knop.addEventListener('click', () => socket.emit('kiesStat', { stat }));
    rij.appendChild(knop);
    el.appendChild(rij);
  });
}

/*
 * De statpuntenbalk hoort bij het SPEL. Tijdens de eerste stappen van de les
 * leidt hij af: zodra een leerling bij stap 6 leert schieten, gaan de levels
 * omhoog en zit hij punten te verdelen in plaats van te programmeren. De balk
 * verschijnt daarom pas bij stap 14 — de stap die er juist over gaat — of
 * meteen zodra je de gedeelde arena in gaat om te spelen. Eenmaal zichtbaar
 * blijft hij staan, ook als je terugbladert.
 */
let statsOntgrendeld = false;
function statpuntenMogenZichtbaar() {
  if (statsOntgrendeld) return true;
  const stap = stappen()[stapIndex];
  if (modus === 'samen' || welkeLes === 2 || (stap && stap.nr >= 14)) statsOntgrendeld = true;
  return statsOntgrendeld;
}

function vernieuwStatOverzicht(ik) {
  const el = document.getElementById('stat-balken');
  if (!ik || !ik.stats || !statpuntenMogenZichtbaar()) { el.classList.add('verborgen'); return; }
  bouwStatBalken();
  el.classList.remove('verborgen');
  const max = statMaxVan();
  const kan = ik.statPunten > 0;
  el.classList.toggle('heeft-punten', kan);
  el.querySelectorAll('.stat-balk-rij').forEach((rij, i) => {
    const stat = statVolgorde()[i];
    /* Van klasse gewisseld? Dan kunnen de namen veranderd zijn (kogel -> drone). */
    const [icoon, label] = statLabel(stat);
    const tekst = rij.querySelector('.sb-tekst');
    const nieuw = `${icoon} ${label} <b class="sb-toets">[${i + 1}]</b>`;
    if (tekst && tekst.innerHTML !== nieuw) tekst.innerHTML = nieuw;
    const nu = ik.stats[stat] || 0;
    const vol = nu >= max;
    rij.querySelector('.sb-vul').style.width = Math.round((nu / max) * 100) + '%';
    rij.classList.toggle('vol', vol);
    rij.classList.toggle('kan', kan && !vol);
    rij.querySelector('.sb-plus').disabled = !kan || vol;
  });
}

/* Het "toon upgradescherm"-blok: een nieuwe klasse kiezen gebeurt nog in een
   venster, maar statpunten wijzen we gewoon aan in de balk linksonder. */
function wijsStatBalkenAan() {
  const el = document.getElementById('stat-balken');
  el.classList.add('let-op');
  setTimeout(() => el.classList.remove('let-op'), 2400);
}
