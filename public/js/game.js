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
    else if (ik.statPunten > 0) toonStatPopup(ik);
    else toast('Nog niets te kiezen — verdien eerst meer punten! 🏆');
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

socket.on('welkom', (d) => { mijnId = d.id; arena = d.arena; });
socket.on('vol', () => toast('De arena zit vol! Vraag de begeleider om hulp.'));
socket.on('state', (s) => {
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
document.getElementById('kies-computer').addEventListener('click', () => kiesModus(welkeLes === 2 ? 'samen' : 'solo'));
// Enter in het naamveld start meteen — één handeling minder
document.getElementById('naam').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); kiesModus(welkeLes === 2 ? 'samen' : 'solo'); }
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
const popupStat = document.getElementById('popup-stat');

function toonKlassePopup(ik) {
  const lijst = document.getElementById('klasse-lijst');
  lijst.innerHTML = '';
  for (const k of ik.klasseAanbod) {
    const def = KLASSEN[k];
    const kaart = document.createElement('button');
    kaart.className = 'klasse-kaart';
    const mini = document.createElement('canvas');
    // wat ruimer en zonder naam/levensbalk: het is een plaatje, geen speelveld
    mini.width = 104; mini.height = 88;
    const g = mini.getContext('2d');
    g.translate(52, 46);
    g.scale(0.85, 0.85);
    drawTank(g, {
      klasse: k, vorm: 'cirkel', kleur: ik.kleur, angle: -Math.PI / 2, naam: '',
      hp: 1, maxHp: 1, zeg: null, flits: null, schild: false, onzichtbaar: false,
      alleenVorm: true,
    }, false);
    const label = document.createElement('div');
    label.textContent = def ? def.naam : k;
    kaart.appendChild(mini);
    kaart.appendChild(label);
    kaart.addEventListener('click', () => {
      socket.emit('kiesKlasse', { klasse: k });
      popupKlasse.classList.add('verborgen');
      toast(`Je bent nu een ${def ? def.naam : k}! 🎉`);
    });
    lijst.appendChild(kaart);
  }
  popupKlasse.classList.remove('verborgen');
}
document.getElementById('klasse-sluit').addEventListener('click', () => popupKlasse.classList.add('verborgen'));

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

function toonStatPopup() {
  bouwStatPopupEenmalig();
  vernieuwStatPopup();
  popupStat.classList.remove('verborgen');
}

/*
 * BUG (opgelost): vernieuwStatPopup() herbouwde vroeger bij ELKE aanroep alle
 * 8 knoppen helemaal opnieuw (lijst.innerHTML = '' + createElement). Omdat
 * vernieuwHud() dit 30x/seconde aanroept zolang de popup open staat, werd
 * elke knop 30x/sec vernietigd en vervangen — een muisklik (100-300ms) botste
 * daardoor bijna altijd met een herbouw halverwege, waardoor de klik nooit
 * aankwam. Nu bouwen we de knoppen maar ÉÉN keer (bij het openen) en werken
 * we nadien enkel hun tekst/balkje/disabled-status bij, zonder de knoppen
 * zelf (en hun click-listener) te vervangen.
 */
function bouwStatPopupEenmalig() {
  const lijst = document.getElementById('stat-lijst');
  if (lijst.dataset.gebouwd === '1') return; // al gebouwd, niet opnieuw aanmaken
  lijst.dataset.gebouwd = '1';
  lijst.innerHTML = '';
  statVolgorde().forEach((stat, i) => {
    const [icoon, label] = STAT_META[stat] || ['•', stat];
    const rij = document.createElement('div');
    rij.className = 'stat-rij';
    const naam = document.createElement('span');
    naam.className = 'stat-naam';
    naam.dataset.stat = stat;
    naam.innerHTML = `<span class="stat-toets">${i + 1}</span> ${icoon} ${label} <span class="stat-balk"></span>`;
    const knop = document.createElement('button');
    knop.textContent = '+';
    knop.dataset.stat = stat;
    knop.addEventListener('click', () => {
      socket.emit('kiesStat', { stat });
      setTimeout(vernieuwStatPopup, 120); // even wachten op de server
    });
    rij.appendChild(naam);
    rij.appendChild(knop);
    lijst.appendChild(rij);
  });
}

function vernieuwStatPopup() {
  const ik = spel.mijnTank();
  if (!ik || !ik.stats) return;
  const max = statMaxVan();
  document.getElementById('stat-punten-over').textContent = ik.statPunten;
  const lijst = document.getElementById('stat-lijst');
  if (lijst.dataset.gebouwd !== '1') bouwStatPopupEenmalig(); // veiligheidsnet als er nog niets stond
  lijst.querySelectorAll('.stat-rij').forEach((rij) => {
    const stat = rij.querySelector('button').dataset.stat;
    const nu = ik.stats[stat] || 0;
    rij.querySelector('.stat-balk').textContent = statBalk(nu, max);
    rij.querySelector('button').disabled = ik.statPunten <= 0 || nu >= max;
  });
}
document.getElementById('stat-sluit').addEventListener('click', () => popupStat.classList.add('verborgen'));

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

/* Altijd-zichtbaar overzicht van je upgrades (bv. 💥 Kogelschade ▰▰▰▱▱▱▱ 3/7). */
function vernieuwStatOverzicht(ik) {
  const el = document.getElementById('stat-overzicht');
  const hoek = document.getElementById('stat-hoek');
  if (!ik || !ik.stats) { el.innerHTML = ''; hoek.classList.add('verborgen'); return; }
  const max = statMaxVan();
  const kanUpgraden = ik.statPunten > 0;
  // het tabje verschijnt pas als upgraden zin heeft; het paneel klapt open
  // bij hover, of vanzelf zodra er punten te besteden zijn
  const heeftIetsGedaan = kanUpgraden || ik.level > 1
    || statVolgorde().some((s) => (ik.stats[s] || 0) > 0);
  hoek.classList.toggle('verborgen', !heeftIetsGedaan);
  hoek.classList.toggle('heeft-punten', kanUpgraden);
  el.innerHTML =
    `<div class="ov-titel">⚡ Mijn upgrades${kanUpgraden ? ` · <b>${ik.statPunten} punt${ik.statPunten > 1 ? 'en' : ''}</b> (toets 1-8)` : ''}</div>` +
    statVolgorde().map((stat, i) => {
      const [icoon, label] = STAT_META[stat] || ['•', stat];
      const nu = ik.stats[stat] || 0;
      const vol = nu >= max;
      return `<div class="ov-rij ${vol ? 'ov-vol' : ''} ${kanUpgraden && !vol ? 'ov-kan' : ''}"><span><span class="ov-toets">${i + 1}</span> ${icoon} ${label}</span><span class="ov-balk">${statBalk(nu, max)}</span></div>`;
    }).join('');
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
  const halfB = canvas.width / 2, halfH = canvas.height / 2;
  camera.x = arena.w <= canvas.width ? arena.w / 2 : Math.max(halfB, Math.min(arena.w - halfB, camera.x));
  camera.y = arena.h <= canvas.height ? arena.h / 2 : Math.max(halfH, Math.min(arena.h - halfH, camera.y));
  tekenOffset = { x: canvas.width / 2 - camera.x, y: canvas.height / 2 - camera.y };
  spel.muisWereld.x = spel.muisScherm.x - tekenOffset.x;
  spel.muisWereld.y = spel.muisScherm.y - tekenOffset.y;
  vernieuwHud(ik);
  // de waarnemer kijkt mee voor de checkpoints van de les
  stapWaarnemer.tik(ik, eigenKogelsTeller, window.runtime ? runtime.vars : {});
  eigenKogelsTeller = 0;
}, 1000 / 30);

function teken() {
  requestAnimationFrame(teken);

  ctx.fillStyle = '#10131c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!staat) return;

  const ox = tekenOffset.x;
  const oy = tekenOffset.y;

  const nu = Date.now();
  bijwerkAnimaties(nu);

  ctx.save();
  ctx.translate(ox, oy);
  drawArena(ctx, arena, 1);
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
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${p.n}`, p.x, p.y - d * 46);
    ctx.restore();
  }

  ctx.restore();

  tekenMinimap();
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
  for (const [id, v] of vorigeVormen) {
    if (!huidige.has(id) && brokstukken.length < 220) {
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

/* ---------------- minimap ---------------- */
/*
 * Kleine kaart met alleen wat je écht moet weten: waar sta jij, waar zijn de
 * anderen, waar is je veilige zone en waar ligt het nest. Alle losse blokjes
 * stonden er vroeger ook op — dat was één grote confettivlek en het ding nam
 * een kwart van je speelveld in beslag.
 */
function tekenMinimap() {
  const mw = 128, mh = Math.round(mw * (arena.h / arena.w));
  const mx = canvas.width - mw - 12, my = canvas.height - mh - 12;
  const s = mw / arena.w;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = '#181c2a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, mw, mh);
  if (staat.basis) {
    ctx.fillStyle = 'rgba(52,152,219,0.5)';
    ctx.fillRect(mx + staat.basis.x * s, my + staat.basis.y * s, staat.basis.w * s, staat.basis.h * s);
  }
  for (const z of staat.zones || []) {
    ctx.fillStyle = (TEAM_ZONE_KLEUREN[z.team] || '#fff') + '66';
    ctx.fillRect(mx + z.x * s, my + z.y * s, z.w * s, z.h * s);
  }
  // het nest in het midden: daar liggen de dikke vormen én de bewakers
  if (staat.nest) {
    ctx.strokeStyle = 'rgba(155,89,208,.85)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx + staat.nest.x * s, my + staat.nest.y * s, staat.nest.w * s, staat.nest.h * s);
    ctx.setLineDash([]);
  }
  // alleen muren als grijs blokje: handig om je te oriënteren
  for (const v of staat.vormen) {
    if (v.type !== 'muur') continue;
    ctx.fillStyle = 'rgba(92,101,114,.8)';
    ctx.fillRect(mx + v.x * s - 2, my + v.y * s - 2, 4, 4);
  }
  for (const t of staat.tanks) {
    if (t.dood) continue;
    if (t.id === mijnId) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mx + t.x * s, my + t.y * s, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = t.ai ? '#ff5252' : t.kleur;
      ctx.beginPath();
      ctx.arc(mx + t.x * s, my + t.y * s, 3, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // als de statpopup openstaat, live meelopen met de server
  if (!popupStat.classList.contains('verborgen')) vernieuwStatPopup();

  document.getElementById('hud-score').textContent = ik.score;
  document.getElementById('hud-level').textContent = ik.level;
  const balk = document.getElementById('xp-balk-vul');
  const deel = Math.max(0, Math.min(1, (ik.score - ik.xpDit) / Math.max(1, ik.xpVolgend - ik.xpDit)));
  balk.style.width = `${Math.round(deel * 100)}%`;

  const statChip = document.getElementById('hud-statpunten');
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

/* ⚡-tabje linksonder: klik open, klik dicht. */
document.getElementById('stat-tab').addEventListener('click', () => {
  document.getElementById('stat-hoek').classList.toggle('open');
});

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

/* De lesgever volgt de klas: naam, stap en status. */
function meldStatusAanLesgever(status) {
  if (!lesGestart) return;
  socket.emit('lesStatus', {
    naam: document.getElementById('naam').value.trim() || 'Naamloos',
    stap: stappen()[stapIndex].nr,
    status,
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
