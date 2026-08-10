/*
 * De blokjes-runtime: voert het gecompileerde programma uit zoals Scratch.
 *  - Hat-blokken starten "threads" (🚩 start, toets, geraakt, levelup, dood).
 *  - "herhaal" en "herhaal n keer" doen één rondje per tik (30/sec).
 *  - "wacht n sec." pauzeert alleen die ene stapel blokken.
 * De runtime verzamelt per tik de "intents" (bewegen/richten/schieten) en
 * stuurt die naar de server — de server blijft de scheidsrechter.
 */
const runtime = {
  draait: false,
  scripts: [],
  threads: [],
  vars: {},
  intent: { mx: 0, my: 0, angle: 0, shoot: false },
  /*
   * De rijrichting van de tank zélf, los van het geschut — precies zoals een
   * sprite in Scratch een eigen richting heeft. Daardoor kan je met "richt
   * naar … graden" sturen terwijl je geschut gewoon op de muis blijft mikken.
   * In radialen op het scherm; 0 = rechts, net als Scratch' beginrichting 90.
   */
  rijrichting: 0,
  toetsen: new Set(),
  laatsteActie: 0,
  verborgenVars: new Set(), // variabelen waarvan het tellertje verborgen is
  telBeweeg: 0,             // hoe vaak een beweeg-commando is uitgevoerd
  telSchiet: 0,             // hoe vaak een schiet-commando is uitgevoerd
  telZeg: 0,                // hoe vaak een zeg-commando is uitgevoerd (stap 7)
  telUiterlijk: 0,          // zeg/kleur/flits/geluid samen (stap 8)
  telZetVar: 0,             // hoe vaak een "maak … " is uitgevoerd (stap 9)
  telStat: 0,               // hoe vaak het programma zelf een statpunt gaf (stap 10)
  telSignaal: 0,            // hoe vaak een signaal is verstuurd (stap 16)
  telOntvangen: 0,          // hoe vaak een signaal ook echt een stapeltje startte
  signaalWachtrij: [],      // verstuurde signalen, afgehandeld bij de volgende tik
  /*
   * Basisbesturing (alleen les 2): rijden met de pijltjes, mikken met de muis
   * en schieten met de muisknop werken dan meteen, zónder dat daar blokken
   * voor op je werkblad staan. In les 1 is dat juist de leerstof — daar staat
   * dit dus uit. In les 2 heb je het al geleerd en gaat het over tactiek: je
   * werkblad blijft leeg voor de nieuwe opdrachten.
   */
  basisBesturing: false,
  angleGezet: false,        // heeft het programma zelf gericht deze tik?
};

/* ---------------- toetsen bijhouden (invoer!) ---------------- */
window.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  runtime.toetsen.add(normToets(e.key));
  if (runtime.draait && [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => runtime.toetsen.delete(normToets(e.key)));
function normToets(k) { return k.length === 1 ? k.toLowerCase() : k; }

/* ---------------- starten / stoppen ---------------- */
function runtimeStart() {
  runtime.scripts = window.compileerProject();
  runtime.threads = [];
  runtime.vars = {};
  runtime.verborgenVars.clear();
  runtime.signaalWachtrij = [];
  runtime.startTijd = Date.now(); // voor de stopwatch ⏱
  runtime.draait = true;
  for (const s of runtime.scripts) {
    if (s.trigger.type === 'start') startThread(s);
  }
}

function runtimeStop() {
  runtime.draait = false;
  runtime.threads = [];
  runtime.intent = { mx: 0, my: 0, angle: runtime.intent.angle, shoot: false };
  spel.stuurIntent(runtime.intent);
}

function startThread(script) {
  runtime.threads = runtime.threads.filter((th) => th.script !== script); // herstart
  runtime.threads.push({ script, stack: [{ cmds: script.body, i: 0, soort: 'seq' }], wachtTot: 0 });
}

/* Server-gebeurtenissen (geraakt/levelup/dood) starten de juiste hats. */
function runtimeEvent(type) {
  if (!runtime.draait) return;
  for (const s of runtime.scripts) {
    if (s.trigger.type === type) startThread(s);
  }
}

/*
 * Signaal versturen (zoals "zend bericht" in Scratch): elk stapeltje dat met
 * "wanneer ik signaal … ontvang" begint en dezelfde naam heeft, start opnieuw.
 * De threads worden alleen aangemaakt — ze draaien pas bij de volgende tik.
 * Daardoor kan een signaal dat zichzelf verstuurt niet vastlopen.
 */
function runtimeSignaal(naam) {
  if (!runtime.draait) return;
  runtime.signaalWachtrij.push(naam);
}

/* De wachtrij afhandelen — gebeurt aan het begin van een tik, dus NIET terwijl
   we door runtime.threads lopen. Een stapeltje dat zijn eigen signaal opnieuw
   verstuurt draait daardoor één keer per tik in plaats van eeuwig in dezelfde. */
function verwerkSignalen() {
  const namen = runtime.signaalWachtrij;
  if (!namen.length) return;
  runtime.signaalWachtrij = [];
  for (const naam of namen) {
    for (const s of runtime.scripts) {
      if (s.trigger.type !== 'signaal' || s.trigger.naam !== naam) continue;
      startThread(s);
      runtime.telOntvangen++;
    }
  }
}

/*
 * De basisbesturing van les 2. Ze vult alleen aan wat het programma van de
 * leerling zélf niet doet: rijdt hij met eigen blokken, dan gaat hij niet
 * dubbel zo snel, en richt hij zelf op de dichtstbijzijnde vijand, dan pakt de
 * muis het stuur niet over.
 */
function pasBasisBesturingToe(intent) {
  if (!runtime.angleGezet) {
    const ik = spel.mijnTank();
    if (ik) intent.angle = Math.atan2(spel.muisWereld.y - ik.y, spel.muisWereld.x - ik.x);
  }
  if (intent.mx === 0 && intent.my === 0) {
    if (runtime.toetsen.has('ArrowUp')) intent.my -= 1;
    if (runtime.toetsen.has('ArrowDown')) intent.my += 1;
    if (runtime.toetsen.has('ArrowLeft')) intent.mx -= 1;
    if (runtime.toetsen.has('ArrowRight')) intent.mx += 1;
  }
  if (!intent.shoot && spel.muisKnop) intent.shoot = true;
}

/* ---------------- de tik (30x per seconde) ---------------- */
setInterval(() => {
  // Ook zonder gestart programma moet je in les 2 kunnen rijden en schieten,
  // anders sta je stil tot je op de groene vlag drukt.
  if (!runtime.draait) {
    if (!runtime.basisBesturing) return;
    const los = { mx: 0, my: 0, angle: runtime.intent.angle, shoot: false };
    runtime.angleGezet = false;
    pasBasisBesturingToe(los);
    runtime.intent = los;
    spel.stuurIntent(los);
    return;
  }
  const nu = Date.now();

  verwerkSignalen();

  // toets-hats: start als de toets ingedrukt is en het script klaar is
  for (const s of runtime.scripts) {
    if (s.trigger.type !== 'toets') continue;
    if (!runtime.toetsen.has(normToets(s.trigger.toets))) continue;
    const bezig = runtime.threads.some((th) => th.script === s);
    if (!bezig) runtime.threads.push({ script: s, stack: [{ cmds: s.body, i: 0, soort: 'seq' }], wachtTot: 0 });
  }

  // per tik: beweging en schieten opnieuw verzamelen (richthoek blijft staan)
  runtime.intent.mx = 0;
  runtime.intent.my = 0;
  runtime.intent.shoot = false;
  runtime.angleGezet = false;

  for (const th of runtime.threads) {
    if (nu < th.wachtTot) continue;
    stapThread(th, nu);
  }
  runtime.threads = runtime.threads.filter((th) => th.stack.length > 0);

  if (runtime.basisBesturing) pasBasisBesturingToe(runtime.intent);
  spel.stuurIntent(runtime.intent);
}, 1000 / 30);

/* Eén thread laten lopen tot hij klaar is, moet wachten, of "yieldt". */
function stapThread(th, nu) {
  let ops = 0;
  while (th.stack.length > 0) {
    if (++ops > 500) return; // stok erachter
    const frame = th.stack[th.stack.length - 1];

    if (frame.i >= frame.cmds.length) {
      if (frame.soort === 'forever') { frame.i = 0; return; }            // yield: volgende tik verder
      if (frame.soort === 'repeat') {
        frame.rest--;
        if (frame.rest > 0) { frame.i = 0; return; }                     // yield per rondje, zoals Scratch
      }
      th.stack.pop();
      continue;
    }

    const c = frame.cmds[frame.i++];
    switch (c.t) {
      case 'beweeg':
        if (c.r === 'omhoog') runtime.intent.my -= 1;
        if (c.r === 'omlaag') runtime.intent.my += 1;
        if (c.r === 'links') runtime.intent.mx -= 1;
        if (c.r === 'rechts') runtime.intent.mx += 1;
        runtime.telBeweeg++;
        break;
      case 'richtMuis': {
        const ik = spel.mijnTank();
        if (ik) { runtime.intent.angle = Math.atan2(spel.muisWereld.y - ik.y, spel.muisWereld.x - ik.x); runtime.angleGezet = true; }
        break;
      }
      // Graden precies zoals Scratch: 0 = omhoog, 90 = rechts, 180 = omlaag,
      // -90 = links. Op het scherm groeit y naar beneden, dus we draaien 90°
      // terug om bij de wiskundige hoek uit te komen.
      case 'richtGraden': runtime.intent.angle = ((evalueer(c.v) - 90) * Math.PI) / 180; runtime.angleGezet = true; break;
      case 'draaiGeschut': {
        const graden = evalueer(c.n) * (c.kant === 'links' ? -1 : 1);
        let a = runtime.intent.angle + (graden * Math.PI) / 180;
        // netjes binnen -180°..180° houden
        runtime.intent.angle = Math.atan2(Math.sin(a), Math.cos(a));
        runtime.angleGezet = true;
        break;
      }
      case 'richtNaar': {
        const ik = spel.mijnTank();
        if (ik) {
          const doel = c.doel === 'muis' ? spel.muisWereld
            : c.doel === 'vijand' ? spel.dichtstbijVijand()
              : spel.dichtstbijVorm();
          if (doel) { runtime.intent.angle = Math.atan2(doel.y - ik.y, doel.x - ik.x); runtime.angleGezet = true; }
        }
        break;
      }
      // Scratch-manier: eerst een richting kiezen, dan stappen zetten. Dit
      // stuurt de tank zelf; het geschut blijft doen waar het mee bezig is.
      case 'richtRij': runtime.rijrichting = ((evalueer(c.v) - 90) * Math.PI) / 180; break;
      case 'neemStappen': {
        const kracht = Math.max(-1, Math.min(1, evalueer(c.n) / 10));
        runtime.intent.mx += Math.cos(runtime.rijrichting) * kracht;
        runtime.intent.my += Math.sin(runtime.rijrichting) * kracht;
        runtime.telBeweeg++;
        break;
      }
      case 'beweegStappen': {
        // 10 stappen = volle snelheid, in de richting van het geschut
        const kracht = Math.max(-1, Math.min(1, evalueer(c.n) / 10)) * (c.r === 'achteruit' ? -1 : 1);
        runtime.intent.mx += Math.cos(runtime.intent.angle) * kracht;
        runtime.intent.my += Math.sin(runtime.intent.angle) * kracht;
        runtime.telBeweeg++;
        break;
      }
      case 'toonVar': runtime.verborgenVars.delete(c.naam); break;
      case 'verbergVar': runtime.verborgenVars.add(c.naam); break;
      case 'schiet': runtime.intent.shoot = true; runtime.telSchiet++; break;
      case 'upgrade': spel.toonUpgrade(); break;
      case 'zeg': stuurActieMet({ zeg: c.s }); runtime.telZeg++; runtime.telUiterlijk++; break;
      case 'kleur': stuurActieMet({ kleur: c.v }); runtime.telUiterlijk++; break;
      case 'wordKlasse': spel.wordKlasse(c.klasse); runtime.telUiterlijk++; break;
      case 'flits': stuurActieMet({ flits: c.v }); runtime.telUiterlijk++; break;
      case 'geluid': speelGeluid(c.v); runtime.telUiterlijk++; break;
      case 'zetVar': runtime.vars[c.naam] = evalueer(c.v); runtime.telZetVar++; break;
      case 'veranderVar': runtime.vars[c.naam] = (runtime.vars[c.naam] || 0) + evalueer(c.v); break;
      case 'wacht':
        th.wachtTot = nu + Math.max(0, evalueer(c.v)) * 1000;
        return;
      case 'wachtTot':
        if (!evalueer(c.c)) { frame.i--; return; } // volgende tik opnieuw checken
        break;
      case 'geefStat': stuurStatMet(c.stat); runtime.telStat++; break;
      case 'zendSignaal': runtimeSignaal(c.naam); runtime.telSignaal++; break;
      case 'als':
        th.stack.push({ cmds: evalueer(c.c) ? c.dan : c.anders, i: 0, soort: 'seq' });
        break;
      case 'herhaal': {
        const n = Math.min(1000, Math.max(0, Math.round(evalueer(c.n))));
        if (n > 0) th.stack.push({ cmds: c.body, i: 0, soort: 'repeat', rest: n });
        break;
      }
      case 'forever':
        th.stack.push({ cmds: c.body, i: 0, soort: 'forever' });
        break;
    }
  }
}

function stuurActieMet(a) {
  const nu = Date.now();
  if (nu - runtime.laatsteActie < 200) return; // niet spammen
  runtime.laatsteActie = nu;
  spel.stuurActie(a);
}

let laatsteStatVerzoek = 0;
function stuurStatMet(stat) {
  const nu = Date.now();
  if (nu - laatsteStatVerzoek < 150) return; // niet spammen; server valideert toch
  laatsteStatVerzoek = nu;
  spel.kiesStat(stat);
}

/* ---------------- waarden uitrekenen (verwerking!) ---------------- */
function evalueer(x) {
  if (!x) return 0;
  switch (x.e) {
    case 'num': return x.v;
    case 'bool': return x.v;
    case 'reken': {
      const a = evalueer(x.a), b = evalueer(x.b);
      if (x.op === '+') return a + b;
      if (x.op === '-') return a - b;
      if (x.op === '*') return a * b;
      return b === 0 ? 0 : a / b;
    }
    case 'vergelijk': {
      const a = evalueer(x.a), b = evalueer(x.b);
      return x.op === '>' ? a > b : x.op === '<' ? a < b : a === b;
    }
    case 'en': return !!(evalueer(x.a) && evalueer(x.b));
    case 'of': return !!(evalueer(x.a) || evalueer(x.b));
    case 'niet': return !evalueer(x.a);
    case 'willekeurig': {
      const a = evalueer(x.a), b = evalueer(x.b);
      return Math.floor(Math.random() * (Math.max(a, b) - Math.min(a, b) + 1)) + Math.min(a, b);
    }
    case 'toets': return runtime.toetsen.has(normToets(x.k));
    case 'muisknop': return spel.muisKnop;
    case 'muisX': return Math.round(spel.muisWereld.x);
    case 'muisY': return Math.round(spel.muisWereld.y);
    case 'mijnX': { const ik = spel.mijnTank(); return ik ? ik.x : 0; }
    case 'mijnY': { const ik = spel.mijnTank(); return ik ? ik.y : 0; }
    case 'levens': { const ik = spel.mijnTank(); return ik ? ik.hp : 0; }
    case 'score': { const ik = spel.mijnTank(); return ik ? ik.score : 0; }
    case 'level': { const ik = spel.mijnTank(); return ik ? ik.level : 1; }
    case 'afstand': return spel.afstandVijand();
    case 'raakIk': return x.wat === 'kogel' ? spel.geraaktDoorKogel() : spel.raakIk(x.wat);
    case 'inBasis': return spel.inBasis();
    case 'krachtKogel': return spel.krachtKogel();
    case 'besteScore': return spel.besteScore();
    case 'mijnPlaats': return spel.mijnPlaats();
    case 'maxLevens': return spel.maxLevens();
    case 'stat': { const ik = spel.mijnTank(); return (ik && ik.stats && ik.stats[x.naam]) || 0; }
    case 'statPunten': { const ik = spel.mijnTank(); return ik ? ik.statPunten : 0; }
    case 'stopwatch': return Math.round((Date.now() - (runtime.startTijd || Date.now())) / 100) / 10;
    case 'var': return runtime.vars[x.naam] || 0;
    default: return 0;
  }
}

window.runtimeStart = runtimeStart;
window.runtimeStop = runtimeStop;
window.runtimeEvent = runtimeEvent;
window.runtime = runtime; // voor de variabele-tellertjes op het speelveld
