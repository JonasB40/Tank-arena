/*
 * De Scratch-achtige blokkeneditor (Blockly).
 * Zelfde categorieën, kleuren en formuleringen als echt Scratch:
 * Beweging, Uiterlijken, Gebeurtenissen, Besturen, Waarnemen, Operators,
 * Variabelen — plus een kleine categorie Gevecht voor het tankspel.
 *
 * De blokken worden gecompileerd naar een veilig JSON-programma (geen eval),
 * dat runtime.js in de browser uitvoert zoals Scratch dat doet (hat-blokken,
 * herhaal continu = 1 rondje per tik, wacht-blokken...).
 *
 * De blokken zelf staan in blokken.js, het omzetten naar een programma in
 * compiler.js en de voorbeeldoplossing in voorbeeld.js.
 */

/*
 * De knop "Maak een variabele" tekent Blockly krap: de tekst raakt bijna de
 * rand en de knop is maar 26 px hoog, waardoor hij er plat en onaf uitzag (en
 * op een touchscreen te klein is om te tikken). We geven hem echte binnenmarge
 * vóórdat de lade zijn indeling berekent — daarna zou de knop over het eerste
 * blok heen vallen. De ronde vorm en kleur staan in style.css.
 */
const origKnopDom = Blockly.FlyoutButton.prototype.createDom;
Blockly.FlyoutButton.prototype.createDom = function () {
  const svg = origKnopDom.call(this);
  if (this.isLabel && this.isLabel()) return svg;   // categoriekopjes ongemoeid
  // De lade tekent op 0,68x, dus in eenheden moet het royaal zijn om op het
  // scherm normaal te ogen. Met een vinger erbij mag het nog iets ruimer.
  const grofAanwijzer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  this.width += grofAanwijzer ? 34 : 26;
  this.height += grofAanwijzer ? 30 : 20;
  for (const rect of svg.querySelectorAll('rect')) {
    rect.setAttribute('width', this.width);
    rect.setAttribute('height', this.height);
  }
  const tekst = svg.querySelector('text');
  if (tekst) {
    tekst.setAttribute('x', this.width / 2);
    tekst.setAttribute('y', this.height / 2 + 5);   // optisch gecentreerd
  }
  return svg;
};

/* ------------------------------------------------------------------ */
/* Gereedschapskist (met invulbare getal-schaduwen zoals in Scratch)   */
/* ------------------------------------------------------------------ */
const num = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const hoek = (v) => ({ shadow: { type: 'hoek_getal', fields: { NUM: v } } });

/*
 * Zet bovenaan elke categorie een kop met de naam erin, zoals Scratch doet.
 * Omdat de lade permanent openstaat zie je anders alleen losse blokken en
 * weet je niet meer in welke categorie je zit.
 */
function metKoppen(toolbox) {
  for (const cat of toolbox.contents) {
    if (cat.kind !== 'category' || !Array.isArray(cat.contents)) continue;
    cat.contents = [{ kind: 'label', text: cat.name, 'web-class': 'lade-kop' }, ...cat.contents];
  }
  return toolbox;
}

/*
 * Blokken komen mee met de les. Bij stap 1 staan er maar twee blokken in de
 * lade; elke stap ontgrendelt precies wat je nodig hebt (plus wat bij die stap
 * hoort om mee te spelen). Zo hoeft een kind van 8 niet tussen veertig blokken
 * te zoeken naar het ene dat hij zoekt.
 *
 * Wat eenmaal ontgrendeld is, blijft staan — ook als je terugbladert. En 🚀
 * Expert toont gewoon álles, voor wie vooruit wil of voor de lesgever.
 */
const STAP_BLOKKEN = {
  1: ['hat_start', 'neem_stappen'],
  2: ['herhaal_continu'],
  3: ['als_blok', 'toets_ingedrukt', 'richt_rij'],
  4: [],                                   // zelfde patroon, drie keer herhalen
  5: ['richt_muis'],
  6: ['muis_ingedrukt', 'schiet_blok', 'hat_toets'],  // hat_toets: de breek-oefening
  7: ['VARIABELEN'],                       // de hele oranje categorie
  8: ['raak_ik'],
  9: ['op_reken', 'kracht_kogel'],
  10: ['op_vergelijk', 'zeg_blok'],
  11: ['zet_kleur'],
  12: ['hat_versla', 'hat_dood', 'flits_blok', 'speel_geluid', 'hat_levelup', 'toon_upgrade', 'richt_naar'],
  13: ['stat_waarde', 'waarneem_blok'],
  14: ['hat_statpunt', 'stat_geef', 'als_anders_blok', 'op_en', 'op_of', 'word_klasse'],
  15: ['herhaal_n', 'wacht_blok'],
  /* Les 2 is een losse vervolgsessie: alles van les 1 staat er al, plus de
     twee blokken die je nodig hebt om over je teamzone te redeneren. Stap 17
     bestaat niet in les 1, dus in de workshop komt dit nooit tevoorschijn. */
  17: ['in_basis', 'op_niet', 'wacht_tot', 'zend_signaal', 'hat_signaal', 'beste_score', 'mijn_plaats'],
};

let lesStap = 1;   // hoogste stap die de leerling gezien heeft

function ontgrendeld() {
  const uit = new Set();
  for (const [nr, blokken] of Object.entries(STAP_BLOKKEN)) {
    if (Number(nr) <= lesStap) for (const b of blokken) uit.add(b);
  }
  return uit;
}

/* Blokken met 🚀 verschijnen alleen in Expert-modus. */
const bouwToolboxRuw = (expert) => ({ kind: 'categoryToolbox', contents: [
  // "Gebeurtenis" enkelvoud: past op één regel in de smalle categoriekolom
  { kind: 'category', name: 'Gebeurtenis', colour: SCRATCH_KLEUR.gebeurtenissen, contents: [
    { kind: 'block', type: 'hat_start' },
    { kind: 'block', type: 'hat_toets' },
    // hat_geraakt staat er bewust niet meer bij: levens bijhouden doen we nu
    // met "als raak ik een vijandelijke kogel?" in de herhaal-lus (stap 7).
    // Het blok blijft wél bestaan zodat oude projectcodes blijven werken.
    { kind: 'block', type: 'hat_levelup' },
    // niet meer Expert-only: stap 14 van de les heeft dit blok nodig
    { kind: 'block', type: 'hat_statpunt' },
    { kind: 'block', type: 'hat_versla' },
    { kind: 'block', type: 'hat_dood' },
    // signalen: nodig vanaf stap 16 (beloning loskoppelen van de gebeurtenis)
    { kind: 'block', type: 'zend_signaal' },
    { kind: 'block', type: 'hat_signaal' },
  ] },
  { kind: 'category', name: 'Beweging', colour: SCRATCH_KLEUR.beweging, contents: [
    // sturen zoals in Scratch: richting kiezen, dan stappen zetten
    { kind: 'block', type: 'richt_rij', inputs: { HOEK: hoek(90) } },
    { kind: 'block', type: 'neem_stappen', inputs: { N: num(10) } },
    { kind: 'block', type: 'richt_muis' },
    { kind: 'block', type: 'richt_naar' },
    ...(expert ? [
      { kind: 'block', type: 'beweeg_stappen', inputs: { N: num(10) } },
      { kind: 'block', type: 'draai_geschut', inputs: { N: num(15) } },
      { kind: 'block', type: 'richt_graden', inputs: { HOEK: hoek(90) } },
    ] : []),
  ] },
  { kind: 'category', name: 'Gevecht', colour: SCRATCH_KLEUR.gevecht, contents: [
    { kind: 'block', type: 'schiet_blok' },
    { kind: 'block', type: 'toon_upgrade' },
  ] },
  { kind: 'category', name: 'Upgrades', colour: SCRATCH_KLEUR.tank, contents: [
    { kind: 'block', type: 'stat_geef' },
    { kind: 'block', type: 'stat_waarde' },
    ...(expert ? [{ kind: 'block', type: 'stat_punten' }] : []),
  ] },
  { kind: 'category', name: 'Uiterlijken', colour: SCRATCH_KLEUR.uiterlijken, contents: [
    { kind: 'block', type: 'zeg_blok' },
    { kind: 'block', type: 'zet_kleur' },
    { kind: 'block', type: 'word_klasse' },
    { kind: 'block', type: 'flits_blok' },
    { kind: 'block', type: 'speel_geluid' },
  ] },
  { kind: 'category', name: 'Besturen', colour: SCRATCH_KLEUR.besturen, contents: [
    { kind: 'block', type: 'wacht_blok', inputs: { SEC: num(1) } },
    // wacht_tot idem: het stap-filter laat dit bij les 2 verschijnen
    { kind: 'block', type: 'wacht_tot' },
    { kind: 'block', type: 'herhaal_n', inputs: { N: num(10) } },
    { kind: 'block', type: 'herhaal_continu' },
    { kind: 'block', type: 'als_blok' },
    { kind: 'block', type: 'als_anders_blok' },
  ] },
  { kind: 'category', name: 'Waarnemen', colour: SCRATCH_KLEUR.waarnemen, contents: [
    { kind: 'block', type: 'toets_ingedrukt' },
    { kind: 'block', type: 'muis_ingedrukt' },
    { kind: 'block', type: 'waarneem_blok' },
    { kind: 'block', type: 'raak_ik' },      // nodig vanaf stap 7 (levens bijhouden)
    { kind: 'block', type: 'kracht_kogel' },
    // ranglijst: pas ontgrendeld in les 2 (toernooi)
    { kind: 'block', type: 'beste_score' },
    { kind: 'block', type: 'mijn_plaats' },
    // in_basis zit niet meer achter Expert: het stap-filter regelt dit nu
    // (het verschijnt bij les 2, waar je over je teamzone moet nadenken)
    { kind: 'block', type: 'in_basis' },
    ...(expert ? [{ kind: 'block', type: 'stopwatch' }] : []),
  ] },
  { kind: 'category', name: 'Operators', colour: SCRATCH_KLEUR.operators, contents: [
    { kind: 'block', type: 'op_reken', inputs: { A: num(1), B: num(1) } },
    { kind: 'block', type: 'op_vergelijk', inputs: { A: num(10), B: num(50) } },
    { kind: 'block', type: 'op_en' },
    { kind: 'block', type: 'op_of' },
    // op_niet idem: nodig bij les 2 ("niet in mijn basis"), tot dan verborgen
    { kind: 'block', type: 'op_niet' },
    ...(expert ? [
      { kind: 'block', type: 'op_willekeurig', inputs: { A: num(1), B: num(10) } },
    ] : []),
  ] },
  /* Echte Scratch-variabelen: "Maak een variabele"-knop + dropdown-blokken,
     aangevuld met de alleen-lezen spelvariabelen (score, statpunten...). */
  { kind: 'category', name: 'Variabelen', colour: SCRATCH_KLEUR.variabelen, custom: 'VARIABELEN_PLUS' },
] });

/*
 * In Starter-modus houden we alleen de blokken over die de les tot hier
 * ontgrendeld heeft. Categorieën die daardoor leeg vallen laten we helemaal
 * weg — een lege categorie met alleen een kopje ziet eruit als een defect.
 */
function filterOpLes(toolbox) {
  const open = ontgrendeld();
  toolbox.contents = toolbox.contents.filter((cat) => {
    if (cat.custom === 'VARIABELEN_PLUS') return open.has('VARIABELEN');
    if (!Array.isArray(cat.contents)) return true;
    cat.contents = cat.contents.filter((item) => item.kind !== 'block' || open.has(item.type));
    return cat.contents.length > 0;
  });
  return toolbox;
}

const bouwToolbox = (expert) => metKoppen(expert ? bouwToolboxRuw(true) : filterOpLes(bouwToolboxRuw(false)));

let expertModus = false;
const TOOLBOX = bouwToolbox(false);

/* ------------------------------------------------------------------ */
/* Blockly opstarten                                                   */
/* ------------------------------------------------------------------ */
/* Blokken laten "happen" van verder weg, zodat ze makkelijk ín een
   herhaal- of als-blok klikken — kinderen mikken minder precies dan volwassenen. */
if (Blockly.config) {
  Blockly.config.snapRadius = 44;
  Blockly.config.connectingSnapRadius = 64;
}

/*
 * Zoals in Scratch: sleep je een herhaal- of als-blok over een stapel, dan
 * WIKKELT het zich om die blokken heen in plaats van erboven te plakken.
 * Blockly kiest normaal gewoon de dichtstbijzijnde verbinding; wij geven de
 * "mond" van een C-blok voorrang zodat het wikkelen bijna altijd wint.
 */
/**
 * Hangt een stapel over naar een andere verbinding. Lukt dat niet, dan zetten
 * we hem terug waar hij stond — nooit blokken los laten rondzweven.
 */
function verplaatsStapel(vanConnectie, naarConnectie, stapel) {
  vanConnectie.disconnect();
  try {
    naarConnectie.connect(stapel.previousConnection);
  } catch {
    try { vanConnectie.connect(stapel.previousConnection); } catch { /* opgeven */ }
  }
}

/**
 * Een "herhaal"-lus draait eeuwig, dus blokken eronder komen nooit aan de
 * beurt. Die schuiven we automatisch de lus in (onderaan), zodat er geen code
 * stilletjes doodligt — in Scratch kan je er niet eens iets onder hangen.
 *
 * Uitzondering: bij stap 2 vraagt de breek-oefening juist om het beweeg-blok
 * ÓNDER de lus te hangen. Repareren we dan, dan kan de leerling nooit zien wat
 * er misgaat — en dáár zit precies het inzicht van die stap.
 */
function ruimDodeBlokkenOp(werkruimte) {
  if (window.huidigeStapNr === 2) return;
  // op het dashboard wil de lesgever precies zien wat de leerling gebouwd heeft
  if (window.geenAutoReparatie) return;
  for (const blok of werkruimte.getAllBlocks(false)) {
    if (blok.type !== 'herhaal_continu') continue;
    if (!blok.nextConnection || !blok.nextConnection.isConnected()) continue;
    const stapel = blok.nextConnection.targetBlock();
    const mond = blok.getInput('DOEN') && blok.getInput('DOEN').connection;
    if (!stapel || !stapel.previousConnection || !mond) continue;

    // achteraan in de lus aanhaken
    let doel = mond;
    if (mond.isConnected()) {
      let laatste = mond.targetBlock();
      while (laatste.nextConnection && laatste.nextConnection.isConnected()) {
        laatste = laatste.nextConnection.targetBlock();
      }
      if (!laatste.nextConnection) continue;
      doel = laatste.nextConnection;
    }
    verplaatsStapel(blok.nextConnection, doel, stapel);
  }
}

(function maakWikkelenMakkelijk() {
  /* Dit leunt op de binnenkant van Blockly 11.2. Daarom staat die versie vast
     in package.json; past een nieuwere versie niet meer, dan zie je het hier
     (en in "npm test") in plaats van dat het wikkelen stilletjes stopt. */
  const strategie = Blockly.dragging && Blockly.dragging.BlockDragStrategy;
  if (!strategie || !strategie.prototype.getConnectionCandidate || !strategie.prototype.endDrag) {
    console.warn('Tank Arena: deze Blockly-versie past niet bij het makkelijke wikkelen — blijf bij Blockly 11.2.2');
    window.wikkelenWerkt = false;
    return;
  }
  window.wikkelenWerkt = true;
  const origineel = strategie.prototype.getConnectionCandidate;

  /** Is dit de opening ("mond") van een C-blok? Dan kan het ergens omheen. */
  const isMond = (verbinding) => {
    try {
      return verbinding.type === Blockly.NEXT_STATEMENT && !!verbinding.getParentInput();
    } catch { return false; }
  };

  /* Het vangnet: zet een leerling een herhaal- of als-blok met een lege mond
     vlak bóven een stapel, dan schuift die stapel er na het loslaten vanzelf
     ín — precies wat je in Scratch verwacht, zonder millimeterwerk. */
  const origEnd = strategie.prototype.endDrag;
  strategie.prototype.endDrag = function (...args) {
    const blok = this.block;
    const uitkomst = origEnd.apply(this, args);
    try {
      if (blok && blok.nextConnection && blok.nextConnection.isConnected()) {
        const mond = blok.inputList
          .map((invoer) => invoer.connection)
          .find((c) => c && c.type === Blockly.NEXT_STATEMENT && !c.isConnected());
        const stapel = blok.nextConnection.targetBlock();
        if (mond && stapel && stapel.previousConnection) {
          verplaatsStapel(blok.nextConnection, mond, stapel);
        }
      }
      // een "herhaal"-lus draait eeuwig: onder de lus zou niets ooit gebeuren
      if (blok && blok.workspace) ruimDodeBlokkenOp(blok.workspace);
    } catch { /* past niet: laat gewoon staan zoals het is */ }
    return uitkomst;
  };

  strategie.prototype.getConnectionCandidate = function (blok, verschuiving) {
    try {
      const lokale = this.getLocalConnections(blok);
      const straal = this.connectionCandidate
        ? Blockly.config.connectingSnapRadius
        : Blockly.config.snapRadius;
      let beste = null;
      let besteScore = Infinity;
      for (const eigen of lokale) {
        // let op: we verkleinen de zoekstraal NIET tussendoor, zodat de mond
        // ook nog meedingt als een andere verbinding toevallig dichterbij is
        const { connection: buur, radius: afstand } = eigen.closest(straal, verschuiving);
        if (!buur) continue;
        const score = afstand * (isMond(eigen) ? 0.45 : 1); // wikkelen krijgt voorrang
        if (score < besteScore) {
          besteScore = score;
          beste = { local: eigen, neighbour: buur, distance: afstand };
        }
      }
      return beste;
    } catch {
      return origineel.call(this, blok, verschuiving); // bij twijfel: Blockly's eigen gedrag
    }
  };
})();

const werkruimte = Blockly.inject('blocklyDiv', {
  toolbox: TOOLBOX,
  renderer: 'zelos',
  // iets kleiner dan voorheen (0.8): de blokkenlade staat nu permanent open,
  // en op 0.8 slokte die bijna de halve werkruimte op. Zoomen kan nog met +/-.
  // Niet verder dan 1.6: op een iPad knijp je al snel te ver, en op 3 (wat
  // Blockly toelaat) paste er geen enkel stapeltje meer in beeld.
  zoom: { controls: true, startScale: 0.68, maxScale: 1.6, minScale: 0.35 },
  // stippenraster op het werkveld (zoals Scratch): meteen zichtbaar waar de
  // keuzeblokken ophouden en jouw eigen programma begint
  grid: { spacing: 36, length: 2, colour: '#c9cede', snap: false },
  trashcan: true,
  collapse: true,   // rechtsklikken op een stapeltje → inklappen
  theme: Blockly.Theme.defineTheme('stemazing', {
    base: Blockly.Themes.Classic,
    // Gebeurtenisblokken krijgen de ronde "hoed" van Scratch. Blockly zet die
    // op elk blok zonder verbinding naar boven — precies onze hat-blokken. Zo
    // zie je meteen dat er niets bovenop kan: een gebeurtenis begint een
    // stapeltje, hij hangt nooit ergens onder.
    startHats: true,
    blockStyles: {
      // eigen variabelen in Scratch-oranje
      variable_blocks: { colourPrimary: '#FF8C1A', colourSecondary: '#DB6E00', colourTertiary: '#DB6E00' },
      variable_dynamic_blocks: { colourPrimary: '#FF8C1A', colourSecondary: '#DB6E00', colourTertiary: '#DB6E00' },
      math_blocks: { colourPrimary: '#59C059', colourSecondary: '#46A946', colourTertiary: '#46A946' },
    },
    componentStyles: {
      // De lade is wit, het werkveld iets grijzer met een raster erin. Eerst
      // hadden beide dezelfde kleur, waardoor de blokken die je nog moet kiezen
      // niet te onderscheiden waren van de blokken die je al gebouwd hebt.
      workspaceBackgroundColour: '#eef0f5',
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#575e75',
      flyoutBackgroundColour: '#ffffff',
      flyoutForegroundColour: '#575e75',
      scrollbarColour: '#cecdce',
    },
  }),
});

/* Variabelen-categorie: Blockly's eigen "Maak een variabele"-knop en
   dropdown-blokken, plus de alleen-lezen spelvariabelen eronder. */
werkruimte.registerToolboxCategoryCallback('VARIABELEN_PLUS', (ws) => {
  const els = Blockly.Variables.flyoutCategory(ws);
  // toon/verberg-blokken (alleen als er al een variabele bestaat)
  if (expertModus && ws.getAllVariables().length) {
    for (const type of ['var_toon', 'var_verberg']) {
      const blok = document.createElement('block');
      blok.setAttribute('type', type);
      els.push(blok);
    }
  }
  const label = document.createElement('label');
  label.setAttribute('text', 'Variabelen van het spel (die verandert het spel zelf):');
  els.push(label);
  const spel = expertModus
    ? ['waarde_blok', 'stat_waarde', 'stat_punten', 'stopwatch']
    : ['waarde_blok'];
  for (const type of spel) {
    const blok = document.createElement('block');
    blok.setAttribute('type', type);
    els.push(blok);
  }
  return els;
});

/*
 * Eigen "Nieuwe variabele"-venster in plaats van de kale prompt() van de
 * browser — zelfde opzet als in Scratch, inclusief de keuze tussen "voor alle
 * sprites" en "alleen voor deze sprite". Die keuze verandert bij ons nog niets
 * (we hebben één sprite), maar leerlingen herkennen het venster later meteen
 * terug in het echte Scratch.
 */
/*
 * Eén tekstvenster voor twee dingen: een nieuwe variabele maken (mét de
 * Scratch-keuzerondjes) en gewoon een stukje tekst vragen. Zonder dat
 * onderscheid kreeg je "Nieuwe variabele" te zien als je je tank iets wilde
 * laten zéggen.
 */
function vraagTekst({ titel, label, waarde, toonBereik }, klaar) {
  const overlay = document.getElementById('var-overlay');
  const veld = document.getElementById('var-naam');
  // ontbreekt een stukje van het venster, dan de gewone vraag van de browser
  // (anders liep "Maak een variabele" stil vast op een fout)
  const nodig = ['#var-kop span', 'label[for="var-naam"]', '#var-bereik', '#var-uitleg', '#var-ok', '#var-annuleer', '#var-kruis'];
  if (!overlay || !veld || nodig.some((s) => !overlay.querySelector(s))) {
    klaar(window.prompt(label, waarde || ''));
    return;
  }

  overlay.querySelector('#var-kop span').textContent = titel;
  overlay.querySelector('label[for="var-naam"]').textContent = label;
  overlay.querySelector('#var-bereik').classList.toggle('verborgen', !toonBereik);
  overlay.querySelector('#var-uitleg').classList.toggle('verborgen', !toonBereik);

  veld.value = waarde || '';
  const alle = overlay.querySelector('input[name="var-bereik"][value="alle"]');
  if (alle) alle.checked = true;
  overlay.classList.remove('verborgen');
  setTimeout(() => { veld.focus(); veld.select(); }, 0);

  const sluit = (naam) => {
    overlay.classList.add('verborgen');
    veld.removeEventListener('keydown', opToets);
    klaar(naam);
  };
  const bevestig = () => sluit(veld.value.trim() || null);
  const opToets = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); bevestig(); }
    if (e.key === 'Escape') { e.preventDefault(); sluit(null); }
  };
  veld.addEventListener('keydown', opToets);
  overlay.querySelector('#var-ok').onclick = bevestig;
  overlay.querySelector('#var-annuleer').onclick = () => sluit(null);
  overlay.querySelector('#var-kruis').onclick = () => sluit(null);
}

Blockly.dialog.setPrompt((boodschap, standaard, klaar) => {
  // alleen bij het maken van een variabele hoort het venster mét keuzerondjes
  const isVariabele = String(boodschap || '').toLowerCase().includes('variabele');
  vraagTekst({
    titel: isVariabele ? 'Nieuwe variabele' : 'Tekst typen',
    label: boodschap || 'Typ je tekst:',
    waarde: standaard,
    toonBereik: isVariabele,
  }, klaar);
});

/*
 * De blokkenlade blijft altijd openstaan, precies zoals in Scratch. Eerst moest
 * je een categorie aanklikken om blokken te zien en klapte de lade weer dicht
 * zodra je iets sleepte — daardoor verloren leerlingen het overzicht over wat
 * er allemaal bestaat. Nu staan de blokken permanent naast de categorieën.
 */
function houdLadeOpen() {
  const lade = werkruimte.getToolbox();
  if (!lade) return;
  const flyout = lade.getFlyout && lade.getFlyout();
  /* Op het lesgeversdashboard is het blokkenvenster smal en wil je vooral het
     programma van de leerling zien: daar blijft de lade dicht tot je op een
     categorie klikt, en klapt ze weer dicht zodra je een blok eruit sleept. */
  if (window.ladeDicht) {
    if (flyout) flyout.autoClose = true;
    if (lade.getSelectedItem()) lade.clearSelection();
    kleurCategorieBollen();
    Blockly.svgResize(werkruimte);
    return;
  }
  if (flyout) flyout.autoClose = false;
  if (!lade.getSelectedItem()) lade.selectItemByPosition(0);
  kleurCategorieBollen();
  Blockly.svgResize(werkruimte);
}

/* Blockly zet de categoriekleur op de linkerrand van elke rij. Wij tekenen er
   een bolletje mee (zie style.css), dus we halen die kleur op en geven hem
   door als CSS-variabele. */
function kleurCategorieBollen() {
  for (const rij of document.querySelectorAll('.blocklyToolboxDiv .blocklyTreeRow')) {
    const kleur = rij.style.borderLeftColor || getComputedStyle(rij).borderLeftColor;
    if (kleur && kleur !== 'rgba(0, 0, 0, 0)') rij.style.setProperty('--cat-kleur', kleur);
  }
}
houdLadeOpen();

/*
 * De blokkenlade zoomt mee met het werkblad. Op een iPad werd ze bij het
 * inzoomen zo breed dat ze bijna het hele werkblad bedekte: een blok dat je
 * neerlegde viel op de lade (en verdween), en de knoppen erachter kon je niet
 * meer aantikken. Kinderen zaten dan echt vast. De lade groeit nu niet verder
 * dan dit; je eigen blokken zoomen gewoon verder.
 */
const LADE_MAX_ZOOM = 0.85;
(function () {
  const lade = werkruimte.getToolbox() && werkruimte.getToolbox().getFlyout();
  if (lade && lade.getFlyoutScale) {
    lade.getFlyoutScale = function () { return Math.min(this.targetWorkspace.scale, LADE_MAX_ZOOM); };
  }
})();

/*
 * Blockly rekent zijn maten alleen opnieuw uit bij een window-resize. Ons
 * werkveld verandert echter ook zónder dat: het stappenpaneel wordt hoger of
 * lager per stap, je klapt het in, of je kiest een ander podiumformaat
 * (▫ ◻ ⛶). Gebeurde dat, dan bleef de blokkenlade even hoog als daarvóór: hij
 * stak onder het scherm uit én de scroll stopte te vroeg, waardoor je niet
 * meer bij de onderste blokken kon. Een ResizeObserver vangt élke oorzaak.
 */
window.herschaalWerkveld = function () {
  Blockly.svgResize(werkruimte);
  const lade = werkruimte.getToolbox();
  if (!lade) return;
  lade.position();
  const flyout = lade.getFlyout();
  if (flyout) flyout.position();
};

/* De observer is het vangnet; de les roept herschaalWerkveld() ook zelf aan
   na elke stap, want dáár verandert de hoogte van het paneel het vaakst. */
let herschalenGepland = false;
new ResizeObserver(() => {
  if (herschalenGepland) return;      // niet in een lus met onszelf terechtkomen
  herschalenGepland = true;
  setTimeout(() => { herschalenGepland = false; window.herschaalWerkveld(); }, 0);
}).observe(document.getElementById('blocklyDiv'));

/*
 * Ruimte maken op het werkblad. Naarmate de les vordert staan er vijf, zes
 * losse stapeltjes op een vrij smal veld. "Opruimen" zet ze netjes onder
 * elkaar; "Inklappen" maakt elk afgewerkt stapeltje één klein balkje, zodat
 * het stapeltje waar je nu aan werkt gewoon in beeld past. Beide zijn
 * omkeerbaar — er gaat nooit een blok verloren.
 */
document.getElementById('knop-opruimen').addEventListener('click', () => {
  werkruimte.cleanUp();
});

const knopInklappen = document.getElementById('knop-inklappen');
knopInklappen.addEventListener('click', () => {
  const stapels = werkruimte.getTopBlocks(false).filter((b) => b.nextConnection || b.previousConnection);
  if (!stapels.length) return;
  const alsIngeklapt = stapels.every((b) => b.isCollapsed());
  for (const b of stapels) b.setCollapsed(!alsIngeklapt);
  /*
   * Inklappen alleen leverde nauwelijks ruimte op: de balkjes bleven staan
   * waar hun stapel stond, dus alle witruimte ertussen bleef even groot. Door
   * daarna op te ruimen schuiven ze echt tegen elkaar aan bovenaan, en pas
   * dán heb je een leeg werkblad om verder te bouwen. Bij uitklappen doen we
   * hetzelfde, anders zouden de stapels over elkaar heen komen te staan.
   */
  /* Pas opruimen NADAT Blockly de nieuwe maten getekend heeft. Blockly tekent
     in- en uitklappen namelijk pas bij het volgende beeldje; doe je cleanUp()
     meteen, dan rekent hij nog met de oude hoogtes en zet hij de balkjes juist
     verder uit elkaar — precies het omgekeerde van wat de knop belooft.
     triggerQueuedRenders() dwingt dat tekenen nu meteen af. */
  Blockly.renderManagement.triggerQueuedRenders();
  werkruimte.cleanUp();
  werkruimte.scrollCenter();
  // alleen het label wisselen: het pijltje is een SVG en die mag niet gewist
  // worden door textContent (dat was met de emoji-versie nog wél zo)
  document.getElementById('label-inklappen').textContent = alsIngeklapt ? 'Inklappen' : 'Uitklappen';
  knopInklappen.classList.toggle('toont-uitklappen', !alsIngeklapt);
});

/* Starter/Expert-schakelaar: Expert toont de extra blokken. */
const knopStarter = document.getElementById('modus-starter');
const knopExpert = document.getElementById('modus-expert');
function zetModus(expert) {
  expertModus = expert;
  knopStarter.classList.toggle('actief', !expert);
  knopExpert.classList.toggle('actief', expert);
  vernieuwToolbox();
}
knopStarter.addEventListener('click', () => zetModus(false));
knopExpert.addEventListener('click', () => zetModus(true));

function vernieuwToolbox() {
  werkruimte.updateToolbox(bouwToolbox(expertModus));
  houdLadeOpen(); // updateToolbox sluit de lade weer — meteen heropenen
}

/*
 * De les vertelt ons bij welke stap de leerling zit; daar horen de blokken bij.
 * Standaard schuift dit alleen vooruit (terugbladeren mag geen blokken laten
 * verdwijnen die je al gebruikt). Met reset=true begint hij opnieuw bij stap 1
 * — dat doet de 🗑-knop, samen met een leeg werkblad.
 */
/*
 * Een categorie openklappen vanuit de les. Bij stap 7 komt "variabele" voor het
 * eerst voorbij: dan zoeken kinderen zich blind naar die ene knop. De les kan
 * de juiste lade nu zelf openzetten en de knop laten knipperen.
 */
window.openCategorie = function (naam) {
  try {
    const tb = werkruimte.getToolbox();
    const items = tb.getToolboxItems();
    const i = items.findIndex((it) => (it.getName && it.getName()) === naam);
    if (i >= 0) tb.selectItemByPosition(i);
    return i >= 0;
  } catch { return false; }
};

window.zetLesStap = function (nr, reset) {
  const nieuw = reset ? nr : Math.max(lesStap, nr);
  if (nieuw === lesStap && !reset) return;
  lesStap = nieuw;
  if (!expertModus) vernieuwToolbox();
};

Blockly.serialization.workspaces.load(SJABLOON, werkruimte);

/* Ook bij het laden van een project: nooit blokken onder een herhaal-lus laten
   liggen waar ze nooit aan de beurt komen. We hangen dit NIET aan het
   FINISHED_LOADING-event — bij programmatisch laden stuurt Blockly helemaal
   geen events, dus dan werd een opgeslagen kapot project nooit hersteld. */
const origLaad = Blockly.serialization.workspaces.load;
Blockly.serialization.workspaces.load = function (staat, ws, ...rest) {
  const uitkomst = origLaad.call(this, staat, ws, ...rest);
  try { ruimDodeBlokkenOp(ws); } catch { }
  // en meteen tonen welke stapeltjes niets doen (zie onderaan)
  if (ws === werkruimte) planLosseStapels();
  return uitkomst;
};

/* ------------------------------------------------------------------ */
/* Uitleg per blok: klik op een blok en lees wat het doet.             */
/* ------------------------------------------------------------------ */
const UITLEG = {
  hat_start: '🚩 Startblok: alles wat hieronder hangt, begint als je op de groene vlag boven het speelveld klikt.',
  hat_toets: '🚩 Gebeurtenis: start dit stapeltje zodra je de toets indrukt. Wil je in een herhaal-lus kíjken of een toets ingedrukt is? Gebruik dan het blauwe "toets … ingedrukt?" uit Waarnemen.',
  hat_geraakt: '🚩 Gebeurtenis: gebeurt telkens als een kogel (of rammer) jouw tank raakt.',
  hat_levelup: '🚩 Gebeurtenis: gebeurt als je genoeg punten hebt voor een nieuw level. Handig om de upgrade-keuze te tonen!',
  hat_dood: '🚩 Gebeurtenis: gebeurt als je tank kapot gaat. Je komt daarna zwakker terug.',
  beweeg_richting: 'Beweegt je tank één stapje in die richting. Zet dit in "herhaal continu" om te blijven rijden zolang een toets ingedrukt is.',
  richt_muis: 'Draait je geschut altijd naar de muiscursor — zoals in diep.io. De muis is INVOER, het draaien is UITVOER.',
  richt_graden: '🧭 Draait het geschut naar een vaste hoek, met dezelfde graden als in Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.',
  schiet_blok: 'Vuurt een kogel af (als je geschut herladen is). Hoe hoger je herlaadsnelheid, hoe sneller je opnieuw kan schieten.',
  toon_upgrade: 'Opent het keuzevenster voor statpunten of een nieuwe tankklasse — als je iets te kiezen hebt.',
  zeg_blok: 'Laat je tank iets zeggen in een tekstballon. Iedereen in de arena ziet het!',
  zet_kleur: 'Verandert de kleur van je tank.',
  flits_blok: 'Laat je tank heel even flitsen in een kleur. Leuk als reactie op "wanneer ik geraakt word".',
  speel_geluid: '🔊 Speelt een kort geluidje op jouw computer. Koppel het aan een gebeurtenis: boing als je geraakt wordt!',
  wacht_blok: 'Pauzeert dit stapeltje blokken zoveel seconden. De rest van je programma loopt gewoon door.',
  herhaal_n: '🔁 Herhaalblok: herhaalt alles wat BINNEN dit blok zit, zoveel keer als je invult. Dit is een herhalingslus!',
  herhaal_continu: '🔁 Herhaalt alles wat BINNEN dit blok zit, voor altijd. Perfect voor je besturing!',
  als_blok: '❓ Als-dan: kijkt of iets waar is. Alleen als het WAAR is, doet hij wat erin zit. De computer maakt een keuze!',
  als_anders_blok: '❓ Als-dan-anders: is het waar? Dan doet hij het bovenste. Is het niet waar? Dan het onderste.',
  toets_ingedrukt: 'Kijkt of een toets NU ingedrukt is (waar of niet waar). Past in het zeshoekige gaatje van een als-blok — gebruik dit binnen een herhaal-lus om te blijven sturen.',
  muis_ingedrukt: 'Kijkt of de muisknop NU ingedrukt is (waar of niet waar).',
  waarde_blok: '🔢 Een VARIABELE van het spel: je levens, score, level of positie. Dit getal verandert vanzelf terwijl je speelt — jij kan het lezen, het spel houdt het bij.',
  waarneem_blok: 'Wat je tank nu waarneemt: hoe ver de dichtstbijzijnde vijand is, of waar de muis staat.',
  hat_versla: '🚩 Gebeurtenis: gaat af telkens als jij een robot of speler verslaat. Tel je kills met een variabele!',
  hat_signaal: '🚩 Gebeurtenis: dit stapeltje wacht tot ergens anders in je programma "zend signaal" met dezelfde naam wordt uitgevoerd. Zo laat je twee stapeltjes met elkaar praten.',
  zend_signaal: '📡 Roept alle stapeltjes op die met "wanneer ik signaal … ontvang" beginnen. Let op: de naam moet exact hetzelfde zijn, anders komt je signaal nergens aan.',
  hat_statpunt: '🚩 Gebeurtenis: bij elk nieuw level krijg je een statpunt — programmeer hier je eigen upgrade-plan met als-dan!',
  stat_geef: '⚡ Besteedt één statpunt aan deze eigenschap. Werkt alleen als je punten over hebt en de stat nog geen 7/7 is — de server bewaakt dat.',
  stat_waarde: '⚡ Leest hoeveel punten een eigenschap nu heeft (0-7). Handig in als-dan: "als kogelschade < 5 dan..."',
  stat_punten: '⚡ Hoeveel statpunten je nog kan uitgeven.',
  wacht_tot: 'Pauzeert dit stapeltje blokken tot de voorwaarde WAAR wordt. Bijv: wacht tot <mijn levens = 90>.',
  variables_set: '🔢 Variabele: stopt een getal in jouw eigen variabele (doosje met een naam). Maak variabelen met de knop in de oranje categorie!',
  math_change: '🔢 Telt iets bij je variabele op (of eraf met een negatief getal). Perfect om te tellen: kills, keer geraakt...',
  variables_get: '🔢 Leest het getal dat nu in je variabele zit. Je ziet hem ook live als tellertje op het speelveld!',
  beweeg_stappen: 'Rijdt vooruit of achteruit in de richting waar je geschut wijst. 10 stappen = volle snelheid, 5 = half zo snel.',
  draai_geschut: 'Draait je geschut een stukje verder vanaf waar het NU staat. Zet dit in "herhaal continu" en je tank draait rond!',
  richt_naar: 'Draait je geschut meteen naar een doel. Kies "dichtstbijzijnde vijand" en je tank mikt helemaal zelf — een echte auto-aim!',
  richt_rij: '🧭 Kiest de kant waar je tank naartoe rijdt — net als "richt naar … graden" in Scratch. 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links. Je geschut blijft gewoon mikken waar jij wil.',
  neem_stappen: '👣 Rijdt de kant op die je met "richt naar … graden" gekozen hebt. 10 stappen = volle snelheid, 5 = half zo snel.',
  raak_ik: '❓ Waar of niet waar: raakt je tank nu bijna een muur, vorm, vijand of de rand? Perfect voor als-dan.',
  beste_score: '🏆 De hoogste score van alle spelers op dit moment. Robots tellen niet mee — het gaat om jullie.',
  mijn_plaats: '🥇 Sta jij eerste, tweede, derde…? 1 betekent dat niemand meer punten heeft dan jij.',
  kracht_kogel: '💥 Hoeveel schade deed de kogel die je net raakte? Een tegenstander die zijn kogelschade heeft geüpgraded doet meer pijn — daarom is dit getal niet altijd hetzelfde.',
  word_klasse: '🛠 Verandert je tank in een andere vorm met een ander kanon — zoals "verander uiterlijk naar" in Scratch. Werkt pas vanaf level 15! Combineer het met "als mijn level > 15 dan …", anders gebeurt er nog niets.',
  in_basis: '🏠 Waar of niet waar: sta je nu in je veilige zone (de gestreepte hoek)? Daar raken vijandelijke kogels je niet en genees je snel. Let op: dit blok kíjkt alleen — naar huis rijden moet je zelf doen!',
  var_toon: '🔢 Laat het tellertje van deze variabele op het speelveld zien.',
  var_verberg: '🔢 Verbergt het tellertje (de variabele telt gewoon door).',
  stopwatch: '⏱ Hoeveel seconden er voorbij zijn sinds je op 🚩 drukte.',
  op_reken: 'Rekent met twee getallen: optellen, aftrekken, keer of delen. Dit is VERWERKING.',
  op_vergelijk: 'Vergelijkt twee getallen (groter, kleiner, gelijk). Het antwoord is waar of niet waar — past in als-blokken.',
  op_en: 'Alleen waar als ALLEBEI de stukken waar zijn.',
  op_of: 'Waar als minstens ÉÉN van de twee stukken waar is.',
  op_niet: 'Draait waar om naar niet waar (en omgekeerd).',
  op_willekeurig: 'Kiest een willekeurig getal tussen de twee getallen. Elke keer anders!',
  var_zet: '🔢 Variabele: stopt een getal in een doosje met een naam. Later kan je het weer uitlezen.',
  var_verander: '🔢 Telt iets bij je variabele op (of eraf met een negatief getal). Handig om te tellen!',
  var_waarde: '🔢 Leest het getal dat nu in je variabele (doosje) zit.',
  math_number: 'Een getal. Klik erop om het te veranderen.',
};

/*
 * Blok-uitleg verschijnt pas als je 3 seconden op een blok blijft hangen, en
 * verdwijnt zodra je wegbeweegt. Eerder kwam hij bij elke klik in beeld — dus
 * ook telkens als je gewoon een blok wilde verslepen, en dan stond hij in de
 * weg. Nu moet je er bewust even bij stilstaan.
 */
const uitlegVak = document.getElementById('blok-uitleg');
let uitlegTimer = null;
let wachtVoorType = null;   // hier loopt de teller van 3 seconden voor
let toontType = null;       // dit staat er nu in beeld

function verbergUitleg() {
  clearTimeout(uitlegTimer);
  uitlegVak.classList.add('verborgen');
  wachtVoorType = null;
  toontType = null;
}

/* Zoekt het Blockly-blok onder de muis (ook in de blokkenlade). */
function blokOnder(doel) {
  const svg = doel && doel.closest ? doel.closest('.blocklyDraggable, .blocklyPath') : null;
  if (!svg) return null;
  const g = svg.closest('.blocklyDraggable');
  const id = g && g.getAttribute('data-id');
  if (!id) return null;
  return werkruimte.getBlockById(id)
    || (werkruimte.getToolbox() && werkruimte.getToolbox().getFlyout()
      && werkruimte.getToolbox().getFlyout().getWorkspace().getBlockById(id));
}

document.getElementById('blocklyDiv').addEventListener('mousemove', (e) => {
  const blok = blokOnder(e.target);
  const type = blok && blok.type;
  if (!type || !UITLEG[type]) { verbergUitleg(); return; }   // van het blok af = weg
  if (type === wachtVoorType || type === toontType) return;  // al bezig, laat lopen
  clearTimeout(uitlegTimer);
  uitlegVak.classList.add('verborgen');
  wachtVoorType = type;
  toontType = null;
  uitlegTimer = setTimeout(() => {
    uitlegVak.textContent = UITLEG[type];
    uitlegVak.classList.remove('verborgen');
    toontType = type;
  }, 3000);
});
document.getElementById('blocklyDiv').addEventListener('mouseleave', verbergUitleg);

/*
 * Op een Chromebook met touchscreen of een iPad bestaat "hoveren" niet, dus
 * zou de uitleg daar nooit verschijnen. Op zulke toestellen tonen we hem als
 * je een blok áántikt — kort, zonder te slepen. Eerst verscheen hij bij élke
 * aanraking, ook als je een blok wilde verslepen: dan lag er telkens een geel
 * kaartje over de onderkant van je werkblad (en over de zoomknoppen), precies
 * waar je je blok wilde neerleggen. Met een muis blijft het bij het hoveren.
 */
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  const blokkenVak = document.getElementById('blocklyDiv');
  let tik = null;   // waar en wanneer de vinger neerkwam, op welk blok
  blokkenVak.addEventListener('pointerdown', (e) => {
    verbergUitleg();
    const blok = blokOnder(e.target);
    tik = blok && UITLEG[blok.type] ? { type: blok.type, x: e.clientX, y: e.clientY, t: Date.now() } : null;
  }, true);
  blokkenVak.addEventListener('pointerup', (e) => {
    const was = tik;
    tik = null;
    // lang vastgehouden of verschoven = slepen, geen vraag om uitleg
    if (!was || Date.now() - was.t > 600 || Math.hypot(e.clientX - was.x, e.clientY - was.y) > 10) return;
    clearTimeout(uitlegTimer);
    uitlegVak.textContent = UITLEG[was.type];
    uitlegVak.classList.remove('verborgen');
    toontType = was.type;
    uitlegTimer = setTimeout(verbergUitleg, 7000);   // vanzelf weg, of tik ergens anders
  }, true);
  blokkenVak.addEventListener('pointercancel', () => { tik = null; }, true);
}
uitlegVak.addEventListener('click', verbergUitleg);

/* ------------------------------------------------------------------ */
/* Zien wat je programma doet                                          */
/* ------------------------------------------------------------------ */
/*
 * Het blok dat nu uitgevoerd wordt, licht geel op — zoals in Scratch. Zo zie
 * je met eigen ogen dat de computer van boven naar beneden leest (stap 2),
 * dat een blok buiten de herhaal-lus maar één keer aan de beurt komt, en welke
 * tak van een als-blok hij kiest zodra je een toets indrukt (stap 3 en 4).
 * runtime.js houdt bij wat er net gebeurde; hier kleuren we het in, tien keer
 * per seconde, en alleen wat veranderd is.
 */
const OPLICHT_MS = 400;   // een blok dat maar één keer draait, flitst zo lang genoeg om het te zien
let opgelicht = new Set();
function zetOplichten(id, aan) {
  const b = werkruimte.getBlockById(id);
  const svg = b && b.getSvgRoot && b.getSvgRoot();
  if (svg) svg.classList.toggle('blok-actief', aan);
}
setInterval(() => {
  const rt = window.runtime;
  const nu = Date.now();
  const nieuw = new Set();
  if (rt && rt.draait && !rt.bevroren && !rt.verouderd && rt.actief) {
    for (const [id, t] of rt.actief) if (nu - t < OPLICHT_MS) nieuw.add(id);
  }
  for (const id of opgelicht) if (!nieuw.has(id)) zetOplichten(id, false);
  for (const id of nieuw) if (!opgelicht.has(id)) zetOplichten(id, true);
  opgelicht = nieuw;
  // de vlag knippert zolang er een ouder programma draait dan wat er staat
  const vlag = document.getElementById('vlag');
  if (vlag) vlag.classList.toggle('opnieuw', !!(rt && rt.draait && rt.verouderd));
}, 100);

/*
 * Blokken veranderd terwijl het programma loopt? De tank rijdt dan nog met
 * het programma van toen je op de groene vlag drukte. Dat zeggen we eerlijk:
 * het oplichten stopt (anders licht een blok op dat al ergens anders hangt),
 * de vlag knippert, en één keer verschijnt er een melding. We vergelijken het
 * echte programma, dus blokken verschuiven of opruimen telt niet mee.
 */
function kijkOfProgrammaVeranderd() {
  const rt = window.runtime;
  if (!rt || !rt.draait) return;
  let nu = '';
  try { nu = JSON.stringify(compileerProject(werkruimte)); } catch { return; }
  const was = rt.verouderd;
  rt.verouderd = nu !== rt.programmaTekst;
  if (rt.verouderd && !was && typeof window.toast === 'function') {
    window.toast('✏️ Je blokken zijn veranderd — druk op de groene vlag om je nieuwe programma te starten.');
  }
}

/*
 * Losse stapeltjes verbleken. Een stapel zonder geel startblok erboven start
 * nooit — maar voor een kind staan de blokken er gewoon: "waarom doet hij
 * niets?". Nu zie je meteen welke blokken niet meedoen, en het gele
 * driehoekje erop zegt waarom. Op het dashboard ziet de lesgever het ook.
 */
// (korte regels: Blockly breekt de tekst in het ballonnetje zelf niet af)
const LOS_UITLEG = {
  stapel: 'Dit stapeltje doet niets:\ner staat geen geel startblok boven.\nHang het onder een geel blok,\nzoals "wanneer op groene vlag wordt geklikt".',
  waarde: 'Dit blokje doet pas iets\nals je het in een gaatje\nvan een ander blok sleept.',
};
let losGepland = false;
/* We vergelijken met wat er écht op het scherm staat (en niet met wat we de
   vorige keer dachten te doen): zo kan een verbleekt blok nooit blijven hangen. */
function markeerLosseStapels() {
  losGepland = false;
  /* Tijdens het slepen ligt het blok in je hand natuurlijk "los". Het mag dan
     niet verbleken of een driehoekje krijgen: bij het loslaten kijken we pas. */
  if (werkruimte.isDragging()) return;
  kijkOfProgrammaVeranderd();
  const nu = new Map(losseStapels(werkruimte).map((x) => [x.id, x.soort]));
  const WAARSCHUWING = Blockly.icons.IconType.WARNING;
  for (const b of werkruimte.getAllBlocks(false)) {
    const svg = b.getSvgRoot && b.getSvgRoot();
    if (!svg) continue;
    const soort = nu.get(b.id) || null;
    // eerst het verbleken: dat is wat het kind ziet
    if (svg.classList.contains('blok-los') !== !!soort) svg.classList.toggle('blok-los', !!soort);
    const tekst = soort ? LOS_UITLEG[soort] : null;
    const icoon = b.getIcon(WAARSCHUWING);
    if (!!icoon !== !!tekst || (icoon && tekst && icoon.getText && icoon.getText() !== tekst)) {
      try { b.setWarningText(tekst); } catch { /* volgende ronde opnieuw */ }
    }
  }
}
function planLosseStapels() {
  if (losGepland) return;
  losGepland = true;
  setTimeout(markeerLosseStapels, 0);
}
werkruimte.addChangeListener((e) => { if (!e.isUiEvent) planLosseStapels(); });
/* vangnet: mist er ooit een gebeurtenis, dan staat het binnen anderhalve seconde toch juist */
setInterval(planLosseStapels, 1500);

window.blocklyWerkruimte = werkruimte;
