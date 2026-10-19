/*
 * De compiler: zet de blokken op het werkblad om in een JSON-programma dat
 * runtime.js uitvoert (geen eval: een kind kan zo nooit echte code laten
 * draaien). Los van de editor, zodat de tests hem zonder browser gebruiken.
 */
/*
 * Elk commando krijgt het id van zijn blok mee. Daarmee laat de editor het
 * blok oplichten op het moment dat de runtime het uitvoert — zoals Scratch
 * een lopend stapeltje laat gloeien. Zo zie je met eigen ogen dat de computer
 * van boven naar beneden leest, en welke tak van een als-blok hij kiest.
 */

/* Waarmee begint dit stapeltje? (null = geen geel startblok: het doet niets) */
function triggerVan(top) {
  switch (top.type) {
    case 'hat_start': return { type: 'start' };
    case 'hat_toets': return { type: 'toets', toets: top.getFieldValue('TOETS') };
    case 'hat_geraakt': return { type: 'geraakt' };
    case 'hat_levelup': return { type: 'levelup' };
    case 'hat_dood': return { type: 'dood' };
    case 'hat_versla': return { type: 'versla' };
    case 'hat_statpunt': return { type: 'statpunt' };
    case 'hat_signaal': return { type: 'signaal', naam: top.getFieldValue('NAAM') };
    default: return null;
  }
}

/* Zonder werkblad erbij: dat van de editor op deze pagina. */
function compileerProject(ws) {
  const scripts = [];
  const bron = ws || window.blocklyWerkruimte;
  for (const top of bron.getTopBlocks(true)) {
    if (!top.isEnabled()) continue;
    const trigger = triggerVan(top);
    if (!trigger) continue;
    scripts.push({ trigger, id: top.id, body: reeks(top.getNextBlock()) });
  }
  return scripts;
}

/*
 * Welke stapeltjes doen niets? Een stapel zonder geel startblok erboven start
 * nooit, en een los waardeblokje ("toets ↑ ingedrukt?") doet pas iets in een
 * gaatje. Kinderen zien dat niet: hun blokken staan er toch? De editor laat
 * zulke stapeltjes daarom verbleken, met een uitleg erbij.
 */
function losseStapels(ws) {
  const bron = ws || window.blocklyWerkruimte;
  const uit = [];
  for (const top of bron.getTopBlocks(false)) {
    if (!top.isEnabled() || top.isShadow() || triggerVan(top)) continue;
    uit.push({ id: top.id, soort: top.outputConnection ? 'waarde' : 'stapel' });
  }
  return uit;
}

function reeks(blok) {
  const uit = [];
  while (blok) {
    if (blok.isEnabled()) {
      const c = cmdVan(blok);
      if (c) { c.id = blok.id; uit.push(c); }
    }
    blok = blok.getNextBlock();
  }
  return uit;
}

function waarde(blok, naam, standaard) {
  const b = blok.getInputTargetBlock(naam);
  return b ? exprVan(b) : { e: 'num', v: standaard };
}

function cmdVan(b) {
  switch (b.type) {
    case 'beweeg_richting': return { t: 'beweeg', r: b.getFieldValue('R') };
    case 'richt_rij': return { t: 'richtRij', v: waarde(b, 'HOEK', 90) };
    case 'neem_stappen': return { t: 'neemStappen', n: waarde(b, 'N', 10) };
    case 'richt_muis': return { t: 'richtMuis' };
    case 'richt_graden': return { t: 'richtGraden', v: waarde(b, 'HOEK', 0) };
    case 'beweeg_stappen': return { t: 'beweegStappen', r: b.getFieldValue('R'), n: waarde(b, 'N', 10) };
    case 'draai_geschut': return { t: 'draaiGeschut', kant: b.getFieldValue('KANT'), n: waarde(b, 'N', 15) };
    case 'richt_naar': return { t: 'richtNaar', doel: b.getFieldValue('DOEL') };
    case 'var_toon': return { t: 'toonVar', naam: varNaamVan(b) };
    case 'var_verberg': return { t: 'verbergVar', naam: varNaamVan(b) };
    case 'schiet_blok': return { t: 'schiet' };
    case 'toon_upgrade': return { t: 'upgrade' };
    case 'zeg_blok': return { t: 'zeg', s: b.getFieldValue('TEKST') };
    case 'zet_kleur': return { t: 'kleur', v: b.getFieldValue('KLEUR') };
    case 'word_klasse': return { t: 'wordKlasse', klasse: b.getFieldValue('KLASSE') };
    case 'flits_blok': return { t: 'flits', v: b.getFieldValue('KLEUR') };
    case 'speel_geluid': return { t: 'geluid', v: b.getFieldValue('GELUID') };
    case 'wacht_blok': return { t: 'wacht', v: waarde(b, 'SEC', 1) };
    case 'wacht_tot': return { t: 'wachtTot', c: condVan(b) };
    case 'stat_geef': return { t: 'geefStat', stat: b.getFieldValue('STAT') };
    case 'zend_signaal': return { t: 'zendSignaal', naam: b.getFieldValue('NAAM') };
    case 'variables_set': return { t: 'zetVar', naam: varNaamVan(b), v: waarde(b, 'VALUE', 0) };
    case 'math_change': return { t: 'veranderVar', naam: varNaamVan(b), v: waarde(b, 'DELTA', 1) };
    case 'herhaal_n': return { t: 'herhaal', n: waarde(b, 'N', 1), body: reeks(b.getInputTargetBlock('DOEN')) };
    case 'herhaal_continu': return { t: 'forever', body: reeks(b.getInputTargetBlock('DOEN')) };
    case 'als_blok': return { t: 'als', c: condVan(b), dan: reeks(b.getInputTargetBlock('DAN')), anders: [] };
    case 'als_anders_blok': return { t: 'als', c: condVan(b), dan: reeks(b.getInputTargetBlock('DAN')), anders: reeks(b.getInputTargetBlock('ANDERS')) };
    case 'var_zet': return { t: 'zetVar', naam: b.getFieldValue('NAAM'), v: waarde(b, 'V', 0) };
    case 'var_verander': return { t: 'veranderVar', naam: b.getFieldValue('NAAM'), v: waarde(b, 'V', 1) };
    default: return null;
  }
}

function condVan(b) {
  const c = b.getInputTargetBlock('COND');
  return c ? exprVan(c) : { e: 'bool', v: false };
}

/* Naam van de gekozen variabele in een dropdown-variabeleblok. */
function varNaamVan(b) {
  const veld = b.getField('VAR');
  const variabele = veld && veld.getVariable ? veld.getVariable() : null;
  return variabele ? variabele.name : 'x';
}

function exprVan(b) {
  switch (b.type) {
    case 'math_number':
    case 'hoek_getal': return { e: 'num', v: Number(b.getFieldValue('NUM')) || 0 };
    case 'op_reken': return { e: 'reken', op: b.getFieldValue('OP'), a: waarde(b, 'A', 0), b: waarde(b, 'B', 0) };
    case 'op_vergelijk': return { e: 'vergelijk', op: b.getFieldValue('OP'), a: waarde(b, 'A', 0), b: waarde(b, 'B', 0) };
    case 'op_en': return { e: 'en', a: waarde(b, 'A', 0), b: waarde(b, 'B', 0) };
    case 'op_of': return { e: 'of', a: waarde(b, 'A', 0), b: waarde(b, 'B', 0) };
    case 'op_niet': return { e: 'niet', a: waarde(b, 'A', 0) };
    case 'op_willekeurig': return { e: 'willekeurig', a: waarde(b, 'A', 1), b: waarde(b, 'B', 10) };
    case 'toets_ingedrukt': return { e: 'toets', k: b.getFieldValue('TOETS') };
    case 'muis_ingedrukt': return { e: 'muisknop' };
    case 'stat_waarde': return { e: 'stat', naam: b.getFieldValue('STAT') };
    case 'stat_punten': return { e: 'statPunten' };
    case 'stopwatch': return { e: 'stopwatch' };
    case 'variables_get': return { e: 'var', naam: varNaamVan(b) };
    case 'raak_ik': return { e: 'raakIk', wat: b.getFieldValue('WAT') };
    case 'in_basis': return { e: 'inBasis' };
    case 'kracht_kogel': return { e: 'krachtKogel' };
    case 'beste_score': return { e: 'besteScore' };
    case 'mijn_plaats': return { e: 'mijnPlaats' };
    case 'waarde_blok': return { e: b.getFieldValue('W') };
    case 'waarneem_blok': return { e: b.getFieldValue('W') };
    case 'var_waarde': return { e: 'var', naam: b.getFieldValue('NAAM') };
    default: return { e: 'num', v: 0 };
  }
}

window.compileerProject = compileerProject;
window.losseStapels = losseStapels;
