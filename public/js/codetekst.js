/*
 * Zet het gecompileerde programma van een leerling om in leesbare tekst,
 * zodat de lesgever het groot op de beamer kan tonen:
 *
 *   wanneer op groene vlag wordt geklikt
 *      herhaal
 *         richt het geschut naar de muis
 *         als <toets ↑ ingedrukt?> dan
 *            beweeg omhoog
 */

const TRIGGER_TEKST = {
  start: 'wanneer op groene vlag wordt geklikt',
  toets: '🚩 wanneer toets [%s] wordt ingedrukt',
  geraakt: '🚩 wanneer ik geraakt word',
  levelup: '🚩 wanneer ik een level omhoog ga',
  statpunt: '🚩 wanneer ik een statpunt krijg',
  versla: '🚩 wanneer ik iemand versla',
  dood: '🚩 wanneer ik kapot ga',
  signaal: '🚩 wanneer ik signaal [%s] ontvang',
};

const TOETS_NAAM = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'spatiebalk',
};

function exprTekst(x) {
  if (!x) return '?';
  switch (x.e) {
    case 'num': return String(x.v);
    case 'bool': return x.v ? 'waar' : 'niet waar';
    case 'reken': return `(${exprTekst(x.a)} ${x.op} ${exprTekst(x.b)})`;
    case 'vergelijk': return `${exprTekst(x.a)} ${x.op} ${exprTekst(x.b)}`;
    case 'en': return `${exprTekst(x.a)} en ${exprTekst(x.b)}`;
    case 'of': return `${exprTekst(x.a)} of ${exprTekst(x.b)}`;
    case 'niet': return `niet ${exprTekst(x.a)}`;
    case 'willekeurig': return `willekeurig ${exprTekst(x.a)}-${exprTekst(x.b)}`;
    case 'toets': return `toets ${TOETS_NAAM[x.k] || x.k} ingedrukt?`;
    case 'muisknop': return 'muis ingedrukt?';
    case 'raakIk': return `raak ik ${x.wat}?`;
    case 'inBasis': return 'ben ik in mijn basis?';
    case 'krachtKogel': return 'kracht kogel';
    case 'besteScore': return 'score van de beste speler';
    case 'mijnPlaats': return 'mijn plaats in de ranglijst';
    case 'maxLevens': return 'max levens';
    case 'var': return `[${x.naam}]`;
    case 'stat': return `stat ${x.naam}`;
    case 'statPunten': return 'statpunten over';
    case 'stopwatch': return 'stopwatch';
    case 'levens': return 'mijn levens';
    case 'score': return 'mijn score';
    case 'level': return 'mijn level';
    case 'afstand': return 'afstand tot vijand';
    // de overige keuzes uit dezelfde twee dropdown-blokken
    case 'mijnX': return 'mijn x-positie';
    case 'mijnY': return 'mijn y-positie';
    case 'muisX': return 'muis x';
    case 'muisY': return 'muis y';
    default: return x.e;
  }
}

function cmdRegels(cmds, diep, uit) {
  const sp = '   '.repeat(diep);
  for (const c of cmds || []) {
    switch (c.t) {
      case 'beweeg': uit.push(sp + `beweeg ${c.r}`); break;
      case 'beweegStappen': uit.push(sp + `beweeg ${exprTekst(c.n)} stappen ${c.r}`); break;
      case 'richtMuis': uit.push(sp + 'richt het geschut naar de muis'); break;
      case 'richtNaar': uit.push(sp + `richt naar ${c.doel}`); break;
      case 'richtGraden': uit.push(sp + `richt het geschut op ${exprTekst(c.v)} graden`); break;
      case 'richtRij': uit.push(sp + `richt naar ${exprTekst(c.v)} graden`); break;
      case 'neemStappen': uit.push(sp + `neem ${exprTekst(c.n)} stappen`); break;
      case 'draaiGeschut': uit.push(sp + `draai geschut ${c.kant === 'links' ? '↺' : '↻'} ${exprTekst(c.n)} graden`); break;
      case 'schiet': uit.push(sp + 'schiet'); break;
      case 'upgrade': uit.push(sp + 'toon upgrade-keuze'); break;
      case 'geefStat': uit.push(sp + `geef 1 statpunt aan ${c.stat}`); break;
      case 'zendSignaal': uit.push(sp + `zend signaal [${c.naam}]`); break;
      case 'zeg': uit.push(sp + `zeg [${c.s}]`); break;
      case 'kleur': uit.push(sp + 'zet kleur'); break;
      case 'wordKlasse': uit.push(sp + `verander uiterlijk naar ${c.klasse}`); break;
      case 'flits': uit.push(sp + 'flits'); break;
      case 'geluid': uit.push(sp + `speel geluid [${c.v}]`); break;
      case 'wacht': uit.push(sp + `wacht ${exprTekst(c.v)} sec.`); break;
      case 'wachtTot': uit.push(sp + `wacht tot <${exprTekst(c.c)}>`); break;
      case 'zetVar': uit.push(sp + `zet [${c.naam}] op ${exprTekst(c.v)}`); break;
      case 'veranderVar': uit.push(sp + `verander [${c.naam}] met ${exprTekst(c.v)}`); break;
      case 'toonVar': uit.push(sp + `toon variabele [${c.naam}]`); break;
      case 'verbergVar': uit.push(sp + `verberg variabele [${c.naam}]`); break;
      case 'herhaal':
        uit.push(sp + `herhaal ${exprTekst(c.n)} keer`);
        cmdRegels(c.body, diep + 1, uit);
        break;
      case 'forever':
        uit.push(sp + 'herhaal');
        cmdRegels(c.body, diep + 1, uit);
        break;
      case 'als':
        uit.push(sp + `als <${exprTekst(c.c)}> dan`);
        cmdRegels(c.dan, diep + 1, uit);
        if (c.anders && c.anders.length) {
          uit.push(sp + 'anders');
          cmdRegels(c.anders, diep + 1, uit);
        }
        break;
      default: uit.push(sp + (c.t || '?'));
    }
  }
  return uit;
}

/** Het hele programma als tekstblok. */
function programmaAlsTekst(programma) {
  if (!programma || !programma.length) return '(nog geen blokken)';
  const stukken = [];
  for (const s of programma) {
    const kop = (TRIGGER_TEKST[s.trigger.type] || s.trigger.type)
      .replace('%s', TOETS_NAAM[s.trigger.toets] || s.trigger.toets || s.trigger.naam || '');
    stukken.push([kop, ...cmdRegels(s.body, 1, [])].join('\n'));
  }
  return stukken.join('\n\n');
}

window.programmaAlsTekst = programmaAlsTekst;
