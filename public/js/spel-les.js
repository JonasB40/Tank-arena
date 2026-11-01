/*
 * De les: de stappen met hun vinkjes, hulp vragen, en wat de lesgever stuurt.
 * Deel van het spel in de browser (spel-*.js, geladen in deze volgorde).
 */

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
  voorbeeld: document.getElementById('stap-voorbeeld'),
  structuur: document.getElementById('check-structuur'),
  gedrag: document.getElementById('check-gedrag'),
  breek: document.getElementById('stap-breek'),
  hint: document.getElementById('stap-hint-tekst'),
  volgende: document.getElementById('stap-volgende'),
};

/* ---------------- filmpje bij de moeilijke stappen ----------------
 * Stap 3, 4 en 7 vragen een handeling die je met woorden nauwelijks uitlegt:
 * een zeshoekje in een zeshoekig gaatje, een getal veranderen, een knop
 * indrukken die geen blok is. Een handje dat het voordoet werkt beter dan drie
 * regels tekst — zoals in LEGO Spike. Het filmpje herhaalt zich vanzelf en
 * blijft naast de opdracht staan, zodat je kan meekijken terwijl je bouwt.
 */
let animatieNr = 0;
let animatieStart = 0;

function zetAnimatie(nr) {
  const doek = document.getElementById('stap-animatie');
  const film = (window.STAP_ANIMATIES || {})[nr];
  animatieNr = film ? nr : 0;
  animatieStart = Date.now();
  doek.classList.toggle('verborgen', !film);
  /* Op een stap mét filmpje mag het paneel iets hoger: dan passen de opdracht,
     de vinkjes én het filmpje samen in beeld en hoeft er niet gescrold te
     worden. Juist op die stappen is dat het belangrijkst. */
  document.body.classList.toggle('heeft-filmpje', !!film);
  if (window.herschaalWerkveld) setTimeout(window.herschaalWerkveld, 60);
}

function tekenAnimatie() {
  requestAnimationFrame(tekenAnimatie);
  const film = (window.STAP_ANIMATIES || {})[animatieNr];
  const doek = document.getElementById('stap-animatie');
  if (!film || !doek || doek.classList.contains('verborgen')) return;
  // niet tekenen als het paneel toch niet in beeld staat (scheelt op een chromebook)
  if (!doek.getClientRects().length) return;
  const c = doek.getContext('2d');
  const B = doek.width / 2, H = doek.height / 2;   // scherp op schermen met dubbele pixels
  c.save();
  c.setTransform(2, 0, 0, 2, 0, 0);
  c.clearRect(0, 0, B, H);
  // één seconde adempauze tussen twee rondjes: dan volg je het beter
  const t = ((Date.now() - animatieStart) / 1000) % (film.duur + 1);
  try { film.teken(c, Math.min(t, film.duur), B, H); } catch { /* nooit het spel platleggen */ }
  c.restore();
}
requestAnimationFrame(tekenAnimatie);

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

/*
 * Sommige stappen vragen iets dat een kind nog nooit gedaan heeft. Stap 7 is de
 * ergste: daar moet je voor het eerst zelf een variabele AANMAKEN, en die knop
 * zit verstopt bovenaan een categorie die ze nog niet kennen. De les mag dus
 * aanwijzen: we klappen de juiste lade open en laten de knop knipperen tot ze
 * erop geklikt hebben.
 */
function wijsDeWegAan(stap) {
  const wijs = stap && stap.wijsAan;
  document.body.classList.toggle('wijs-variabeleknop', !!(wijs && wijs.knop));
  if (!wijs || !wijs.categorie || !window.openCategorie) return;
  // even wachten tot de toolbox de blokken van deze stap heeft bijgewerkt
  setTimeout(() => { try { window.openCategorie(wijs.categorie); } catch { } }, 260);
}

/* Welke uitleg heeft deze leerling al gezien? (les-stap, bv. "1-7") */
const gelezenUitleg = new Set();

function toonUitleg() {
  document.getElementById('uitleg-popup').classList.remove('verborgen');
  document.body.classList.add('uitleg-open');
}
function sluitUitleg() {
  document.getElementById('uitleg-popup').classList.add('verborgen');
  document.body.classList.remove('uitleg-open');
  // na het lezen mag de aandacht meteen naar het werkblad
  try { window.herschaalWerkveld(); } catch { }
}
document.getElementById('uitleg-sluit').addEventListener('click', sluitUitleg);
document.getElementById('uitleg-popup').addEventListener('click', (e) => {
  // alleen de donkere rand sluit; een klik in de kaart zelf niet
  if (e.target.id === 'uitleg-popup') sluitUitleg();
});
document.getElementById('stap-uitleg').addEventListener('click', toonUitleg);

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
  // werd de vorige stap nog voorgelezen? (leeshulp.js)
  if (window.stopVoorlezen) window.stopVoorlezen();
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
  document.getElementById('uitleg-stap').textContent = `Stap ${s.nr}`;
  document.getElementById('uitleg-titel').textContent = s.titel;
  /* De uitleg verschijnt bij elke stap die je voor het eerst ziet. Blader je
     terug naar iets dat je al gelezen hebt, dan blijft hij dicht — anders zit
     je bij elk stapje terug weer te klikken. */
  const sleutel = `${welkeLes}-${s.nr}`;
  if (!gelezenUitleg.has(sleutel)) { gelezenUitleg.add(sleutel); toonUitleg(); }
  elStap.doel.innerHTML = `🎯 ${doelHtml(s.doel)}`;
  // sommige stappen laten zien hoe de stapel eruit hoort te zien
  elStap.voorbeeld.innerHTML = blokHtml(s.voorbeeld || '');
  elStap.voorbeeld.classList.toggle('verborgen', !s.voorbeeld);
  zetAnimatie(welkeLes === 1 ? s.nr : 0);
  wijsDeWegAan(s);
  elStap.hint.innerHTML = `💡 ${blokHtml(s.hint)}`;
  elStap.hint.classList.add('verborgen');
  elStap.breek.innerHTML = blokHtml(s.breek || '');
  // al gelukt? dan staat de breek-oefening er meteen weer bij
  elStap.breek.classList.toggle('verborgen', !(stapKlaar && s.breek));
  elStap.volgende.disabled = !stapKlaar;
  elStap.volgende.textContent = stapIndex === stappen().length - 1 ? 'klaar! 🏆' : 'volgende ▶';
  meldStatusAanLesgever(huidigeStatus());
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

  /* Zodra de leerling zijn variabele gemaakt heeft, stopt het knipperen: de
     knop heeft zijn werk gedaan en blijft anders de aandacht opeisen. */
  if (document.body.classList.contains('wijs-variabeleknop')) {
    try {
      if (blocklyWerkruimte.getAllVariables().length > 0) {
        document.body.classList.remove('wijs-variabeleknop');
      }
    } catch { /* editor nog niet klaar */ }
  }
  const structuurOk = !!s.check.structuur(programma);
  laatsteChecks.structuur = structuurOk;
  // wat je al bewezen hebt, hoef je niet opnieuw te bewijzen: de waarnemer
  // begint bij elke stap op nul, maar een behaald vinkje blijft staan
  const gedragOk = gehaaldeStappen.has(s.nr) || !!s.check.gedrag(stapWaarnemer);
  laatsteChecks.gedrag = gedragOk;
  /* De tekst bij het vinkje mag meekijken naar wat er staat: bij stap 5 zegt
     hij "bijna! je richt-blok staat er wel in, maar niet bovenaan". Zo weet een
     kind meteen wat het nog moet doen in plaats van te blijven zoeken. */
  const sTekst = typeof s.check.structuurTekst === 'function'
    ? s.check.structuurTekst(programma) : s.check.structuurTekst;
  elStap.structuur.innerHTML = `${structuurOk ? '✓' : '○'} ${blokHtml(sTekst)}`;
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
  // meteen melden (open of weer dicht), niet pas bij de volgende ronde van vier seconden
  meldStatusAanLesgever(huidigeStatus());
});
document.getElementById('stap-inklap').addEventListener('click', () => {
  document.body.classList.toggle('stap-ingeklapt');
  setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
});

/* Commando's van de lesgever: stap sturen, bevriezen, code opvragen. */
socket.on('lesStuur', (d) => {
  if (!d) return;
  if (d.type === 'stap') {
    // de klas naar stap 3 van les 1 sturen mag een les-2-leerling niet verzetten
    if (!d.alleenJij && d.les && d.les !== welkeLes) return;
    const i = stappen().findIndex((s) => s.nr === d.stap);
    if (i >= 0 && i !== stapIndex) {
      stapIndex = i; toonStap();
      toast(d.alleenJij ? `📘 De lesgever zet jou op stap ${d.stap}` : `📘 De klas gaat naar stap ${d.stap}`);
    }
  } else if (d.type === 'bevries') {
    const was = window.runtime.bevroren;
    document.getElementById('bevroren-melding').classList.toggle('verborgen', !d.aan);
    document.body.classList.toggle('gepauzeerd', !!d.aan);
    window.runtime.bevroren = !!d.aan;   // ook de pijltjes doen even niets meer
    if (d.aan) {
      window.runtimeStop();
      // de knoppen zeggen eerlijk dat het programma stilstaat
      stopKnop.classList.add('actief');
      vlagKnop.classList.remove('actief');
    } else if (was && modus) {
      /* Het programma is gestopt tijdens het bevriezen. Zonder deze melding
         bleven kinderen wachten op een tank die niet meer uit zichzelf rijdt. */
      toast('▶ We gaan verder! Druk op de groene vlag om je programma weer te starten.');
    }
  } else if (d.type === 'bericht') {
    /* Een tip van de lesgever, vanachter zijn eigen scherm. Blijft staan tot
       de leerling hem wegklikt — een toast die na drie seconden verdwijnt
       leest een kind van tien nooit op tijd. */
    toonLesgeverBericht(d.tekst, d.aan === 'klas');
  } else if (d.type === 'opruimen') {
    try {
      blocklyWerkruimte.cleanUp();
      Blockly.renderManagement.triggerQueuedRenders();
      toast('🧹 De lesgever heeft je blokken netjes onder elkaar gezet.');
    } catch { /* editor nog niet klaar */ }
  } else if (d.type === 'werkruimte' && d.werkruimte) {
    /*
     * De lesgever heeft je blokken aangepast. We bewaren eerst wat er stond,
     * zodat je met één klik terug kan — ingrijpen mag nooit betekenen dat het
     * werk van een kind zomaar verdwijnt.
     */
    try {
      werkbladVoorIngreep = Blockly.serialization.workspaces.save(blocklyWerkruimte);
      Blockly.serialization.workspaces.load(d.werkruimte, blocklyWerkruimte);
      Blockly.renderManagement.triggerQueuedRenders();
      herstartAlsHetDraait();
      toonIngreepMelding();
    } catch { /* editor nog niet klaar */ }
  } else if (d.type === 'geluid') {
    /* De lesgever zet het geluid van de hele klas uit of weer aan. Je eigen
       🔊-keuze blijft bewaard: daarna geldt die gewoon weer. */
    zetKlasStil(!d.aan);
    const knop = document.getElementById('geluid-knop');
    knop.textContent = klasIsStil() || !geluidStaatAan() ? '🔇' : '🔊';
    knop.title = klasIsStil() ? 'De lesgever heeft het geluid van de klas uitgezet' : 'Geluid aan/uit';
    toast(d.aan ? '🔊 Het geluid mag weer aan.' : '🔇 De lesgever heeft het geluid van de klas uitgezet.');
  } else if (d.type === 'hulpKlaar') {
    zetHulpVraag(false);
    toast('✋ Je hulpvraag is afgevinkt.');
  } else if (d.type === 'naarArena') {
    if (modus !== 'samen') { startLes2(d.teams || 0); toast('🎮 De lesgever brengt iedereen naar de arena!'); }
  } else if (d.type === 'stuurCode') {
    /* We sturen niet alleen de tekst mee maar het hele werkblad. Zo ziet de
       lesgever exact dezelfde blokken als de leerling — en kan hij ze
       aanpassen en terugsturen. */
    let tekst = '(nog geen blokken)';
    let werkruimte = null;
    try { tekst = programmaAlsTekst(compileerProject()); } catch { /* editor nog niet klaar */ }
    try { werkruimte = Blockly.serialization.workspaces.save(blocklyWerkruimte); } catch { /* idem */ }
    socket.emit('mijnCode', {
      naam: document.getElementById('naam').value.trim() || 'Naamloos',
      tekst,
      werkruimte,
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

/* ---------------- hulp vragen aan de lesgever ----------------
 * Een kind dat vastzit steekt zijn hand op. Die "hand" is deze knop: hij zet
 * de leerling boven aan de lijst van de lesgever, met een belletje erbij. Zo
 * hoeft niemand te roepen of stil af te wachten tot er iemand langskomt.
 */
let hulpGevraagd = false;
function zetHulpVraag(aan, reden) {
  hulpGevraagd = !!aan;
  const k = document.getElementById('hulp-knop');
  if (k) {
    k.classList.toggle('aan', hulpGevraagd);
    k.textContent = hulpGevraagd ? '✋ hulp gevraagd' : '✋ Hulp';
    k.title = hulpGevraagd ? 'Klik nog eens als je toch verder kan' : 'Roep de lesgever erbij';
  }
  socket.emit('hulpVraag', { aan: hulpGevraagd, reden: hulpGevraagd ? reden || 'iets-anders' : null });
}
/* Eerst kiezen waarom: "mijn tank doet niets", "ik snap de opdracht niet"…
   Zo weet de lesgever wie hij eerst helpt en wat hij moet meenemen. Een kind
   dat klaar is, hoeft niet te wachten tussen wie echt vastzit. */
const hulpMenu = document.getElementById('hulp-menu');
function sluitHulpMenu() { hulpMenu.classList.add('verborgen'); }
document.getElementById('hulp-knop').addEventListener('click', () => {
  if (hulpGevraagd) {
    zetHulpVraag(false);
    toast('Hulpvraag ingetrokken.');
    return;
  }
  if (!hulpMenu.classList.contains('verborgen')) { sluitHulpMenu(); return; }
  // onder de knop, rechts uitgelijnd en altijd binnen het scherm
  const r = document.getElementById('hulp-knop').getBoundingClientRect();
  hulpMenu.style.top = `${Math.round(r.bottom + 6)}px`;
  hulpMenu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  hulpMenu.classList.remove('verborgen');
});
hulpMenu.addEventListener('click', (e) => {
  const k = e.target.closest('[data-reden]');
  if (!k) return;
  sluitHulpMenu();
  zetHulpVraag(true, k.dataset.reden);
  toast(k.dataset.reden === 'klaar'
    ? '🏁 Knap! De lesgever komt je iets nieuws geven. Probeer intussen de proef onder je opdracht.'
    : '✋ De lesgever ziet je vraag staan — werk gerust verder!');
});
// ernaast tikken sluit het menu
document.addEventListener('pointerdown', (e) => {
  const doel = e.target instanceof Element ? e.target : null;
  if (!hulpMenu.classList.contains('verborgen') && !(doel && doel.closest('#hulp-menu, #hulp-knop'))) sluitHulpMenu();
});

/* De lesgever paste je blokken aan — met één klik zet je het terug. */
let werkbladVoorIngreep = null;

/*
 * Draaide het programma al? Dan meteen opnieuw starten met de nieuwe blokken.
 * Anders bleef de tank het óúde programma uitvoeren tot de leerling zelf op de
 * groene vlag drukte — en leek het alsof de hulp van de lesgever niets deed.
 */
function herstartAlsHetDraait() {
  if (window.runtime && window.runtime.draait) window.runtimeStart();
}
function toonIngreepMelding() {
  const vak = document.getElementById('lesgever-bericht');
  vak.querySelector('.lb-kop').textContent = '👩‍🏫 De lesgever heeft je blokken aangepast';
  vak.querySelector('.lb-tekst').textContent = window.runtime && window.runtime.draait
    ? 'Je programma is meteen opnieuw gestart. Kijk maar eens wat er veranderd is. Liever je eigen versie terug?'
    : 'Kijk maar eens wat er veranderd is, en druk op de groene vlag om het uit te proberen. Liever je eigen versie terug?';
  vak.classList.remove('verborgen');
  document.getElementById('lb-terug').classList.remove('verborgen');
  speelGeluid('tada');
}
document.getElementById('lb-terug').addEventListener('click', () => {
  if (!werkbladVoorIngreep) return;
  try {
    Blockly.serialization.workspaces.load(werkbladVoorIngreep, blocklyWerkruimte);
    Blockly.renderManagement.triggerQueuedRenders();
    herstartAlsHetDraait();
    toast('↩ Je eigen blokken staan er weer.');
  } catch { /* editor nog niet klaar */ }
  document.getElementById('lesgever-bericht').classList.add('verborgen');
});

/* Een bericht van de lesgever: blijft staan tot je het wegklikt. */
function toonLesgeverBericht(tekst, naarDeKlas) {
  const vak = document.getElementById('lesgever-bericht');
  document.getElementById('lb-terug').classList.add('verborgen');
  vak.querySelector('.lb-kop').textContent = naarDeKlas ? '👩‍🏫 Bericht aan de klas' : '👩‍🏫 Bericht voor jou';
  vak.querySelector('.lb-tekst').textContent = tekst;
  vak.classList.remove('verborgen');
  speelGeluid('tada');
}
document.getElementById('lb-sluit').addEventListener('click', () => {
  document.getElementById('lesgever-bericht').classList.add('verborgen');
});

const laatsteChecks = { structuur: false, gedrag: false };

/* "Vast" zolang de hint openstaat: de knop heet niet voor niets "💡 Ik zit
   vast". Vroeger werd dat maar één keer gemeld en stond het kaartje van de
   lesgever vier seconden later alweer op "bezig". */
function huidigeStatus() {
  if (stapKlaar) return 'klaar';
  return elStap.hint.classList.contains('verborgen') ? 'bezig' : 'vast';
}

/*
 * Wat valt er op aan het programma? De meeste "hij doet niets!"-vragen zijn
 * een stapeltje dat los hangt, een programma zonder startblok, of een
 * programma dat niet (opnieuw) gestart is. Dat ziet de lesgever nu op het
 * kaartje, nog voor hij de blokken opent of naar de tafel loopt.
 */
function programmaDiagnose() {
  const d = { los: 0, geenStart: false, draait: false, verouderd: false };
  try {
    const stapels = blocklyWerkruimte.getTopBlocks(false).filter((b) => b.isEnabled() && !b.isShadow());
    d.los = losseStapels(blocklyWerkruimte).length;
    d.geenStart = stapels.length > 0 && !stapels.some((b) => triggerVan(b));
  } catch { /* editor nog niet klaar */ }
  const rt = window.runtime;
  d.draait = !!(rt && rt.draait);
  d.verouderd = !!(rt && rt.draait && rt.verouderd);
  return d;
}

function meldStatusAanLesgever(status) {
  if (!lesGestart) return;
  let blokken = 0;
  try { blokken = blocklyWerkruimte.getAllBlocks(false).length; } catch { /* editor nog niet klaar */ }
  const nu = vingerafdrukVanWerkblad();
  if (nu !== laatsteVingerafdruk) { laatsteVingerafdruk = nu; laatsteWijziging = Date.now(); }
  socket.emit('lesStatus', Object.assign(programmaDiagnose(), {
    naam: document.getElementById('naam').value.trim() || 'Naamloos',
    les: welkeLes,
    stap: stappen()[stapIndex].nr,
    status,
    blokken,
    stilMs: Date.now() - laatsteWijziging,
    /* Welke vinkjes staan al groen, en welke projectcode heeft hij? Daarmee
       ziet de lesgever waar het misloopt zonder eerst te moeten vragen. */
    checkS: laatsteChecks.structuur,
    checkG: laatsteChecks.gedrag,
    /* Welke stappen haalde hij al, en staat zijn hint open? Zo ziet de
       lesgever naast de blokken ook hoe ver hij is en waar hij op vastloopt. */
    gehaald: [...gehaaldeStappen],
    hint: !elStap.hint.classList.contains('verborgen'),
    code: projectCode || '',
  }));
}
setInterval(() => meldStatusAanLesgever(huidigeStatus()), 4000);

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
