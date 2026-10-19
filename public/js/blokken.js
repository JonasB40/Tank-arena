/*
 * De blokken zelf: hoe ze heten, hoe ze eruitzien en welke velden ze hebben.
 * Dezelfde categorieën, kleuren en formuleringen als echt Scratch. Dit staat
 * los van de editor (editor.js), zodat "npm test" de blokken ook zonder
 * browser kan inladen en de lessen kan nakijken.
 */

/* Blockly's Nederlandse teksten vervangen door die van Scratch, zodat de
   blokken exact zo heten als de kinderen ze uit Scratch kennen:
   "stel X in op Y" → "maak X …", "X wijzigen met Y" → "verander X met …". */
Blockly.Msg.VARIABLES_SET = 'maak %1 %2';
Blockly.Msg.MATH_CHANGE_TITLE = 'verander %1 met %2';
// het plusje maakt duidelijk dat dit een knop is en geen blok
Blockly.Msg.NEW_VARIABLE = '➕  Maak een variabele';
Blockly.Msg.NEW_VARIABLE_TITLE = 'Naam van de nieuwe variabele:';
Blockly.Msg.RENAME_VARIABLE = 'Naam veranderen';
/*
 * Keuzelijstje voor het zeg-blok: de zinnetjes die je in de les nodig hebt
 * staan er meteen in, en onderaan kan je er zelf een typen. Tikfouten in
 * "help!" kostten anders zomaar een vinkje.
 */
const ZEG_TEKSTEN = [
  'hallo!', 'help!', 'gepakt!', 'naar huis!', 'ik kom sterker terug!',
  'jullie krijgen me niet!', 'pas op!', 'oeps!', 'goed zo!', 'hebbes!',
];
const ZEG_ZELF = '\u0000zelf';   // onzichtbaar teken: botst nooit met een getypte tekst

class ZegTekstVeld extends Blockly.FieldDropdown {
  static fromJson(opties) { return new ZegTekstVeld(opties.text || ZEG_TEKSTEN[0]); }

  constructor(waarde) {
    super(function opties() {
      const nu = this && this.getValue ? this.getValue() : null;
      const lijst = ZEG_TEKSTEN.map((t) => [t, t]);
      if (nu && !ZEG_TEKSTEN.includes(nu)) lijst.unshift([nu, nu]);   // eigen tekst bovenaan
      lijst.push(['✏️ zelf typen…', ZEG_ZELF]);
      return lijst;
    });
    if (waarde) this.setValue(waarde);
  }

  // elke tekst is geldig, ook een zelfgetypte die niet in de lijst staat
  doClassValidation_(waarde) { return typeof waarde === 'string' ? waarde : null; }
  getText() { return String(this.getValue() || ''); }

  onItemSelected_(menu, item) {
    if (item.getValue() !== ZEG_ZELF) return super.onItemSelected_(menu, item);
    vraagTekst({
      titel: 'Wat zegt je tank?', label: 'Typ je eigen tekst:',
      waarde: this.getValue(), toonBereik: false,
    }, (tekst) => {
      if (tekst) this.setValue(String(tekst).trim().slice(0, 40));
    });
    return null;
  }
}
Blockly.fieldRegistry.register('field_zegtekst', ZegTekstVeld);

/*
 * Signalen (in Scratch: "berichten"). Eén gedeelde lijst voor ALLE
 * signaalblokken: typt een leerling een nieuwe naam bij "zend signaal", dan
 * kan hij die meteen kiezen bij "wanneer ik signaal … ontvang". Zonder die
 * gedeelde lijst schrijf je een signaal dat nergens aankomt — precies de
 * fout die je in de klas niet wil uitleggen.
 */
const SIGNALEN = ['bonus', 'alarm', 'game over', 'gewonnen'];
const SIGNAAL_NIEUW = ' nieuw';

class SignaalVeld extends Blockly.FieldDropdown {
  static fromJson(opties) { return new SignaalVeld(opties.naam || SIGNALEN[0]); }

  constructor(waarde) {
    super(function opties() {
      const lijst = SIGNALEN.map((s) => [s, s]);
      lijst.push(['➕ nieuw signaal…', SIGNAAL_NIEUW]);
      return lijst;
    });
    if (waarde) this.setValue(waarde);
  }

  /* Elke naam die ergens gezet wordt, komt meteen in de gedeelde lijst. Dat
     moet hier gebeuren (en niet pas als je het menu opent), anders ziet het
     ontvang-blok een zelfgetypte naam niet staan — bijvoorbeeld na het laden
     van een opgeslagen projectcode. */
  doClassValidation_(waarde) {
    if (typeof waarde !== 'string') return null;
    if (waarde !== SIGNAAL_NIEUW && !SIGNALEN.includes(waarde)) SIGNALEN.push(waarde);
    return waarde;
  }
  getText() { return String(this.getValue() || ''); }

  onItemSelected_(menu, item) {
    if (item.getValue() !== SIGNAAL_NIEUW) return super.onItemSelected_(menu, item);
    vraagTekst({
      titel: 'Nieuw signaal', label: 'Hoe heet je signaal?',
      waarde: '', toonBereik: false,
    }, (naam) => {
      const schoon = String(naam || '').trim().slice(0, 24);
      if (!schoon) return;
      if (!SIGNALEN.includes(schoon)) SIGNALEN.push(schoon);
      this.setValue(schoon);
    });
    return null;
  }
}
Blockly.fieldRegistry.register('field_signaal', SignaalVeld);

/* Groene vlag als plaatje — bruikbaar in blokken én in de knoppenbalk. */
const VLAG_ICOON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'
  + '<path d="M4 2v16" stroke="#2e7d32" stroke-width="2" stroke-linecap="round"/>'
  + '<path d="M5.2 3.1c3.2-1.8 6.4 1.8 9.6 0v7c-3.2 1.8-6.4-1.8-9.6 0z" fill="#4CBF56" stroke="#2e7d32" stroke-width="1"/>'
  + '</svg>');
window.VLAG_ICOON = VLAG_ICOON;

Blockly.Msg.COLLAPSE_BLOCK = 'Dit stapeltje inklappen';
Blockly.Msg.EXPAND_BLOCK = 'Dit stapeltje uitklappen';
Blockly.Msg.COLLAPSE_ALL = 'Alle stapeltjes inklappen';
Blockly.Msg.EXPAND_ALL = 'Alle stapeltjes uitklappen';
Blockly.Msg.CLEAN_UP = 'Netjes onder elkaar zetten';
Blockly.Msg.DELETE_VARIABLE = 'Variabele %1 verwijderen';

const SCRATCH_KLEUR = {
  beweging: '#4C97FF',
  uiterlijken: '#9966FF',
  gebeurtenissen: '#FFBF00',
  besturen: '#FFAB19',
  waarnemen: '#5CB1D6',
  operators: '#59C059',
  variabelen: '#FF8C1A',
  gevecht: '#DB6E9C',
  tank: '#0FBD8C',        // upgrades/stats (groen, zoals Pen in Scratch)
};

const KLEUR_OPTIES = [
  ['🔴 rood', '#e74c3c'], ['🔵 blauw', '#3498db'], ['🟢 groen', '#2ecc71'],
  ['🟡 geel', '#f1c40f'], ['🟣 paars', '#9b59b6'], ['🟠 oranje', '#e67e22'],
  ['🌸 roze', '#ff7bd5'], ['🩵 turquoise', '#1abc9c'],
];

const TOETS_OPTIES = [
  ['pijltje omhoog ↑', 'ArrowUp'], ['pijltje omlaag ↓', 'ArrowDown'],
  ['pijltje links ←', 'ArrowLeft'], ['pijltje rechts →', 'ArrowRight'],
  ['spatiebalk', ' '],
  ['w', 'w'], ['a', 'a'], ['s', 's'], ['d', 'd'], ['z', 'z'], ['q', 'q'], ['e', 'e'],
];

const RICHTING_OPTIES = [['omhoog ↑', 'omhoog'], ['omlaag ↓', 'omlaag'], ['links ←', 'links'], ['rechts →', 'rechts']];

Blockly.defineBlocksWithJsonArray([
  /* ---------- Gebeurtenissen (hat-blokken: blokken klikken eronder) ---------- */
  /* Echte groene vlag als plaatje: het 🚩-emoji is op Windows donkerrood,
     waardoor "de groene vlag" nergens groen was. */
  { type: 'hat_start', message0: '%1 wanneer op groene vlag wordt geklikt', args0: [{ type: 'field_image', src: VLAG_ICOON, width: 20, height: 20, alt: 'groene vlag' }], nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen, tooltip: 'Alles hieronder start als je op de groene vlag boven het speelveld klikt.' },
  { type: 'hat_toets', message0: '🚩 wanneer toets %1 wordt ingedrukt', args0: [{ type: 'field_dropdown', name: 'TOETS', options: TOETS_OPTIES }], nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen },
  { type: 'hat_geraakt', message0: '🚩 wanneer ik geraakt word 💥', nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen },
  { type: 'hat_levelup', message0: '🚩 wanneer ik een level omhoog ga ⬆️', nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen, tooltip: 'Gebeurt telkens als je genoeg punten hebt voor een nieuw level.' },
  { type: 'hat_dood', message0: '🚩 wanneer ik kapot ga ☠️', nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen },
  { type: 'hat_versla', message0: '🚩 wanneer ik iemand versla 🏆', nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen, tooltip: 'Gebeurt telkens als jij een robot of speler kapot schiet.' },
  /* Signalen, zoals de berichten in Scratch: het ene stapeltje roept, het
     andere luistert. Zo koppel je "ik heb iemand verslagen" los van "wat is
     mijn beloning" — precies de zend/ontvang uit het Pong-voorbeeld. */
  { type: 'hat_signaal', message0: '🚩 wanneer ik signaal %1 ontvang 📡', args0: [{ type: 'field_signaal', name: 'NAAM', naam: 'bonus' }], nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen, tooltip: 'Start dit stapeltje zodra een "zend signaal"-blok dit signaal verstuurt.' },
  { type: 'zend_signaal', message0: 'zend signaal %1 📡', args0: [{ type: 'field_signaal', name: 'NAAM', naam: 'bonus' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen, tooltip: 'Roept alle stapeltjes op die met "wanneer ik signaal … ontvang" beginnen.' },
  { type: 'hat_statpunt', message0: '🚩 wanneer ik een statpunt krijg ⚡', nextStatement: null, colour: SCRATCH_KLEUR.gebeurtenissen, tooltip: 'Gebeurt bij elk nieuw level (dan krijg je een statpunt). Programmeer hier je eigen upgrade-plan!' },

  /* ---------- Beweging ---------- */
  { type: 'beweeg_richting', message0: 'beweeg %1', args0: [{ type: 'field_dropdown', name: 'R', options: RICHTING_OPTIES }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging },
  /* De Scratch-manier van sturen: eerst een richting kiezen, dan stappen
     zetten. "richt naar" gaat over de tank zélf — alles wat het geschut
     draait zegt uitdrukkelijk "geschut". */
  { type: 'richt_rij', message0: 'richt naar %1 graden', args0: [{ type: 'input_value', name: 'HOEK', check: 'Number' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging, tooltip: 'Kiest de kant waar je tank naartoe rijdt. Zelfde graden als Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.' },
  { type: 'neem_stappen', message0: 'neem %1 stappen', args0: [{ type: 'input_value', name: 'N', check: 'Number' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging, tooltip: 'Rijdt de kant op die je met "richt naar … graden" koos. 10 stappen = volle snelheid.' },
  { type: 'richt_muis', message0: 'richt het geschut naar de muis 🖱', previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging },
  { type: 'richt_graden', message0: 'richt het geschut op %1 graden', args0: [{ type: 'input_value', name: 'HOEK', check: 'Number' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging, tooltip: 'Zelfde graden als in Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag, -90 = links.' },
  { type: 'beweeg_stappen', message0: 'beweeg %1 stappen %2', args0: [
      { type: 'input_value', name: 'N', check: 'Number' },
      { type: 'field_dropdown', name: 'R', options: [['vooruit ⬆', 'vooruit'], ['achteruit ⬇', 'achteruit']] },
    ], inputsInline: true, previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging, tooltip: 'Rijdt in de richting waar je geschut naar wijst. 10 stappen = volle snelheid, 5 = half zo snel.' },
  { type: 'draai_geschut', message0: 'draai geschut %1 %2 graden', args0: [
      { type: 'field_dropdown', name: 'KANT', options: [['↻ rechtsom', 'rechts'], ['↺ linksom', 'links']] },
      { type: 'input_value', name: 'N', check: 'Number' },
    ], inputsInline: true, previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging, tooltip: 'Draait je geschut een stukje verder vanaf waar het NU staat (niet naar een vaste hoek).' },
  { type: 'richt_naar', message0: 'richt het geschut naar %1', args0: [{ type: 'field_dropdown', name: 'DOEL', options: [
      ['🖱 muisaanwijzer', 'muis'], ['🎯 dichtstbijzijnde vijand', 'vijand'], ['🟨 dichtstbijzijnde vorm', 'vorm'],
    ] }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.beweging, tooltip: 'Draait je geschut meteen naar dit doel. Met "dichtstbijzijnde vijand" bouw je een tank die zelf mikt!' },

  /* ---------- Gevecht ---------- */
  { type: 'schiet_blok', message0: 'schiet 💥', previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.gevecht, tooltip: 'Vuurt als je geschut herladen is.' },
  { type: 'toon_upgrade', message0: 'toon upgrade-keuze ⬆️', previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.gevecht, tooltip: 'Opent het keuzevenster voor een nieuwe klasse of statpunten (als je iets te kiezen hebt).' },

  /* ---- Upgrades: de 8 stats programmeerbaar (zelfde volgorde als diep.io) ---- */
  { type: 'stat_geef', message0: 'geef 1 statpunt aan %1 ⚡', args0: [{ type: 'field_dropdown', name: 'STAT', options: [
      ['🩹 levensregen', 'levensregen'], ['❤️ max levens', 'maxlevens'], ['💢 botsschade', 'botsschade'],
      ['🚀 kogelsnelheid', 'kogelsnelheid'], ['🛡️ kogelpantser', 'kogelpantser'], ['💥 kogelschade', 'kogelschade'],
      ['🔄 herladen', 'herladen'], ['🏎️ snelheid', 'snelheid'],
    ] }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.tank, tooltip: 'Besteedt één van je statpunten aan deze eigenschap (als je punten hebt en de stat nog niet vol is).' },
  { type: 'stat_waarde', message0: 'waarde van stat %1', args0: [{ type: 'field_dropdown', name: 'STAT', options: [
      ['🩹 levensregen', 'levensregen'], ['❤️ max levens', 'maxlevens'], ['💢 botsschade', 'botsschade'],
      ['🚀 kogelsnelheid', 'kogelsnelheid'], ['🛡️ kogelpantser', 'kogelpantser'], ['💥 kogelschade', 'kogelschade'],
      ['🔄 herladen', 'herladen'], ['🏎️ snelheid', 'snelheid'],
    ] }], output: 'Number', colour: SCRATCH_KLEUR.tank, tooltip: 'Hoeveel punten deze eigenschap nu heeft (0 t/m 7).' },
  { type: 'stat_punten', message0: 'statpunten over', output: 'Number', colour: SCRATCH_KLEUR.tank, tooltip: 'Hoeveel statpunten je nog kan uitgeven.' },

  /* ---- Variabelen: tellertje tonen/verbergen (zoals Scratch) ---- */
  { type: 'var_toon', message0: 'toon variabele %1', args0: [{ type: 'field_variable', name: 'VAR', variable: 'kills' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.variabelen, tooltip: 'Laat het tellertje van deze variabele op het speelveld zien.' },
  { type: 'var_verberg', message0: 'verberg variabele %1', args0: [{ type: 'field_variable', name: 'VAR', variable: 'kills' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.variabelen, tooltip: 'Verbergt het tellertje van deze variabele (hij telt gewoon door).' },

  /* ---------- Uiterlijken ---------- */
  { type: 'zeg_blok', message0: 'zeg %1', args0: [{ type: 'field_zegtekst', name: 'TEKST', text: 'hallo!' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.uiterlijken },
  { type: 'zet_kleur', message0: 'zet kleur op %1', args0: [{ type: 'field_dropdown', name: 'KLEUR', options: KLEUR_OPTIES }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.uiterlijken },
  /* Zoals "verander uiterlijk naar [kostuum]" in Scratch: kies een nieuwe
     tankvorm. Werkt pas vanaf level 15 — de server bewaakt dat zelf. */
  { type: 'word_klasse', message0: 'verander uiterlijk naar %1 🛠', args0: [{ type: 'field_dropdown', name: 'KLASSE', options: [
      ['Twin (2 lopen)', 'twin'], ['Sluipschutter (verre schoten)', 'sluipschutter'],
      ['Machinegeweer (snel vuur)', 'machinegeweer'], ['Flankwacht (schiet ook achteruit)', 'flankwacht'],
    ] }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.uiterlijken, tooltip: 'Verandert je tank in een andere vorm met een ander kanon. Lukt pas vanaf level 15!' },
  { type: 'flits_blok', message0: 'flits %1 ✨', args0: [{ type: 'field_dropdown', name: 'KLEUR', options: KLEUR_OPTIES.concat([['⚪ wit', '#ffffff']]) }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.uiterlijken },
  { type: 'speel_geluid', message0: 'speel geluid %1 🔊', args0: [{ type: 'field_dropdown', name: 'GELUID', options: [['pew (schot)', 'pew'], ['tik', 'tik'], ['plop', 'plop'], ['boing', 'boing'], ['tada!', 'tada']] }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.uiterlijken, tooltip: 'Speelt een kort geluidje op jouw computer.' },

  /* ---------- Besturen ---------- */
  { type: 'wacht_blok', message0: 'wacht %1 sec.', args0: [{ type: 'input_value', name: 'SEC', check: 'Number' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.besturen },
  { type: 'wacht_tot', message0: 'wacht tot %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.besturen, tooltip: 'Pauzeert dit stapeltje blokken tot de voorwaarde WAAR wordt.' },
  { type: 'stopwatch', message0: 'stopwatch ⏱', output: 'Number', colour: SCRATCH_KLEUR.waarnemen, tooltip: 'Seconden sinds je op 🚩 drukte.' },
  { type: 'herhaal_n', message0: 'herhaal %1 keer %2 %3', args0: [{ type: 'input_value', name: 'N', check: 'Number' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DOEN' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.besturen },
  /* Let op: dit blok heeft bewust ook een onderkant-verbinding. Daardoor kan
     Blockly het tússen blokken schuiven — en dat hebben we nodig om het zich
     te laten wikkelen om een bestaande stapel (zie het vangnet onderaan). */
  { type: 'herhaal_continu', message0: 'herhaal %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DOEN' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.besturen, tooltip: 'Blijft dit voor altijd doen, één rondje per tik — zoals in Scratch.' },
  { type: 'als_blok', message0: 'als %1 dan %2 %3', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DAN' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.besturen },
  { type: 'als_anders_blok', message0: 'als %1 dan %2 %3 anders %4', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DAN' }, { type: 'input_statement', name: 'ANDERS' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.besturen },

  /* ---------- Waarnemen ---------- */
  { type: 'toets_ingedrukt', message0: 'toets %1 ingedrukt?', args0: [{ type: 'field_dropdown', name: 'TOETS', options: TOETS_OPTIES }], output: 'Boolean', colour: SCRATCH_KLEUR.waarnemen },
  { type: 'muis_ingedrukt', message0: 'muis ingedrukt?', output: 'Boolean', colour: SCRATCH_KLEUR.waarnemen },
  { type: 'raak_ik', message0: 'raak ik %1 ?', args0: [{ type: 'field_dropdown', name: 'WAT', options: [
      ['💥 een vijandelijke kogel', 'kogel'],
      ['🧱 een muur', 'muur'], ['🟨 een vorm', 'vorm'], ['🎯 een vijand', 'vijand'], ['🚧 de rand', 'rand'],
    ] }], output: 'Boolean', colour: SCRATCH_KLEUR.waarnemen, tooltip: 'Waar of niet waar: raakt jouw tank dit nu bijna aan?' },
  { type: 'kracht_kogel', message0: 'kracht kogel 💥', output: 'Number', colour: SCRATCH_KLEUR.waarnemen, tooltip: 'Hoeveel schade deed de kogel die je net raakte? Een tegenstander die zijn kogelschade heeft geüpgraded, doet meer pijn.' },
  /* De ranglijst: hiermee kan je je met de rest van de klas vergelijken.
     Robots tellen niet mee — het gaat om de spelers. */
  { type: 'beste_score', message0: 'score van de beste speler 🏆', output: 'Number', colour: SCRATCH_KLEUR.waarnemen, tooltip: 'De hoogste score van alle spelers op dit moment. Robots tellen niet mee.' },
  { type: 'mijn_plaats', message0: 'mijn plaats in de ranglijst 🥇', output: 'Number', colour: SCRATCH_KLEUR.waarnemen, tooltip: 'Sta jij eerste, tweede, derde…? 1 is de beste. Robots tellen niet mee.' },
  /* Spelvariabelen: getallen die het spel zélf bijhoudt en die veranderen
     tijdens het spelen. Daarom oranje — het zijn écht variabelen, alleen
     kan jij ze niet zelf veranderen (het spel is de boekhouder). */
  { type: 'in_basis', message0: 'ben ik in mijn basis? 🏠', output: 'Boolean', colour: SCRATCH_KLEUR.waarnemen, tooltip: 'Waar of niet waar: sta je nu in je veilige zone? Daar kunnen vijanden je niet raken en genees je snel.' },
  { type: 'waarde_blok', message0: '%1', args0: [{ type: 'field_dropdown', name: 'W', options: [
      ['mijn levens ❤️', 'levens'], ['max levens ❤️', 'maxLevens'],
      ['mijn score 🏆', 'score'], ['mijn level ⬆️', 'level'],
      ['mijn x-positie', 'mijnX'], ['mijn y-positie', 'mijnY'],
    ] }], output: 'Number', colour: SCRATCH_KLEUR.variabelen, tooltip: 'Een variabele van het spel: dit getal verandert vanzelf terwijl je speelt.' },
  /* Waarnemen: wat je tank op dít moment ziet/voelt om zich heen. */
  { type: 'waarneem_blok', message0: '%1', args0: [{ type: 'field_dropdown', name: 'W', options: [
      ['afstand tot dichtstbijzijnde vijand', 'afstand'],
      ['muis x', 'muisX'], ['muis y', 'muisY'],
    ] }], output: 'Number', colour: SCRATCH_KLEUR.waarnemen },

  /* ---------- Operators ---------- */
  { type: 'op_reken', message0: '%1 %2 %3', args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'field_dropdown', name: 'OP', options: [['+', '+'], ['-', '-'], ['×', '*'], ['÷', '/']] },
      { type: 'input_value', name: 'B', check: 'Number' },
    ], inputsInline: true, output: 'Number', colour: SCRATCH_KLEUR.operators },
  { type: 'op_vergelijk', message0: '%1 %2 %3', args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'field_dropdown', name: 'OP', options: [['>', '>'], ['<', '<'], ['=', '=']] },
      { type: 'input_value', name: 'B', check: 'Number' },
    ], inputsInline: true, output: 'Boolean', colour: SCRATCH_KLEUR.operators },
  { type: 'op_en', message0: '%1 en %2', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }, { type: 'input_value', name: 'B', check: 'Boolean' }], inputsInline: true, output: 'Boolean', colour: SCRATCH_KLEUR.operators },
  { type: 'op_of', message0: '%1 of %2', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }, { type: 'input_value', name: 'B', check: 'Boolean' }], inputsInline: true, output: 'Boolean', colour: SCRATCH_KLEUR.operators },
  { type: 'op_niet', message0: 'niet %1', args0: [{ type: 'input_value', name: 'A', check: 'Boolean' }], inputsInline: true, output: 'Boolean', colour: SCRATCH_KLEUR.operators },
  { type: 'op_willekeurig', message0: 'willekeurig getal tussen %1 en %2', args0: [{ type: 'input_value', name: 'A', check: 'Number' }, { type: 'input_value', name: 'B', check: 'Number' }], inputsInline: true, output: 'Number', colour: SCRATCH_KLEUR.operators },

  /* ---------- Variabelen ---------- */
  { type: 'var_zet', message0: 'zet %1 op %2', args0: [{ type: 'field_input', name: 'NAAM', text: 'teller' }, { type: 'input_value', name: 'V', check: 'Number' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.variabelen },
  { type: 'var_verander', message0: 'verander %1 met %2', args0: [{ type: 'field_input', name: 'NAAM', text: 'teller' }, { type: 'input_value', name: 'V', check: 'Number' }], previousStatement: null, nextStatement: null, colour: SCRATCH_KLEUR.variabelen },
  { type: 'var_waarde', message0: 'waarde van %1', args0: [{ type: 'field_input', name: 'NAAM', text: 'teller' }], output: 'Number', colour: SCRATCH_KLEUR.variabelen },
]);

/* ------------------------------------------------------------------ */
/* Hoekveld: klik op het getal en je krijgt een draaiknop, zoals in    */
/* Scratch. Blockly 11 heeft dit veld zelf niet meer (het verhuisde    */
/* naar een losse plugin), dus we maken er een.                        */
/* Graden volgen Scratch: 0 = omhoog, 90 = rechts, met de klok mee.    */
/* ------------------------------------------------------------------ */
const HOEK_STAP = 15;          // vastklikken op halve uurtjes: 0, 15, 30 ...
const HOEK_R = 58;             // straal van de wijzerplaat

class HoekVeld extends Blockly.FieldNumber {
  static fromJson(opties) { return new HoekVeld(opties.value); }

  showEditor_() {
    const div = Blockly.DropDownDiv.getContentDiv();
    div.innerHTML = '';
    div.appendChild(this.maakWijzerplaat_());
    Blockly.DropDownDiv.setColour('#ffffff', '#d6c9ef');
    Blockly.DropDownDiv.showPositionedByField(this, () => { this.plaat_ = null; });
  }

  maakWijzerplaat_() {
    const NS = 'http://www.w3.org/2000/svg';
    const m = HOEK_R + 10;                       // midden
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', m * 2);
    svg.setAttribute('height', m * 2);
    svg.style.cursor = 'pointer';
    svg.style.display = 'block';

    const maak = (naam, attrs) => {
      const el = document.createElementNS(NS, naam);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.appendChild(el);
      return el;
    };

    maak('circle', { cx: m, cy: m, r: HOEK_R, fill: '#e8f0fe', stroke: '#4C97FF', 'stroke-width': 2 });
    for (let d = 0; d < 360; d += HOEK_STAP) {     // streepjes rondom
      const a = ((d - 90) * Math.PI) / 180;
      const lang = d % 90 === 0;
      maak('line', {
        x1: m + Math.cos(a) * (HOEK_R - (lang ? 12 : 6)), y1: m + Math.sin(a) * (HOEK_R - (lang ? 12 : 6)),
        x2: m + Math.cos(a) * HOEK_R, y2: m + Math.sin(a) * HOEK_R,
        stroke: lang ? '#4C97FF' : '#9dc3ff', 'stroke-width': lang ? 2 : 1,
      });
    }
    const taart = maak('path', { fill: 'rgba(76,151,255,.35)', stroke: 'none' });
    const wijzer = maak('line', { stroke: '#4C97FF', 'stroke-width': 3, 'stroke-linecap': 'round' });
    const knop = maak('circle', { r: 9, fill: '#4C97FF' });
    maak('circle', { cx: m, cy: m, r: 4, fill: '#4C97FF' });
    const label = maak('text', {
      x: m, y: m + HOEK_R + 4, 'text-anchor': 'middle', fill: '#3d2d63',
      'font-size': 13, 'font-weight': 700, 'font-family': 'Segoe UI, sans-serif',
    });

    const teken = (graden) => {
      const a = ((graden - 90) * Math.PI) / 180;
      const px = m + Math.cos(a) * (HOEK_R - 12), py = m + Math.sin(a) * (HOEK_R - 12);
      wijzer.setAttribute('x1', m); wijzer.setAttribute('y1', m);
      wijzer.setAttribute('x2', px); wijzer.setAttribute('y2', py);
      knop.setAttribute('cx', px); knop.setAttribute('cy', py);
      label.textContent = `${graden}°`;
      // taartpunt van "omhoog" tot de wijzer, zodat je de draai ziet
      const groot = Math.abs(graden) > 180 ? 1 : 0;
      const richting = graden >= 0 ? 1 : 0;
      taart.setAttribute('d', graden === 0 ? '' : `M ${m} ${m} L ${m} ${m - (HOEK_R - 12)} `
        + `A ${HOEK_R - 12} ${HOEK_R - 12} 0 ${groot} ${richting} ${px} ${py} Z`);
    };
    teken(Number(this.getValue()) || 0);

    const uitPunt = (ev) => {
      const r = svg.getBoundingClientRect();
      let d = (Math.atan2(ev.clientY - (r.top + m), ev.clientX - (r.left + m)) * 180) / Math.PI + 90;
      d = Math.round(d / HOEK_STAP) * HOEK_STAP;
      while (d > 180) d -= 360;
      while (d <= -180) d += 360;
      teken(d);
      this.setEditorValue_(String(d));
    };
    /*
     * Pointer-events in plaats van muis-events: zo werkt de draaiknop ook met
     * een vinger op een touchscreen-chromebook. En het loslaten hoort bij
     * élke sleepbeweging; vroeger werd het maar één keer opgevangen, waardoor
     * de wijzer vanaf de tweede keer aan je muis bleef plakken.
     */
    let bezig = false;
    svg.style.touchAction = 'none';
    svg.addEventListener('pointerdown', (e) => {
      bezig = true;
      try { svg.setPointerCapture(e.pointerId); } catch { /* oudere browser */ }
      uitPunt(e);
      e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => { if (bezig) uitPunt(e); });
    const los = () => { bezig = false; };
    svg.addEventListener('pointerup', los);
    svg.addEventListener('pointercancel', los);
    return svg;
  }
}
Blockly.fieldRegistry.register('field_hoek', HoekVeld);

/* Schaduwblokje met dat hoekveld — precies zoals de getal-schaduw, maar met
   een draaiknop. Blijft vervangbaar door een echt blok, net als in Scratch. */
Blockly.defineBlocksWithJsonArray([{
  type: 'hoek_getal',
  message0: '%1',
  args0: [{ type: 'field_hoek', name: 'NUM', value: 90 }],
  output: 'Number',
  colour: SCRATCH_KLEUR.beweging,
}]);
