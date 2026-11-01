/*
 * Het startmenu, projecten bewaren en ophalen, en de groene vlag.
 * Deel van het spel in de browser (spel-*.js, geladen in deze volgorde).
 */

/* ---------------- geluidknop ---------------- */
const geluidKnop = document.getElementById('geluid-knop');
geluidKnop.textContent = geluidStaatAan() ? '🔊' : '🔇';
geluidKnop.addEventListener('click', () => {
  // heeft de lesgever het geluid van de klas uitgezet? dan blijft het stil
  if (klasIsStil()) { toast('🔇 De lesgever heeft het geluid van de klas uitgezet.'); return; }
  zetGeluid(!geluidStaatAan());
  geluidKnop.textContent = geluidStaatAan() ? '🔊' : '🔇';
});

/* ---------------- projectopslag (autosave + code) ---------------- */
/*
 * Welk project hoort bij deze sessie? Pas als de leerling het ophaalt (of iets
 * nieuws bouwt) — NIET automatisch de code die nog op dit toestel stond.
 *
 * Dat ging zo mis: in les 2 opent een kind het spel, typt zijn naam, en vijf
 * seconden later schreef de autosave zijn nog lege werkblad over het project
 * van les 1 heen. Klikte hij daarna op "Ophalen", dan haalde hij een leeg
 * project op. Op een gedeelde chromebook overschreef het volgende kind zo ook
 * het werk van het vorige. De code van dit toestel bieden we nu alleen áán.
 */
let VORIGE_CODE = null;
try { VORIGE_CODE = localStorage.getItem('tankProjectCode') || null; } catch { /* geen opslag */ }
let projectCode = null;
let laatsteOpslag = '';

function toonProjectCode() {
  document.getElementById('project-code').textContent = projectCode ? `💾 ${projectCode}` : '';
}
toonProjectCode();

setInterval(() => {
  const naam = document.getElementById('naam').value.trim();
  if (!naam || !window.blocklyWerkruimte) return;
  // een leeg werkblad zonder project is niets om te bewaren
  if (!projectCode && !blocklyWerkruimte.getAllBlocks(false).length) return;
  const data = Blockly.serialization.workspaces.save(blocklyWerkruimte);
  const s = JSON.stringify(data);
  if (s === laatsteOpslag) return;
  socket.emit('bewaarProject', { code: projectCode, naam, werkruimte: data }, (res) => {
    if (!res || !res.code) return;
    laatsteOpslag = s;
    if (res.code !== projectCode) {
      projectCode = res.code;
      try { localStorage.setItem('tankProjectCode', projectCode); } catch { /* geen opslag */ }
      toonProjectCode();
      toast(`💾 Je project wordt automatisch bewaard! Jouw code: ${projectCode}`);
    }
  });
}, 5000);

/* Een project ophalen: vanuit het invulvak of met de knop "Verder met …". */
function haalProjectOp(code) {
  socket.emit('laadProject', { code }, (res) => {
    if (!res || !res.ok) { meldInStartmenu('Die code ken ik niet — kijk hem goed na! 🔍'); return; }
    Blockly.serialization.workspaces.load(res.werkruimte, blocklyWerkruimte);
    document.getElementById('naam').value = res.naam;
    projectCode = code;
    try { localStorage.setItem('tankProjectCode', code); } catch { /* geen opslag */ }
    laatsteOpslag = '';
    toonProjectCode();
    document.getElementById('verder-knop').classList.add('verborgen');
    meldInStartmenu(`📂 Project van ${res.naam} geladen! Klik nu op ▶ Start de les.`);
  });
}
document.getElementById('project-laad-knop').addEventListener('click', () => {
  const code = document.getElementById('project-code-invoer').value.toUpperCase().trim();
  if (!code) { document.getElementById('project-code-invoer').focus(); return; }
  haalProjectOp(code);
});

/* Het startmenu ligt over het hele scherm, ook over de toastjes. Meldingen
   die bij het startmenu horen, komen daarom in het menu zelf. */
function meldInStartmenu(tekst) {
  const el = document.getElementById('start-melding');
  el.textContent = tekst;
  el.classList.remove('verborgen');
}

/*
 * Stond er op dit toestel al een project? Dan bieden we het aan met de naam
 * erbij — "Verder met het project van Emma". Zo haalt een leerling met één
 * klik zijn werk terug, en ziet een ander kind meteen dat het niet het zijne is.
 */
if (VORIGE_CODE) {
  document.getElementById('project-code-invoer').value = VORIGE_CODE;
  socket.emit('laadProject', { code: VORIGE_CODE }, (res) => {
    if (!res || !res.ok || projectCode) return;
    const knop = document.getElementById('verder-knop');
    document.getElementById('verder-naam').textContent = `${res.naam} (${VORIGE_CODE})`;
    knop.classList.remove('verborgen');
    knop.addEventListener('click', () => haalProjectOp(VORIGE_CODE), { once: true });
  });
}

document.getElementById('opnieuw-knop').addEventListener('click', () => {
  if (!confirm('Alles wissen en opnieuw beginnen met het sjabloon?')) return;
  Blockly.serialization.workspaces.load(window.SJABLOON, blocklyWerkruimte);
  // ook de behaalde vinkjes wissen, anders staat alles groen bij een leeg blad
  gehaaldeStappen.clear();
  stapIndex = 0;
  // schone lei betekent ook: terug naar de blokken van stap 1 — behalve in
  // les 2, want die begint met álle blokken van les 1 in de lade
  if (window.zetLesStap) window.zetLesStap(welkeLes === 2 ? 17 : 1, true);
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
  statsOntgrendeld = false;   // de les begint weer zonder statpunten in beeld
  gelezenUitleg.clear();      // en met de uitleg er weer bij
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
  /* Een nieuwe les: het stappenpaneel moet de stappen van les 2 tonen. Zonder
     dit bleef na "iedereen naar de arena" (midden in les 1) de oude stap van
     les 1 in beeld staan, terwijl de vinkjes al stap 1 van les 2 nakeken. */
  lesGestart = false;
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
  if (nu === gewensteTeams) toast(`⚔️ ${nu} teams staan aan — je hebt je eigen teamkleur en teamzone!`);
  else if (nu === 0) toast('De teams staan uit — iedereen speelt voor zichzelf, met de gedeelde thuisbasis linksonder.');
  else toast(`Let op: er staan nu ${nu} teams aan, niet ${gewensteTeams}. De lesgever bepaalt dit op de beamer.`);
}

function kiesModus(m) {
  const naam = document.getElementById('naam').value.trim();
  if (!naam) {
    document.getElementById('naam').focus();
    meldInStartmenu('Typ eerst je naam 😊');
    return;
  }
  modus = m;
  laatsteJoin = { naam, modus: m, niveau: gekozenNiveau };
  socket.emit('join', laatsteJoin);
  document.getElementById('start-melding').classList.add('verborgen');
  /* Een nieuwe arena staat nooit op pauze. Had je vóór het menu op de rode
     stopknop gedrukt, dan bleef je speelveld anders grijs alsof alles stilstond. */
  if (!window.runtime.bevroren) document.body.classList.remove('gepauzeerd');
  document.getElementById('sprite-naam').textContent = naam;
  startmenu.classList.add('verborgen');
  document.getElementById('naam-weergave').textContent = `👤 ${naam}`;
  document.getElementById('modus-badge').textContent = m === 'solo' ? '🤖 tegen de computer' : '🧑‍🤝‍🧑 met klasgenoten';
  /*
   * De hulpknop hoort bij de les: daar zit je te bouwen en kan je vastlopen.
   * In de gedeelde arena speel je — daar roep je geen lesgever voor.
   */
  document.getElementById('hulp-knop').classList.toggle('verborgen', m !== 'solo');
  if (m !== 'solo' && hulpGevraagd) zetHulpVraag(false);
  // nu pas begint de les — anders staan er twee instructies tegelijk
  if (!lesGestart) toonStap();
  const metJoystick = window.joystickStaatAan && window.joystickStaatAan();
  if (welkeLes === 2) {
    toast(metJoystick
      ? '🎮 Rijden met de linker joystick, mikken en schieten met de rechter — dat werkt hier meteen.'
      : '🎮 Rijden met de pijltjes, mikken en schieten met de muis — dat werkt hier meteen.');
  } else if (metJoystick && !joystickUitgelegd) {
    /* Op een tablet zegt de les "pijltje omhoog" en "klik met je muis". Eén
       keer uitleggen wat daar op dit toestel mee bedoeld wordt. */
    joystickUitgelegd = true;
    toast('🕹️ Geen toetsenbord? De joystick links zijn jouw pijltjestoetsen, de joystick rechts is je muis: mikken en schieten.');
  }
}
let joystickUitgelegd = false;

document.getElementById('menu-knop').addEventListener('click', () => {
  window.runtimeStop();
  socket.emit('verlaat');
  mijnId = null;
  modus = null;
  laatsteJoin = null;   // bewust weggegaan: niet automatisch terugkeren
  startmenu.classList.remove('verborgen');
  document.getElementById('start-melding').classList.add('verborgen');
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
