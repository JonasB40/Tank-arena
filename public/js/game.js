/*
 * Het podium: verbindt de blokjes-runtime met de server en tekent het spel.
 * Uitvoer! Hier zie je wat je programma doet: de tank beweegt, de score
 * stijgt, vormen gaan kapot.
 */
const socket = io();

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const podium = document.getElementById('podium-canvas');

let mijnId = null;
let staat = null;
let arena = { w: 1600, h: 1000 };
let camera = { x: 800, y: 500 };
let tekenOffset = { x: 0, y: 0 };
/*
 * We tekenen de wereld iets uitgezoomd. Op ware grootte zag een leerling maar
 * een klein vierkantje van de arena — je reed voortdurend blind een vijand of
 * een muur tegen het lijf, en in de gedeelde arena voelde de wereld daardoor
 * benauwd. Met deze factor zie je bijna de helft meer omgeving, terwijl je
 * eigen tank nog ruim groot genoeg blijft. In diep.io zie je nog véél meer,
 * maar dan worden de tanks op ons kleine podium onherkenbaar.
 */
const ZOOM = 0.72;
/*
 * Niet elke tank ziet even ver. In diep.io kijkt de sluipschuttertak verder
 * dan de rest — daarom kan een Assassin je van buiten je eigen beeld
 * neerschieten. zichtVan() (in klassen.js) rekent klasse + level om tot één
 * factor; hier schuift de camera er langzaam naartoe zodat het beeld bij een
 * upgrade niet plots wegspringt maar mooi uitzoomt.
 */
let zoom = ZOOM;          // wat je nu ziet
let zoomDoel = ZOOM;      // waar we naartoe glijden
let gemeldZicht = { w: 0, h: 0 };   // wat we de server al verteld hebben
let modus = null;

/* ---------------- API voor de blokjes-runtime ---------------- */
const spel = {
  muisScherm: { x: 0, y: 0 },
  muisWereld: { x: 0, y: 0 },
  muisKnop: false,
  mijnTank() {
    if (!staat || !mijnId) return null;
    return staat.tanks.find((t) => t.id === mijnId) || null;
  },
  /* We sturen ook waar de muis in de wereld staat. Drones (Opzichter/Overheer)
     vliegen daar naartoe zodra je klikt — in diep.io verzamelen ze zich precies
     op je cursor, niet ergens ver in die richting. */
  stuurIntent(i) {
    if (!mijnId) return;
    i.tx = Math.round(spel.muisWereld.x);
    i.ty = Math.round(spel.muisWereld.y);
    socket.emit('intent', i);
  },
  stuurActie(a) { socket.emit('actie', a); },
  kiesStat(stat) { if (mijnId) socket.emit('kiesStat', { stat }); },
  afstandVijand() {
    const v = spel.dichtstbijVijand();
    if (!v) return 9999;
    const ik = spel.mijnTank();
    return Math.round(Math.hypot(v.x - ik.x, v.y - ik.y));
  },
  /* Dichtstbijzijnde vijandelijke tank (voor richten/waarnemen). */
  dichtstbijVijand() {
    const ik = spel.mijnTank();
    if (!ik || !staat) return null;
    let beste = null, besteD = Infinity;
    for (const t of staat.tanks) {
      if (t.id === mijnId || t.dood) continue;
      if (t.team !== null && t.team === ik.team) continue; // teamgenoten niet
      const d = Math.hypot(t.x - ik.x, t.y - ik.y);
      if (d < besteD) { besteD = d; beste = t; }
    }
    return beste;
  },
  /* Dichtstbijzijnde vorm; met alleenMuur=true enkel muren. */
  dichtstbijVorm(alleenMuur) {
    const ik = spel.mijnTank();
    if (!ik || !staat) return null;
    let beste = null, besteD = Infinity;
    for (const v of staat.vormen) {
      const isMuur = v.type === 'muur';
      if (alleenMuur ? !isMuur : isMuur) continue;
      const d = Math.hypot(v.x - ik.x, v.y - ik.y) - v.r;
      if (d < besteD) { besteD = d; beste = v; }
    }
    return beste;
  },
  /* "raak ik ...?" — bijna-aanraking (binnen een paar pixels). */
  raakIk(wat) {
    const ik = spel.mijnTank();
    if (!ik || !staat) return false;
    const RAAK = 34; // tankstraal + kleine marge
    if (wat === 'rand') {
      return ik.x < RAAK || ik.y < RAAK || ik.x > arena.w - RAAK || ik.y > arena.h - RAAK;
    }
    if (wat === 'vijand') {
      const v = spel.dichtstbijVijand();
      return !!v && Math.hypot(v.x - ik.x, v.y - ik.y) < RAAK + 22;
    }
    const vorm = spel.dichtstbijVorm(wat === 'muur');
    if (!vorm) return false;
    return Math.hypot(vorm.x - ik.x, vorm.y - ik.y) < RAAK + vorm.r;
  },
  /* "raak ik een vijandelijke kogel?" — waar zodra er een treffer binnenkwam,
     en daarna meteen weer niet waar. Zo telt elke kogel precies één keer,
     hoe vaak de herhaal-lus de vraag ook stelt. */
  geraaktDoorKogel() {
    if (!laatsteTreffer.ongelezen) return false;
    laatsteTreffer.ongelezen = false;
    return true;
  },
  /* "kracht kogel" — hoeveel schade die laatste treffer deed. Dat getal komt
     van de server en houdt dus rekening met de upgrades van de tegenstander. */
  krachtKogel() { return laatsteTreffer.schade; },
  /* De ranglijst. Robots tellen niet mee: het gaat om de spelers in de klas.
     In je eentje sta je dus gewoon eerste — dat klopt ook. */
  spelers() { return staat ? staat.tanks.filter((t) => !t.ai) : []; },
  besteScore() {
    const s = spel.spelers().map((t) => t.score);
    return s.length ? Math.max(...s) : 0;
  },
  mijnPlaats() {
    const ik = spel.mijnTank();
    if (!ik) return 0;
    return spel.spelers().filter((t) => t.score > ik.score).length + 1;
  },
  /* "max levens" — waar je levensbalk vol is (groeit met level en upgrades). */
  maxLevens() { const ik = spel.mijnTank(); return ik ? Math.round(ik.maxHp) : 0; },
  /* "verander uiterlijk naar [klasse]" — de leerling programmeert zijn eigen
     klassewissel. De server keurt het af zolang je nog geen level 15 hebt,
     dus dit blok kan niet gebruikt worden om vals te spelen. */
  wordKlasse(klasse) {
    const ik = spel.mijnTank();
    if (!ik || ik.klasse === klasse) return; // al deze vorm: niets te doen
    socket.emit('kiesKlasse', { klasse });
  },
  /* "ben ik in mijn basis?" — sta ik nu in de veilige zone?
     Solo is dat de thuisbasis in de hoek, samenspelen je eigen teamzone.
     Bewust géén blok dat je ernaartoe stuurt: rijden blijft de speler. */
  inBasis() {
    const ik = spel.mijnTank();
    if (!ik || !staat) return false;
    const inRechthoek = (z) => ik.x >= z.x && ik.x <= z.x + z.w && ik.y >= z.y && ik.y <= z.y + z.h;
    if (staat.basis && inRechthoek(staat.basis)) return true;
    const mijnZone = (staat.zones || []).find((z) => z.team === ik.team);
    return !!mijnZone && inRechthoek(mijnZone);
  },
  toonUpgrade() {
    const ik = spel.mijnTank();
    if (!ik) return;
    if (ik.klasseAanbod && ik.klasseAanbod.length) toonKlassePopup(ik);
    else if (ik.statPunten > 0) {
      wijsStatBalkenAan();
      toast(`⬆️ ${ik.statPunten} punt${ik.statPunten > 1 ? 'en' : ''} te besteden — klik op een + linksonder!`);
    } else toast('Nog niets te kiezen — verdien eerst meer punten! 🏆');
  },
};
window.spel = spel;

/* ---------------- netwerk ---------------- */
/*
 * Wat we bij het meedoen hebben meegegeven, zodat we ons na een herverbinding
 * meteen opnieuw kunnen aanmelden. Zonder dit verliest een leerling zijn tank
 * zodra de wifi even hapert of de lesgever de server herstart: zijn blokken
 * blijven staan, maar het speelveld blijft leeg tot hij terug naar het menu gaat.
 */
let laatsteJoin = null;
socket.on('connect', () => { if (laatsteJoin) socket.emit('join', laatsteJoin); });

/* De vaste eigenschappen van elke vormsoort krijgen we één keer bij binnenkomst;
   daarna stuurt de server per vorm alleen nog de plaats en de draaiing mee. */
let vormSoorten = {};
socket.on('welkom', (d) => { mijnId = d.id; arena = d.arena; vormSoorten = d.vormSoorten || {}; });
socket.on('vol', () => toast('De arena zit vol! Vraag de begeleider om hulp.'));
socket.on('state', (s) => {
  // de vaste eigenschappen er weer bij zetten, zodat de rest van de code
  // gewoon v.kleur / v.r / v.maxHp kan blijven gebruiken
  for (const v of s.vormen) {
    const info = vormSoorten[v.type];
    if (!info) continue;
    v.r = info.r; v.kleur = info.kleur; v.maxHp = info.maxHp; v.jaagt = info.jaagt;
    if (v.hp === undefined) v.hp = info.maxHp;
  }
  staat = s; arena = s.arena;
  // wisselt de lesgever van teamopstelling, dan hoort de leerling dat te zien
  if (typeof meldTeamstand === 'function') meldTeamstand();
});
const scorePopups = []; // zwevende "+10"-tekstjes
let laatsteTreffer = { schade: 0, ongelezen: false }; // laatste klap die we kregen

socket.on('ev', (ev) => {
  window.runtimeEvent(ev.type);
  if (ev.type === 'levelup') { toast(`⬆️ Level omhoog! Je hebt nu een statpunt.`); speelGeluid('tada'); }
  if (ev.type === 'geraakt') {
    speelGeluid('tik');
    // Onthouden hoe hard die treffer aankwam. De leerling vraagt dat op met
    // "raak ik een vijandelijke kogel?" en "kracht kogel". Die vraag mag maar
    // ÉÉN keer waar zijn per treffer — een herhaal-lus draait 30x per seconde
    // en zou anders zeven keer schade aftrekken van dezelfde kogel.
    // alleen échte kogels, geen aanrijdingen — het blok heet niet voor niets
    // "raak ik een vijandelijke kogel?"
    if (!ev.contact) laatsteTreffer = { schade: ev.schade || 0, ongelezen: true };
  }
  if (ev.type === 'punten') { scorePopups.push({ x: ev.x, y: ev.y, n: ev.n, start: Date.now() }); speelGeluid('plop'); }
});

/* ---------------- geluidknop ---------------- */
const geluidKnop = document.getElementById('geluid-knop');
geluidKnop.textContent = geluidStaatAan() ? '🔊' : '🔇';
geluidKnop.addEventListener('click', () => {
  zetGeluid(!geluidStaatAan());
  geluidKnop.textContent = geluidStaatAan() ? '🔊' : '🔇';
});

/* ---------------- projectopslag (autosave + code) ---------------- */
let projectCode = localStorage.getItem('tankProjectCode') || null;
let laatsteOpslag = '';

function toonProjectCode() {
  document.getElementById('project-code').textContent = projectCode ? `💾 ${projectCode}` : '';
}
toonProjectCode();

setInterval(() => {
  const naam = document.getElementById('naam').value.trim();
  if (!naam || !window.blocklyWerkruimte) return;
  const data = Blockly.serialization.workspaces.save(blocklyWerkruimte);
  const s = JSON.stringify(data);
  if (s === laatsteOpslag) return;
  socket.emit('bewaarProject', { code: projectCode, naam, werkruimte: data }, (res) => {
    if (!res || !res.code) return;
    laatsteOpslag = s;
    if (res.code !== projectCode) {
      projectCode = res.code;
      localStorage.setItem('tankProjectCode', projectCode);
      toonProjectCode();
      toast(`💾 Je project wordt automatisch bewaard! Jouw code: ${projectCode}`);
    }
  });
}, 5000);

document.getElementById('project-laad-knop').addEventListener('click', () => {
  const code = document.getElementById('project-code-invoer').value.toUpperCase().trim();
  if (!code) { document.getElementById('project-code-invoer').focus(); return; }
  socket.emit('laadProject', { code }, (res) => {
    if (!res || !res.ok) { toast('Die code ken ik niet — kijk hem goed na! 🔍'); return; }
    Blockly.serialization.workspaces.load(res.werkruimte, blocklyWerkruimte);
    document.getElementById('naam').value = res.naam;
    projectCode = code;
    localStorage.setItem('tankProjectCode', code);
    laatsteOpslag = '';
    toonProjectCode();
    toast(`📂 Project van ${res.naam} geladen! Kies nu een spelmodus.`);
  });
});
// eigen code alvast invullen als die op dit toestel bekend is
if (projectCode) document.getElementById('project-code-invoer').value = projectCode;

document.getElementById('opnieuw-knop').addEventListener('click', () => {
  if (!confirm('Alles wissen en opnieuw beginnen met het sjabloon?')) return;
  Blockly.serialization.workspaces.load(window.SJABLOON, blocklyWerkruimte);
  // ook de behaalde vinkjes wissen, anders staat alles groen bij een leeg blad
  gehaaldeStappen.clear();
  stapIndex = 0;
  // schone lei betekent ook: terug naar de blokken van stap 1
  if (window.zetLesStap) window.zetLesStap(1, true);
  toonStap();
  toast('🗑 Schone lei! Het sjabloon staat weer klaar.');
});

/* Lesgever: de volledige voorbeeldoplossing inladen (het einddoel). */
document.getElementById('voorbeeld-knop').addEventListener('click', () => {
  if (!confirm('De volledige voorbeeldoplossing laden?\n\nDit overschrijft de blokken die nu in de editor staan. Bedoeld voor de lesgever om het einddoel te tonen.\n\nLet op: in dit voorbeeld zit een automatisch upgrade-plan (opdrachtkaart 6). Je statpunten worden dan meteen door het programma uitgegeven, dus je kan ze niet meer zelf kiezen. Wil je zelf upgraden, gooi dan het ⚡-stapeltje weg.')) return;
  Blockly.serialization.workspaces.load(window.VOORBEELD_OPLOSSING, blocklyWerkruimte);
  // het einddoel gebruikt blokken van álle stappen: die horen dan ook in de lade
  if (window.zetLesStap) window.zetLesStap(stappen()[stappen().length - 1].nr);
  toast('👩‍🏫 Voorbeeldoplossing geladen — let op: het ⚡-stapeltje geeft je statpunten automatisch uit.');
});

/* ---------------- startmenu ---------------- */
const startmenu = document.getElementById('startmenu');
let gekozenNiveau = 'makkelijk';
document.querySelectorAll('.niveau-knop').forEach((k) => k.addEventListener('click', () => {
  gekozenNiveau = k.dataset.niveau;
  document.querySelectorAll('.niveau-knop').forEach((x) => x.classList.remove('actief'));
  k.classList.add('actief');
}));
// Les 2 speelt per definitie samen; de startknop volgt dus de leskeuze.
/*
 * De hoofdknop start ALTIJD les 1 tegen de computer — dat is ook wat er op
 * staat. Zonder deze terugzet bleef je in les 2 hangen zodra je die ooit had
 * gekozen: je ging terug naar het menu, drukte op "Start de les" en belandde
 * opnieuw in de gedeelde arena met de stappen van les 2.
 */
function startLes1() {
  if (welkeLes !== 1) {
    welkeLes = 1;
    stapIndex = 0;
    gehaaldeStappen.clear();
    window.runtime.basisBesturing = false;   // in les 1 programmeer je je besturing zelf
    if (window.zetLesStap) window.zetLesStap(1, true);
  }
  kiesModus('solo');
}
document.getElementById('kies-computer').addEventListener('click', startLes1);
// Enter in het naamveld start meteen — één handeling minder
document.getElementById('naam').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); startLes1(); }
});
document.getElementById('meer-opties-knop').addEventListener('click', () => {
  const paneel = document.getElementById('meer-opties');
  const open = paneel.classList.toggle('verborgen');
  document.getElementById('meer-opties-knop').textContent = open ? 'meer opties ▾' : 'minder opties ▴';
  if (!open) vernieuwSamenKnop();   // bij het openen opnieuw kijken of de tank rijdt
});
document.getElementById('kies-klasgenoten').addEventListener('click', () => { welkeLes = 1; kiesModus('samen'); });

/*
 * Twee teamopstellingen zoals in diep.io: 2 teams (links tegen rechts) en
 * 4 teams (vier hoeken). De lesgever blijft baas — hij zet de opstelling aan
 * op de beamer. Deze knoppen brengen je naar de gedeelde arena en vertellen
 * eerlijk wat er op dit moment aanstaat, zodat je niet zit te wachten zonder
 * te weten waarop. Zodra de lesgever omschakelt, zie je het vanzelf.
 */
let gewensteTeams = 0;

/*
 * Les 2 starten, eventueel meteen met een teamopstelling. De teamkeuze zit in
 * de startknop zelf: zo is er één plek waar je "samen spelen" kiest en beland
 * je nooit in een arena zonder te weten welke opstelling er aanstaat.
 */
function startLes2(teams) {
  welkeLes = 2;
  stapIndex = 0;
  gehaaldeStappen.clear();
  /* In les 2 kan je meteen rijden, mikken en schieten zonder daar blokken voor
     te hebben: dat heb je in les 1 al geleerd, en hier gaat het over tactiek.
     Je werkblad blijft dus leeg voor de nieuwe opdrachten. */
  window.runtime.basisBesturing = true;
  // les 2 bouwt verder op alles van les 1: die blokken staan dus al klaar
  if (window.zetLesStap) window.zetLesStap(17, true);
  gewensteTeams = teams || 0;
  kiesModus('samen');
  if (teams) { socket.emit('kiesTeams', teams); meldTeamstand(); }
}
document.getElementById('kies-les2').addEventListener('click', () => startLes2(0));
document.getElementById('kies-teams2').addEventListener('click', () => startLes2(2));
document.getElementById('kies-teams4').addEventListener('click', () => startLes2(4));

/*
 * "Tegen klasgenoten" (vrij spel binnen les 1) verschijnt pas als je tank ook
 * echt kan rijden. Anders koos een leerling die nog geen enkel blok gebouwd
 * had de arena, en stond hij daar roerloos tussen klasgenoten die wél rijden.
 * We kijken naar zijn blokken, niet naar de stapteller: na een verversing ben
 * je terug bij stap 1, maar je programma staat er nog gewoon.
 */
function tankKanRijden() {
  try {
    const p = window.compileerProject ? compileerProject() : [];
    return alleCmdsVanProject(p).some(isRijden);
  } catch { return false; }
}
function vernieuwSamenKnop() {
  const mag = tankKanRijden();
  document.getElementById('kies-klasgenoten').classList.toggle('verborgen', !mag);
  document.getElementById('samen-slot').classList.toggle('verborgen', mag);
}

/* Hoeveel teams staan er nu aan? Dat lees je af aan het aantal teamzones. */
function teamsNu() { return (staat && staat.zones ? staat.zones.length : 0); }
let gemeldeTeams = null;
function meldTeamstand() {
  if (!gewensteTeams) return;
  const nu = teamsNu();
  if (nu === gemeldeTeams) return;
  gemeldeTeams = nu;
  if (nu === gewensteTeams) toast(`🚩 ${nu} teams staan aan — je hebt je eigen teamkleur en teamzone!`);
  else if (nu === 0) toast('De teams staan uit — iedereen speelt voor zichzelf, met de gedeelde thuisbasis linksonder.');
  else toast(`Let op: er staan nu ${nu} teams aan, niet ${gewensteTeams}. De lesgever bepaalt dit op de beamer.`);
}

function kiesModus(m) {
  const naam = document.getElementById('naam').value.trim();
  if (!naam) {
    document.getElementById('naam').focus();
    toast('Typ eerst je naam 😊');
    return;
  }
  modus = m;
  laatsteJoin = { naam, modus: m, niveau: gekozenNiveau };
  socket.emit('join', laatsteJoin);
  document.getElementById('sprite-naam').textContent = naam;
  startmenu.classList.add('verborgen');
  document.getElementById('naam-weergave').textContent = `👤 ${naam}`;
  document.getElementById('modus-badge').textContent = m === 'solo' ? '🤖 tegen de computer' : '🧑‍🤝‍🧑 met klasgenoten';
  // nu pas begint de les — anders staan er twee instructies tegelijk
  if (!lesGestart) toonStap();
  if (welkeLes === 2) toast('🎮 Rijden met de pijltjes, mikken en schieten met de muis — dat werkt hier meteen.');
}

document.getElementById('menu-knop').addEventListener('click', () => {
  window.runtimeStop();
  socket.emit('verlaat');
  mijnId = null;
  modus = null;
  laatsteJoin = null;   // bewust weggegaan: niet automatisch terugkeren
  startmenu.classList.remove('verborgen');
  document.getElementById('naam-weergave').textContent = '';
  document.getElementById('modus-badge').textContent = '';
  document.getElementById('naam').focus();
  toonStartInstructie();
});

/* ---------------- groene vlag / stop ---------------- */
const vlagKnop = document.getElementById('vlag');
const stopKnop = document.getElementById('stop');

vlagKnop.addEventListener('click', () => {
  if (!modus) { toast('Typ eerst je naam en start de les 😊'); return; }
  window.runtimeStart();
  socket.emit('pauze', false);        // spel weer laten lopen
  document.body.classList.remove('gepauzeerd');
  vlagKnop.classList.add('actief');
  stopKnop.classList.remove('actief');
});
/*
 * De rode stopknop zet niet alleen jouw programma stil, maar het hele spel:
 * robots, kogels en vormen bevriezen. Zonder dat werd je tijdens het bouwen
 * gewoon doorgeschoten terwijl je niets kon doen. In de gedeelde arena kan
 * dat niet — daar spelen je klasgenoten door.
 */
stopKnop.addEventListener('click', () => {
  window.runtimeStop();
  stopKnop.classList.add('actief');
  vlagKnop.classList.remove('actief');
  if (modus === 'solo') {
    socket.emit('pauze', true);
    document.body.classList.add('gepauzeerd');
    toast('⏸ Het spel staat stil. Druk op de groene vlag om verder te gaan.');
  } else {
    toast('⏸ Je programma staat stil. In de arena met klasgenoten loopt het spel wél door!');
  }
});

/* ---------------- muis (invoer!) ---------------- */
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  spel.muisScherm.x = (e.clientX - r.left) * (canvas.width / r.width);
  spel.muisScherm.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', () => { spel.muisKnop = true; });
window.addEventListener('mouseup', () => { spel.muisKnop = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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

    /* De tank past zich aan het kaartje aan: een sluipschutter heeft een loop
       van 60 pixels, die stak anders zo het kaartje uit. */
    const B = 74, H = 56, dpr = Math.min(2, window.devicePixelRatio || 1);
    const mini = document.createElement('canvas');
    mini.width = B * dpr; mini.height = H * dpr;
    mini.style.width = B + 'px'; mini.style.height = H + 'px';
    const langste = (def && def.lopen || []).reduce((m, l) => Math.max(m, (l.start || 0) + l.len), 0);
    const schaal = Math.min(0.95, 30 / Math.max(22, 22 + langste * 0.55));
    const g = mini.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(B / 2, H / 2);
    g.scale(schaal, schaal);
    drawTank(g, {
      klasse: k, vorm: 'cirkel', kleur: ik.kleur, angle: Math.PI * 0.75, naam: '',
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
  if ((ik.stats[stat] || 0) >= statMaxVan()) { toast(`${STAT_META[stat][1]} is al maximaal! ⭐`); return; }
  socket.emit('kiesStat', { stat });
  const [, label] = STAT_META[stat] || ['', stat];
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
    const [icoon, label] = STAT_META[stat] || ['•', stat];
    const rij = document.createElement('div');
    rij.className = 'stat-balk-rij';
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

function vernieuwStatOverzicht(ik) {
  const el = document.getElementById('stat-balken');
  if (!ik || !ik.stats) { el.classList.add('verborgen'); return; }
  bouwStatBalken();
  el.classList.remove('verborgen');
  const max = statMaxVan();
  const kan = ik.statPunten > 0;
  el.classList.toggle('heeft-punten', kan);
  el.querySelectorAll('.stat-balk-rij').forEach((rij, i) => {
    const stat = statVolgorde()[i];
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

/* ---------------- drie schermgroottes (zoals in Scratch) ---------------- */
function zetGrootte(g) {
  document.body.classList.toggle('podium-klein', g === 'klein');
  document.body.classList.toggle('speelmodus', g === 'groot');
  for (const k of document.querySelectorAll('.gr-knop')) {
    k.classList.toggle('actief', k.dataset.grootte === g);
  }
  if (g === 'groot' && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (g !== 'groot' && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  setTimeout(() => { maatAanpassen(); window.dispatchEvent(new Event('resize')); }, 120);
}
for (const k of document.querySelectorAll('.gr-knop')) {
  k.addEventListener('click', () => zetGrootte(k.dataset.grootte));
}

/* ---------------- toast-meldingen ---------------- */
let toastTimer = null;
function toast(tekst) {
  const el = document.getElementById('toast');
  el.textContent = tekst;
  el.classList.remove('verborgen');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('verborgen'), 2600);
}

/* ---------------- tekenen (uitvoer!) ---------------- */
function maatAanpassen() {
  canvas.width = podium.clientWidth;
  canvas.height = podium.clientHeight;
}
window.addEventListener('resize', maatAanpassen);

/*
 * Camera, muis-wereldpositie en HUD lopen op een vaste tik, LOS van het
 * tekenen: requestAnimationFrame pauzeert in verborgen tabbladen en de
 * spellogica mag daar nooit van afhangen.
 */
setInterval(() => {
  if (canvas.width !== podium.clientWidth || canvas.height !== podium.clientHeight) maatAanpassen();
  const ik = spel.mijnTank();
  if (ik) {
    camera.x += (ik.x - camera.x) * 0.15;
    camera.y += (ik.y - camera.y) * 0.15;
  }
  /*
   * De camera blijft binnen de arena. Zonder deze klem stond je bij de start
   * (je basis ligt in de hoek) met het halve scherm buiten het speelveld te
   * kijken naar zwarte leegte — zonde van de ruimte, en je zag minder van het
   * spel dan iemand die in het midden stond. Past de arena in het venster,
   * dan centreren we hem gewoon.
   */
  // het zichtbare stuk wereld is groter dan het canvas doordat we uitzoomen
  /* Ondergrens: op een klein podium (11-inch chromebook, speelveld op "klein")
     zou een Ranger zo ver uitzoomen dat je je eigen tank nauwelijks nog ziet.
     Bij 0.42 is de romp nog altijd ruim 9 pixels groot. */
  zoomDoel = ik ? Math.max(0.42, ZOOM / zichtVan(ik.klasse, ik.level)) : ZOOM;
  zoom += (zoomDoel - zoom) * 0.06;
  const zichtB = canvas.width / zoom, zichtH = canvas.height / zoom;
  /* De server stuurt alleen wat je kan zien, dus moet hij weten hoe groot je
     venster is. Dat verandert zelden (schermgrootte, uitzoomen bij een
     sluipschutter), dus we melden het pas als het echt anders is. */
  if (mijnId && (Math.abs(zichtB - gemeldZicht.w) > zichtB * 0.06
              || Math.abs(zichtH - gemeldZicht.h) > zichtH * 0.06)) {
    gemeldZicht = { w: zichtB, h: zichtH };
    socket.emit('kijk', { w: Math.round(zichtB), h: Math.round(zichtH) });
  }
  const halfB = zichtB / 2, halfH = zichtH / 2;
  camera.x = arena.w <= zichtB ? arena.w / 2 : Math.max(halfB, Math.min(arena.w - halfB, camera.x));
  camera.y = arena.h <= zichtH ? arena.h / 2 : Math.max(halfH, Math.min(arena.h - halfH, camera.y));
  tekenOffset = { x: canvas.width / 2 - camera.x * zoom, y: canvas.height / 2 - camera.y * zoom };
  spel.muisWereld.x = (spel.muisScherm.x - tekenOffset.x) / zoom;
  spel.muisWereld.y = (spel.muisScherm.y - tekenOffset.y) / zoom;
  vernieuwHud(ik);
  // de waarnemer kijkt mee voor de checkpoints van de les
  stapWaarnemer.tik(ik, eigenKogelsTeller, window.runtime ? runtime.vars : {});
  eigenKogelsTeller = 0;
}, 1000 / 30);

function teken() {
  requestAnimationFrame(teken);

  // buiten de arena: een tint donkerder dan de vloer, zoals in diep.io
  ctx.fillStyle = ARENA_BUITEN;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!staat) return;

  const ox = tekenOffset.x;
  const oy = tekenOffset.y;

  const nu = Date.now();
  bijwerkAnimaties(nu);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(zoom, zoom);
  // alleen het raster tekenen dat in beeld staat (scheelt honderden lijnen)
  drawArena(ctx, arena, 1, {
    x: camera.x - canvas.width / zoom / 2, y: camera.y - canvas.height / zoom / 2,
    w: canvas.width / zoom, h: canvas.height / zoom,
  });
  drawZones(ctx, staat.zones);
  if (staat.basis) drawZones(ctx, [Object.assign({ team: 0 }, staat.basis)]);

  // vormen: zachtjes pulseren, wit flitsen bij een treffer
  for (const v of staat.vormen) {
    v.__pulse = v.type === 'muur' ? 1 : 1 + 0.05 * Math.sin(nu / 350 + v.id * 1.7);
    drawVormObj(ctx, v);
  }

  // brokstukken van kapotgeschoten vormen
  for (const p of brokstukken) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.leven);
    ctx.fillStyle = p.kleur;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
    ctx.restore();
  }

  // kogels: pop bij afvuren, gloed onderweg, uitdoven op het einde
  for (const b of staat.bullets) {
    const leeftijd = nu - (kogelGeboorte.get(b.id) || nu);
    const pop = leeftijd < 120 ? 1.45 - (leeftijd / 120) * 0.45 : 1;
    const alpha = b.tl < 300 ? Math.max(0.15, b.tl / 300) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawMunitie(ctx, b, pop);
    ctx.restore();
  }

  // tanks: terugstoot bij schieten, schudden bij een treffer
  for (const t of staat.tanks) {
    if (t.dood) continue;
    const schud = t.flits === '#ff5252' ? 2.5 : 0;
    t.__recoil = nu - (terugstoot.get(t.id) || 0) < 110;
    ctx.save();
    ctx.translate(t.x + (Math.random() - 0.5) * schud * 2, t.y + (Math.random() - 0.5) * schud * 2);
    drawTank(ctx, t, t.id === mijnId);
    ctx.restore();
  }

  // zwevende "+punten"
  for (const p of scorePopups) {
    const d = (nu - p.start) / 900;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - d);
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    // donkere rand: op de lichte vloer verdween het geel anders in het grijs
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,24,32,.8)';
    ctx.strokeText(`+${p.n}`, p.x, p.y - d * 46);
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(`+${p.n}`, p.x, p.y - d * 46);
    ctx.restore();
  }

  ctx.restore();

  tekenMinimap();
  tekenScorebord();
}
requestAnimationFrame(teken);

/* ---------------- animatie-boekhouding ---------------- */
const kogelGeboorte = new Map();  // kogel-id -> eerste keer gezien
const terugstoot = new Map();     // tank-id -> laatst geschoten
const brokstukken = [];           // deeltjes van kapotte vormen
let vorigeVormen = new Map();

function bijwerkAnimaties(nu) {
  // nieuwe kogels registreren (voor de pop + terugstoot van de schutter)
  const levend = new Set();
  for (const b of staat.bullets) {
    levend.add(b.id);
    if (!kogelGeboorte.has(b.id)) {
      kogelGeboorte.set(b.id, nu);
      terugstoot.set(b.eigenaar, nu);
      if (b.eigenaar === mijnId) { speelGeluid('pew'); eigenKogelsTeller++; }
    }
  }
  for (const id of kogelGeboorte.keys()) if (!levend.has(id)) kogelGeboorte.delete(id);

  // verdwenen vormen -> brokstukken
  const huidige = new Map();
  for (const v of staat.vormen) huidige.set(v.id, v);
  /* Een vorm kan ook uit je beeld schuiven (de server stuurt enkel wat je
     ziet). Dan is hij niet kapot — daar horen dus geen brokstukken bij. We
     maken ze alleen voor vormen die ruim binnen je scherm stonden. */
  const ikNu = spel.mijnTank();
  const inBeeld = (v) => !ikNu
    || (Math.abs(v.x - ikNu.x) < canvas.width / zoom / 2 - 40
     && Math.abs(v.y - ikNu.y) < canvas.height / zoom / 2 - 40);
  for (const [id, v] of vorigeVormen) {
    if (!huidige.has(id) && inBeeld(v) && brokstukken.length < 220) {
      for (let i = 0; i < 7; i++) {
        const hoek = Math.random() * Math.PI * 2;
        const vaart = 60 + Math.random() * 140;
        brokstukken.push({
          x: v.x, y: v.y, kleur: v.kleur,
          vx: Math.cos(hoek) * vaart, vy: Math.sin(hoek) * vaart,
          r: 3 + Math.random() * 4, rot: Math.random() * Math.PI,
          leven: 1,
        });
      }
    }
  }
  vorigeVormen = huidige;

  // brokstukken bewegen en vervagen
  const dt = 1 / 60;
  for (let i = brokstukken.length - 1; i >= 0; i--) {
    const p = brokstukken[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += dt * 4;
    p.leven -= dt * 1.6;
    if (p.leven <= 0) brokstukken.splice(i, 1);
  }

  // zwevende punten opruimen
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    if (nu - scorePopups[i].start > 900) scorePopups.splice(i, 1);
  }
}

/* ---------------- minikaart ---------------- */
/*
 * Opgebouwd zoals de kaart van diep.io: een licht vlak met een dikke rand, de
 * teamstroken in hun eigen kleur, en jij als zwart pijltje dat meedraait met
 * de richting waarin je kijkt. Zo zie je in één oogopslag of je in het midden
 * zit of tegen de rand plakt.
 *
 * Wat er bewust NIET op staat: de losse blokjes. Dat was één grote
 * confettivlek. Wat er wel bij staat en in diep.io niet: de andere tanks. In
 * een arena van elf kilometer breed moeten klasgenoten elkaar kunnen vinden.
 */
function tekenMinimap() {
  const mw = Math.round(Math.min(240, Math.max(150, canvas.width * 0.2)));
  const mh = Math.round(mw * (arena.h / arena.w));
  const mx = canvas.width - mw - 14, my = canvas.height - mh - 14;
  const s = mw / arena.w;
  const px = (wx) => mx + wx * s, py = (wy) => my + wy * s;
  ctx.save();

  // titelregel boven de kaart, net als "diep.io — 939 players"
  const levend = staat.tanks.filter((t) => !t.dood).length;
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText(`Tank Arena · ${levend} tanks`, mx + mw, my - 5);

  // het vlak zelf: licht, met een stevige rand
  ctx.fillStyle = 'rgba(206,211,219,.92)';
  ctx.fillRect(mx, my, mw, mh);

  // veilige zones als volle stroken in hun teamkleur
  const zones = (staat.zones && staat.zones.length)
    ? staat.zones
    : (staat.basis ? [Object.assign({ team: 0 }, staat.basis)] : []);
  for (const z of zones) {
    ctx.fillStyle = (TEAM_ZONE_KLEUREN[z.team] || '#3498db');
    ctx.globalAlpha = 0.75;
    ctx.fillRect(px(z.x), py(z.y), z.w * s, z.h * s);
    ctx.globalAlpha = 1;
  }

  /* Het nest in het midden krijgt een lichte tint mee: daar liggen de dikke
     vormen én de crashers. Een gestippeld kader leek een losse doos op de
     kaart; een vlekje leest rustiger. */
  if (staat.nest) {
    ctx.fillStyle = 'rgba(120,80,160,.16)';
    ctx.fillRect(px(staat.nest.x), py(staat.nest.y), staat.nest.w * s, staat.nest.h * s);
  }

  const ik = staat.tanks.find((t) => t.id === mijnId);

  // de andere tanks als stipje in hun teamkleur
  for (const t of staat.tanks) {
    if (t.dood || t.id === mijnId) continue;
    ctx.fillStyle = t.kleur;
    ctx.beginPath();
    ctx.arc(px(t.x), py(t.y), t.ai ? 2.2 : 3.2, 0, Math.PI * 2);
    ctx.fill();
    // echte spelers krijgen een randje: die zijn belangrijker dan de robots
    if (!t.ai) { ctx.strokeStyle = 'rgba(20,24,34,.8)'; ctx.lineWidth = 1; ctx.stroke(); }
  }

  // jijzelf: een zwart pijltje dat wijst waar je kijkt (zoals diep.io)
  if (ik && !ik.dood) {
    ctx.save();
    ctx.translate(px(ik.x), py(ik.y));
    ctx.rotate(ik.angle || 0);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4.5, -5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = '#14181f';
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  // rand er als laatste overheen, anders lopen de zones eroverheen
  ctx.strokeStyle = 'rgba(150,157,170,.95)';
  ctx.lineWidth = 3;
  ctx.strokeRect(mx - 1.5, my - 1.5, mw + 3, mh + 3);
  ctx.restore();
}

/* ---------------- scorebord ---------------- */
/*
 * Rechtsboven in beeld, zoals in diep.io: wie staat er voor? Leerlingen willen
 * dat tijdens het spelen kunnen zien zonder naar de beamer te moeten kijken.
 * We tonen de top 5 spelers, met jezelf altijd erbij ook al sta je lager, en
 * in teammodus de teamstand erboven.
 */
function tekenScorebord() {
  if (!staat || !staat.tanks) return;
  const spelers = staat.tanks.filter((t) => !t.ai);
  if (!spelers.length) return;
  const top = [...spelers].sort((a, b) => b.score - a.score);
  const ik = spel.mijnTank();
  const rijen = top.slice(0, 5);
  if (ik && !rijen.some((t) => t.id === ik.id)) rijen.push(ik);

  const teams = [];
  if (staat.teamModus) {
    const som = new Map();
    for (const t of staat.tanks) {
      if (t.team === null || t.team === undefined) continue;
      som.set(t.team, (som.get(t.team) || 0) + t.score);
    }
    for (let i = 0; i < staat.teamModus; i++) if (!som.has(i)) som.set(i, 0);
    teams.push(...[...som.entries()].sort((a, b) => b[1] - a[1]));
  }

  const B = 168, regel = 17, kopH = teams.length ? teams.length * regel + 8 : 0;
  const H = 24 + kopH + rijen.length * regel + 6;
  const x = canvas.width - B - 12, y = 12;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#2a2f3d';
  ctx.fillRect(x, y, B, H);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, B, H);
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.fillStyle = '#9aa3bb';
  ctx.fillText('SCOREBORD', x + 10, y + 16);

  let ry = y + 20;
  for (const [team, punten] of teams) {
    ry += regel;
    ctx.fillStyle = TEAM_ZONE_KLEUREN[team] || '#fff';
    ctx.fillRect(x + 8, ry - 9, 6, 11);
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillStyle = '#eef0f6';
    ctx.fillText(TEAM_NAAM_CLIENT[team] || ('Team ' + team), x + 20, ry);
    ctx.textAlign = 'right';
    ctx.fillText(String(punten), x + B - 10, ry);
    ctx.textAlign = 'left';
  }
  if (teams.length) ry += 6;

  for (const t of rijen) {
    ry += regel;
    const isIk = ik && t.id === ik.id;
    ctx.font = (isIk ? 'bold ' : '') + '12px Segoe UI, sans-serif';
    ctx.fillStyle = isIk ? '#ffd54f' : '#cfd6e4';
    const naam = String(t.naam || '').slice(0, 13);
    ctx.fillText(naam, x + 10, ry);
    ctx.textAlign = 'right';
    ctx.fillText(String(t.score), x + B - 10, ry);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/* ---------------- sprite-paneel: wie programmeer ik? ---------------- */
const spriteCanvas = document.getElementById('sprite-canvas');
const spriteCtx = spriteCanvas.getContext('2d');
setInterval(() => {
  const ik = spel.mijnTank();
  spriteCtx.clearRect(0, 0, 52, 52);
  spriteCtx.save();
  spriteCtx.translate(26, 28);
  spriteCtx.scale(0.55, 0.55);
  drawTank(spriteCtx, ik
    ? Object.assign({}, ik, { angle: -Math.PI / 2, naam: '', zeg: null, onzichtbaar: false })
    : { klasse: 'basis', vorm: 'cirkel', kleur: '#3498db', angle: -Math.PI / 2, naam: '', hp: 1, maxHp: 1 }, false);
  spriteCtx.restore();
  if (ik) {
    document.getElementById('sprite-info').textContent =
      `${(KLASSEN[ik.klasse] || KLASSEN.basis).naam}\nlvl ${ik.level}`;
  }
}, 500);

function vernieuwHud(ik) {
  const dood = document.getElementById('dood-melding');
  if (ik && ik.dood) {
    dood.classList.remove('verborgen');
    dood.textContent = `💥 Kapot! Je komt zwakker terug over ${ik.respawnOver}...`;
  } else {
    dood.classList.add('verborgen');
  }
  vernieuwStatOverzicht(ik);
  vernieuwVariabeleTellers();
  if (!ik) return;

  document.getElementById('hud-score').textContent = ik.score;
  document.getElementById('hud-level').textContent = ik.level;
  const balk = document.getElementById('xp-balk-vul');
  const deel = Math.max(0, Math.min(1, (ik.score - ik.xpDit) / Math.max(1, ik.xpVolgend - ik.xpDit)));
  balk.style.width = `${Math.round(deel * 100)}%`;

  const statChip = document.getElementById('hud-statpunten');
  /*
   * Zodra er een nieuwe tankklasse te kiezen valt (level 15, 30, 45) klapt het
   * keuzevenster vanzelf open, zoals in diep.io. Het staat in de hoek en is
   * klein, dus je blijft je tank gewoon zien én besturen tot je gekozen hebt.
   * Wie nu niet wil kiezen, klikt "later" — dan blijft het ⚡-tabje knipperen.
   */
  const teKiezen = (ik.klasseAanbod || []).join(',');
  if (teKiezen && teKiezen !== laatsteKlasseAanbod && !klassePopupGesloten) {
    laatsteKlasseAanbod = teKiezen;
    toonKlassePopup(ik);
  }
  if (!teKiezen) { laatsteKlasseAanbod = ''; klassePopupGesloten = false; }

  if (ik.statPunten > 0 || (ik.klasseAanbod && ik.klasseAanbod.length)) {
    statChip.classList.remove('verborgen');
    statChip.textContent = ik.klasseAanbod && ik.klasseAanbod.length
      ? '⬆️ Nieuwe klasse beschikbaar!'
      : `⬆️ ${ik.statPunten} statpunt${ik.statPunten > 1 ? 'en' : ''}`;
  } else {
    statChip.classList.add('verborgen');
  }
}
document.getElementById('hud-statpunten').addEventListener('click', () => spel.toonUpgrade());

/* ------------------------------------------------------------------ */
/* De les: stappen met checkpoints (structuur én gedrag)               */
/* ------------------------------------------------------------------ */
let stapIndex = 0;
let stapKlaar = false;
let lesGestart = false;   // de les begint pas als de leerling in het spel zit
let eigenKogelsTeller = 0;

const elStap = {
  nr: document.getElementById('stap-nr'),
  titel: document.getElementById('stap-titel'),
  concept: document.getElementById('stap-concept'),
  probleem: document.getElementById('stap-probleem'),
  ontdekking: document.getElementById('stap-ontdekking'),
  doel: document.getElementById('stap-doel'),
  structuur: document.getElementById('check-structuur'),
  gedrag: document.getElementById('check-gedrag'),
  breek: document.getElementById('stap-breek'),
  hint: document.getElementById('stap-hint-tekst'),
  volgende: document.getElementById('stap-volgende'),
};

/* Vóór de les: eerst naam + spelmodus kiezen. Anders staan er twee
   instructies tegelijk op het scherm ("kies een modus" én "druk op 🚩"). */
function toonStartInstructie() {
  lesGestart = false;
  document.body.classList.add('les-nog-niet-gestart');
  elStap.nr.textContent = 'Start';
  elStap.titel.textContent = 'Klaar om te beginnen?';
  elStap.concept.textContent = '';
  elStap.probleem.textContent = '👉 Typ je naam en klik op ▶ Start de les.';
  elStap.ontdekking.textContent = 'Daarna verschijnt hier stap 1 en begin je met bouwen.';
  elStap.hint.classList.add('verborgen');
  elStap.breek.classList.add('verborgen');
}

/*
 * Welke stappen zijn al eens gelukt. Nodig omdat de waarnemer bij elke stap
 * opnieuw begint: zonder dit lijkt een afgeronde stap weer onaf zodra je even
 * terugbladert, de hint bekijkt of de lesgever de klas een stap stuurt — en
 * moest de leerling zijn tank opnieuw laten bewegen om het vinkje terug te
 * krijgen.
 *
 * Bewust ALLEEN in het geheugen, niet in localStorage. Bewaard op het toestel
 * stonden de gedragsvinkjes bij een volgende sessie meteen groen — en bij de
 * volgende leerling op datzelfde toestel ook. Je kon dan door de hele les
 * klikken zonder je tank ooit te laten bewegen. Een vinkje moet iets betekenen.
 */
const gehaaldeStappen = new Set();
localStorage.removeItem('tankStappenGehaald');   // opruimen van de oude opzet
function onthoudGehaald(nr) {
  gehaaldeStappen.add(nr);
}

/*
 * Een doel met meerdere regels wordt een genummerd lijstje. Sommige stappen
 * vroegen om een hele bouwtekening in één zin met pijlen ertussen — dat leest
 * geen kind. Nu staat er per regel één handeling.
 */
function doelHtml(tekst) {
  const regels = String(tekst || '').split('\n').map((r) => r.trim()).filter(Boolean);
  if (regels.length < 2) return blokHtml(tekst);
  return `<ol class="doel-stapjes">${regels.map((r) => `<li>${blokHtml(r)}</li>`).join('')}</ol>`;
}

let lesKlaar = false;   // slotscherm getoond? dan geen stapchecks meer draaien

/*
 * Welke lesreeks loopt er? Les 2 is een losse vervolgsessie met eigen stappen
 * (samen spelen), dus een eigen nummering vanaf 1. Zo belandt een leerling in
 * de workshop nooit per ongeluk in stappen die klasgenoten nodig hebben.
 */
let welkeLes = 1;
function stappen() { return welkeLes === 2 ? LES2_STAPPEN : STAPPEN; }

function toonStap() {
  lesGestart = true;
  lesKlaar = false;
  document.body.classList.remove('stap-ingeklapt');
  document.body.classList.remove('les-nog-niet-gestart');
  const s = stappen()[stapIndex];
  // de editor kijkt hiernaar: bij stap 2 laat hij dode code bewust staan
  window.huidigeStapNr = s.nr;
  // en hij ontgrendelt de blokken die bij deze stap horen
  if (window.zetLesStap) window.zetLesStap(s.nr);
  stapKlaar = gehaaldeStappen.has(s.nr);
  stapWaarnemer.herstart();
  elStap.nr.textContent = `Stap ${s.nr}/${stappen().length}`;
  elStap.titel.textContent = s.titel;
  elStap.concept.textContent = s.concept;
  // blokverwijzingen krijgen de kleur van hun categorie
  elStap.probleem.innerHTML = `❓ ${blokHtml(s.probleem)}`;
  elStap.ontdekking.innerHTML = blokHtml(s.ontdekking);
  elStap.doel.innerHTML = `🎯 ${doelHtml(s.doel)}`;
  elStap.hint.innerHTML = `💡 ${blokHtml(s.hint)}`;
  elStap.hint.classList.add('verborgen');
  elStap.breek.innerHTML = blokHtml(s.breek || '');
  // al gelukt? dan staat de breek-oefening er meteen weer bij
  elStap.breek.classList.toggle('verborgen', !(stapKlaar && s.breek));
  elStap.volgende.disabled = !stapKlaar;
  elStap.volgende.textContent = stapIndex === stappen().length - 1 ? 'klaar! 🏆' : 'volgende ▶';
  meldStatusAanLesgever('bezig');
  // Een stap met een lange uitleg maakt dit paneel hoger, dus het werkblad
  // lager. Zonder dit bleef de blokkenlade even hoog als bij de vorige stap:
  // hij stak dan onder het scherm uit en je kon niet meer bij de onderste
  // blokken. Even wachten tot de nieuwe tekst echt gezet is.
  setTimeout(() => { if (window.herschaalWerkveld) window.herschaalWerkveld(); }, 60);
}

/* Elke halve seconde: kloppen de blokken én doet de tank het ook echt? */
setInterval(() => {
  const s = stappen()[stapIndex];
  if (!s || !lesGestart || lesKlaar) return;   // slotscherm niet overschrijven
  let programma = [];
  try { programma = window.compileerProject ? compileerProject() : []; } catch { /* editor nog niet klaar */ }

  const structuurOk = !!s.check.structuur(programma);
  // wat je al bewezen hebt, hoef je niet opnieuw te bewijzen: de waarnemer
  // begint bij elke stap op nul, maar een behaald vinkje blijft staan
  const gedragOk = gehaaldeStappen.has(s.nr) || !!s.check.gedrag(stapWaarnemer);
  elStap.structuur.innerHTML = `${structuurOk ? '✓' : '○'} ${blokHtml(s.check.structuurTekst)}`;
  elStap.structuur.classList.toggle('gelukt', structuurOk);
  elStap.gedrag.innerHTML = `${gedragOk ? '✓' : '○'} ${blokHtml(s.check.gedragTekst)}`;
  elStap.gedrag.classList.toggle('gelukt', gedragOk);

  if (structuurOk && gedragOk && !stapKlaar) {
    stapKlaar = true;
    onthoudGehaald(s.nr);
    elStap.volgende.disabled = false;
    if (s.breek) elStap.breek.classList.remove('verborgen');
    speelGeluid('tada');
    toast(`✓ Stap ${s.nr} gelukt! ${s.breek ? 'Probeer nu de proef eronder.' : ''}`);
    meldStatusAanLesgever('klaar');
  }
}, 500);

/*
 * Klaar met alle stappen: het stappenpaneel maakt plaats voor een slotscherm.
 * Eerder gaf de knop alleen een toast — dan leek hij stuk. Nu krijg je een
 * duidelijk einde én ruimte om vrij te spelen.
 */
function toonEinde() {
  lesKlaar = true;
  elStap.nr.textContent = '🏆 klaar';
  elStap.titel.textContent = 'Je tank is helemaal van jou!';
  elStap.concept.textContent = '';
  elStap.probleem.innerHTML = '🏆 Alle stappen gelukt. Je hebt je tank van nul opgebouwd: rijden, richten, schieten, je levens bijhouden en zelfs je eigen upgrade-plan.';
  elStap.ontdekking.innerHTML = 'Speel nu vrij verder in de arena, of vraag je lesgever om een opdrachtkaart. Wil je nog iets nakijken? Klik op ◀ terug.';
  elStap.doel.innerHTML = '';
  elStap.structuur.innerHTML = '';
  elStap.gedrag.innerHTML = '';
  elStap.breek.classList.add('verborgen');
  elStap.hint.classList.add('verborgen');
  elStap.volgende.disabled = true;
  elStap.volgende.textContent = '🎮 vrij spelen';
  document.body.classList.add('stap-ingeklapt');       // meer ruimte voor spel
  setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  speelGeluid('tada');
  toast('🏆 Alle stappen gelukt! Veel plezier in de arena.');
}

document.getElementById('stap-volgende').addEventListener('click', () => {
  if (stapIndex < stappen().length - 1) { stapIndex++; toonStap(); }
  else toonEinde();
});
document.getElementById('stap-vorige').addEventListener('click', () => {
  if (stapIndex > 0) { stapIndex--; toonStap(); }
});
document.getElementById('stap-hint').addEventListener('click', () => {
  elStap.hint.classList.toggle('verborgen');
  if (!elStap.hint.classList.contains('verborgen')) meldStatusAanLesgever('vast');
});
document.getElementById('stap-inklap').addEventListener('click', () => {
  document.body.classList.toggle('stap-ingeklapt');
  setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
});

/* Commando's van de lesgever: stap sturen, bevriezen, code opvragen. */
socket.on('lesStuur', (d) => {
  if (!d) return;
  if (d.type === 'stap') {
    const i = stappen().findIndex((s) => s.nr === d.stap);
    if (i >= 0 && i !== stapIndex) { stapIndex = i; toonStap(); toast(`📘 De klas gaat naar stap ${d.stap}`); }
  } else if (d.type === 'bevries') {
    document.getElementById('bevroren-melding').classList.toggle('verborgen', !d.aan);
    if (d.aan) window.runtimeStop();
  } else if (d.type === 'stuurCode') {
    let tekst = '(nog geen blokken)';
    try { tekst = programmaAlsTekst(compileerProject()); } catch { /* editor nog niet klaar */ }
    socket.emit('mijnCode', {
      naam: document.getElementById('naam').value.trim() || 'Naamloos',
      tekst,
    });
  }
});

/*
 * De lesgever volgt de klas. Behalve naam, stap en status sturen we ook hoeveel
 * blokken er op het werkblad staan en wanneer er voor het laatst iets
 * veranderde. Daarmee ziet de lesgever in één oogopslag wie er echt aan het
 * bouwen is en wie al vijf minuten naar hetzelfde scherm zit te kijken —
 * precies de leerling die je moet gaan helpen.
 */
let laatsteWijziging = Date.now();
let laatsteVingerafdruk = '';
/*
 * "Is deze leerling aan het bouwen?" bepalen we door zijn werkblad zelf te
 * vergelijken, niet via Blockly's gebeurtenissen. Die vuren namelijk niet bij
 * elke manier waarop blokken op het werkblad komen (bijvoorbeeld bij het laden
 * van een projectcode), en dan zou een leerling die druk bezig is toch als
 * "stil" op het dashboard van de lesgever verschijnen — precies de leerling die
 * je dan onnodig gaat storen.
 */
function vingerafdrukVanWerkblad() {
  try {
    const b = blocklyWerkruimte.getAllBlocks(false);
    return b.length + ':' + b.map((x) => x.type + (x.id || '')).join(',').length
      + ':' + b.map((x) => { const p = x.getRelativeToSurfaceXY(); return Math.round(p.x) + '_' + Math.round(p.y); }).join('|').length;
  } catch { return ''; }
}

function meldStatusAanLesgever(status) {
  if (!lesGestart) return;
  let blokken = 0;
  try { blokken = blocklyWerkruimte.getAllBlocks(false).length; } catch { /* editor nog niet klaar */ }
  const nu = vingerafdrukVanWerkblad();
  if (nu !== laatsteVingerafdruk) { laatsteVingerafdruk = nu; laatsteWijziging = Date.now(); }
  socket.emit('lesStatus', {
    naam: document.getElementById('naam').value.trim() || 'Naamloos',
    stap: stappen()[stapIndex].nr,
    status,
    blokken,
    stilMs: Date.now() - laatsteWijziging,
  });
}
setInterval(() => meldStatusAanLesgever(stapKlaar ? 'klaar' : 'bezig'), 4000);

toonStartInstructie();
document.getElementById('naam').focus(); // cursor staat meteen klaar in het naamveld

/* Eigen variabelen live als tellertjes op het speelveld (zoals Scratch). */
function vernieuwVariabeleTellers() {
  const el = document.getElementById('var-watchers');
  if (!window.blocklyWerkruimte) return;
  const verborgen = (window.runtime && runtime.verborgenVars) || new Set();
  const vars = blocklyWerkruimte.getAllVariables().filter((v) => !verborgen.has(v.name));
  if (!vars.length) { el.innerHTML = ''; return; }
  el.innerHTML = vars.map((v) => {
    const naam = v.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const rauw = (window.runtime && runtime.vars && v.name in runtime.vars) ? runtime.vars[v.name] : 0;
    /* Afronden op één decimaal. De levensteller rekent met "0 − kracht kogel"
       en die kracht is zelden een rond getal, waardoor er -23.099999999999987
       op het speelveld stond. Het getal zelf blijft precies; alleen wat de
       leerling ziet is netjes. */
    const waarde = typeof rauw === 'number' ? Math.round(rauw * 10) / 10 : rauw;
    return `<div class="watcher"><span>${naam}</span><b>${waarde}</b></div>`;
  }).join('');
}
