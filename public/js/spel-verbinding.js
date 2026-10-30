/*
 * Het podium: verbindt de blokjes-runtime met de server en tekent het spel.
 * Uitvoer! Hier zie je wat je programma doet: de tank beweegt, de score
 * stijgt, vormen gaan kapot.
 */
/* Nog niet verbinden: dat doet spel-start.js, als alle stukken geladen zijn.
   Anders kon een bericht van de server (bv. "ogen op mij" bij binnenkomst)
   aankomen vóór de code die het afhandelt er was. Wat je intussen al
   verstuurt, bewaart socket.io tot de verbinding er is. */
const socket = io({ autoConnect: false });

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
 * benauwd. Omgekeerd zag je op 0,72 zoveel veld dat alles klein en ver weg
 * leek. Nagerekend tegen een schermafdruk van diep.io: daar passen ongeveer
 * 37 vierkanten naast elkaar op het scherm. Op deze zoom zijn dat er bij ons
 * 36 — even dichtbij dus, en je tank is een herkenbare bol in plaats van een
 * stipje. Vanaf hier zoomt de camera uit met je level (zie zichtVan).
 */
const ZOOM = 1;
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
      // onzichtbaar = niet te zien, dus ook niet om op te mikken (zoals de koepels op de server)
      if (t.id === mijnId || t.dood || t.onzichtbaar) continue;
      if (t.team !== undefined && t.team !== null && t.team === ik.team) continue; // teamgenoten niet
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
socket.on('connect', () => {
  if (!laatsteJoin) return;
  socket.emit('join', laatsteJoin);
  // na een herstart van de server is de nieuwe arena niet gepauzeerd
  if (!window.runtime.bevroren) document.body.classList.remove('gepauzeerd');
});

/* De vaste eigenschappen van elke vormsoort krijgen we één keer bij binnenkomst;
   daarna stuurt de server per vorm alleen nog de plaats en de draaiing mee. */
let vormSoorten = {};
socket.on('welkom', (d) => {
  mijnId = d.id; arena = d.arena; vormSoorten = d.vormSoorten || {};
  // nieuwe arena (of herstarte server): de oude standen horen er niet meer bij
  tussenstanden.length = 0;
  klokVerschil = null;
  /* Welke versie draait er op de server? Node leest zijn code alleen bij het
     starten: verversen in de browser helpt dan niet en je speelt met oude
     regels verder. Met dit stempeltje zie je in één blik of dat het geval is. */
  const vak = document.getElementById('serverversie');
  if (vak && d.versie) {
    vak.textContent = d.verouderd ? `⚠ server draait oude code (${d.versie}) — herstarten!` : `v ${d.versie}`;
    vak.classList.toggle('verouderd', !!d.verouderd);
  }
});
/* Vol: terug naar het startmenu. Anders zat de leerling voor een leeg
   speelveld zonder te weten waarom. */
socket.on('vol', () => {
  modus = null;
  laatsteJoin = null;
  startmenu.classList.remove('verborgen');
  meldInStartmenu('😕 De arena zit vol! Vraag de begeleider om hulp.');
});
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
  bewaarTussenstand(s);
  // wisselt de lesgever van teamopstelling, dan hoort de leerling dat te zien
  if (typeof meldTeamstand === 'function') meldTeamstand();
});

/* ---------------- vloeiend bewegen ----------------
 * De server stuurt de wereld twintig keer per seconde; het scherm tekent er
 * zestig. Vroeger stond alles drie beeldjes stil en sprong het dan verder: een
 * kogel maakte sprongen van zo'n 25 pixels, en via de wifi van een klas komen
 * pakketjes ook nog eens onregelmatig binnen. Nu tekenen we een fractie van een
 * seconde "in het verleden" en schuiven we elke tank, kogel en vorm vloeiend
 * tussen de twee standen in waar dat moment tussen valt — zoals diep.io dat
 * ook doet. Elk pakketje draagt daarvoor het tijdstip van de server mee (t).
 *
 * Alleen het TEKENEN gebeurt zo. Het programma van de leerling, de vinkjes en
 * de minikaart blijven de nieuwste stand gebruiken.
 */
const tussenstanden = [];   // de laatste paar standen: { t, s, tanks, bullets, vormen }
let klokVerschil = null;    // servertijd min eigen tijd
let gemGat = 50;            // gemiddelde tijd tussen twee standen (ms)

function bewaarTussenstand(s) {
  if (typeof s.t !== 'number') return;
  const verschil = s.t - performance.now();
  /* De snelste aankomst is de eerlijkste schatting: wat later binnenkwam, had
     onderweg vertraging. Trager meeschuiven blijft mogelijk (de klokken van
     server en chromebook lopen nooit helemaal gelijk). */
  if (klokVerschil === null || verschil > klokVerschil) klokVerschil = verschil;
  else klokVerschil += (verschil - klokVerschil) * 0.02;
  const stand = {
    t: s.t, s,
    tanks: new Map(s.tanks.map((x) => [x.id, x])),
    bullets: new Map(s.bullets.map((x) => [x.id, x])),
    vormen: new Map(s.vormen.map((x) => [x.id, x])),
  };
  const laatste = tussenstanden[tussenstanden.length - 1];
  // dezelfde stand nog eens (de wereld staat op pauze): vervangen, niet stapelen
  if (laatste && s.t <= laatste.t) { tussenstanden[tussenstanden.length - 1] = stand; return; }
  if (laatste) gemGat += (Math.min(200, s.t - laatste.t) - gemGat) * 0.1;
  tussenstanden.push(stand);
  if (tussenstanden.length > 6) tussenstanden.shift();
}

/* Tussen welke twee standen valt "nu min een klein beetje", en hoe ver? */
function huidigeTussenstand() {
  const n = tussenstanden.length;
  if (!n) return null;
  if (n < 2 || klokVerschil === null) return { a: tussenstanden[n - 1], b: tussenstanden[n - 1], f: 1 };
  // anderhalve keer de tijd tussen twee pakketjes: zo is de volgende er bijna altijd al
  const vertraging = Math.max(40, Math.min(150, gemGat * 1.5));
  const tijdstip = performance.now() + klokVerschil - vertraging;
  for (let i = n - 1; i > 0; i--) {
    const a = tussenstanden[i - 1];
    if (a.t <= tijdstip) {
      const b = tussenstanden[i];
      // kwam het volgende pakketje te laat, dan blijft alles op de nieuwste stand staan
      return { a, b, f: Math.min(1, (tijdstip - a.t) / Math.max(1, b.t - a.t)) };
    }
  }
  return { a: tussenstanden[0], b: tussenstanden[1], f: 0 };
}

const SPRONG = 400;   // verder dan dit in één stap is een sprong (respawn): niet glijden
function tussenWaarde(a, b, f) { return Math.abs(b - a) > SPRONG ? b : a + (b - a) * f; }
function tussenHoek(a, b, f) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));   // altijd de korte kant om
  return a + d * f;
}
/* Een kopie van "nieuw" op de plek tussen "oud" en "nieuw" in. Stond hij stil,
   dan gewoon het origineel (dat scheelt honderden kopietjes per beeldje). */
function opTussenplek(nieuw, oud, f, hoekVeld) {
  if (!oud || f >= 1) return nieuw;
  const draait = hoekVeld && typeof oud[hoekVeld] === 'number' && oud[hoekVeld] !== nieuw[hoekVeld];
  if (oud.x === nieuw.x && oud.y === nieuw.y && !draait) return nieuw;
  const o = Object.assign({}, nieuw);
  o.x = tussenWaarde(oud.x, nieuw.x, f);
  o.y = tussenWaarde(oud.y, nieuw.y, f);
  if (draait) o[hoekVeld] = tussenHoek(oud[hoekVeld], nieuw[hoekVeld], f);
  if (typeof oud.autoHoek === 'number' && typeof nieuw.autoHoek === 'number') {
    o.autoHoek = tussenHoek(oud.autoHoek, nieuw.autoHoek, f);
  }
  return o;
}
const scorePopups = []; // zwevende "+10"-tekstjes
/* ---------------- ronde: klok, start en uitslag ---------------- */
socket.on('rondeStart', (d) => {
  document.getElementById('ronde-uitslag').classList.add('verborgen');
  toast(d.soort === 'heuvel'
    ? `🏔 Verover de heuvel in het midden! Sta erop met je team, zonder tegenstanders, en je verdient punten. ${d.minuten} minuten — succes!`
    : `⏱ De ronde begint! ${d.minuten} minuten${d.doel ? ` · eerste op ${d.doel} punten wint` : ''} — succes!`, 7000);
  speelGeluid('tada');
});

socket.on('rondeKlaar', (r) => {
  const vak = document.getElementById('ronde-uitslag');
  const kop = document.getElementById('ru-winnaar');
  const reden = { tijd: 'De tijd is om.', doel: 'Het puntendoel is gehaald!', lesgever: 'De lesgever stopte de ronde.' };
  document.getElementById('ru-reden').textContent = reden[r.reden] || '';

  const ik = spel.mijnTank();
  if (r.teams && r.teams.length) {
    const winnaar = r.teams[0];
    const naam = TEAM_NAAM_CLIENT[winnaar.team] || ('Team ' + winnaar.team);
    const gelijk = r.teams.length > 1 && r.teams[1].punten === winnaar.punten;
    kop.textContent = gelijk ? '🤝 Gelijkspel!' : `🏆 ${naam} wint!`;
    if (!gelijk && ik && ik.team === winnaar.team) kop.textContent += ' 🎉';
  } else {
    const beste = r.spelers[0];
    kop.textContent = beste ? `🏆 ${beste.naam} wint!` : '🏁 Ronde voorbij';
  }

  const rij = (kleur, naam, punten, dik) =>
    `<div class="ru-rij"><span class="ru-kleur" style="background:${kleur}"></span>` +
    `<span class="${dik ? 'ru-team' : ''}">${naam}</span><b>${punten}</b></div>`;
  let html = (r.teams || []).map((t) =>
    rij(TEAM_ZONE_KLEUREN[t.team] || '#fff', TEAM_NAAM_CLIENT[t.team] || ('Team ' + t.team), t.punten, true)).join('');
  if (html) html += '<div class="ru-scheiding"></div>';
  html += (r.spelers || []).slice(0, 6).map((sp) =>
    rij(sp.kleur, (sp.ai ? '' : '👤 ') + sp.naam, sp.punten, false)).join('');
  document.getElementById('ru-lijst').innerHTML = html;
  vak.classList.remove('verborgen');
  speelGeluid('tada');
  // de server laat de arena 25 seconden stilstaan; daarna gaat het scherm weg
  setTimeout(() => vak.classList.add('verborgen'), 24000);
});

/* Rode flits + schok als je zelf geraakt wordt. */
const schade = { tot: 0, kracht: 0 };
const schok = { tot: 0, kracht: 0 };
/* Raak! Je kogel trof een andere tank: een tikje en een klein kruisje bij je
   mikpunt (zie spel-tekenen.js). Zo voel je elke treffer, niet alleen de laatste. */
const raakMarker = { tot: 0 };
let verslagenDoor = null;

/*
 * Kill feed: wie verslaat wie. Iedereen in de arena ziet hetzelfde lijstje,
 * en dat maakt van los rondrijden een wedstrijd — je leest dat je klasgenoot
 * net iemand te pakken had, ook als je aan de andere kant van de kaart zit.
 */
const killFeed = [];
socket.on('kill', (k) => {
  // droeg het slachtoffer de kroon? dan zie je dat ook in het lijstje
  if (k.premie) k.slachtoffer = '👑 ' + k.slachtoffer;
  killFeed.push({ ...k, start: Date.now() });
  if (killFeed.length > 5) killFeed.shift();
  if (k.dader === (document.getElementById('naam').value || '').trim()) speelGeluid('tada');
});

function tekenKillFeed(nu) {
  const x = canvas.width / 2;
  let y = 26;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px Segoe UI, sans-serif';
  for (const k of killFeed) {
    const oud = nu - k.start;
    if (oud > 6000) continue;
    ctx.globalAlpha = oud > 5000 ? (6000 - oud) / 1000 : 1;
    const tekst = `${k.dader}  ⚔  ${k.slachtoffer}`;
    const br = ctx.measureText(tekst).width + 20;
    ctx.fillStyle = 'rgba(30,34,46,.72)';
    ctx.beginPath();
    ctx.roundRect(x - br / 2, y - 14, br, 21, 10);
    ctx.fill();
    // de namen in hun eigen teamkleur, het zwaardje in het wit ertussen
    const halve = ctx.measureText(tekst).width / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = k.daderKleur || '#eef0f6';
    ctx.fillText(k.dader, x - halve, y);
    ctx.fillStyle = '#eef0f6';
    ctx.fillText('  ⚔  ', x - halve + ctx.measureText(k.dader).width, y);
    ctx.fillStyle = k.slachtofferKleur || '#eef0f6';
    ctx.fillText(k.slachtoffer, x + halve - ctx.measureText(k.slachtoffer).width, y);
    ctx.textAlign = 'center';
    y += 25;
  }
  ctx.restore();
  while (killFeed.length && nu - killFeed[0].start > 6000) killFeed.shift();
}

/* De rode rand bij schade: donker aan de randen, open in het midden. */
function tekenSchadeFlits(nu) {
  if (nu > schade.tot) return;
  const sterkte = ((schade.tot - nu) / 340) * (0.25 + schade.kracht * 0.4);
  const g = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.28,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.62,
  );
  g.addColorStop(0, 'rgba(200,30,30,0)');
  g.addColorStop(1, `rgba(200,30,30,${sterkte.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
let laatsteTreffer = { schade: 0, ongelezen: false }; // laatste klap die we kregen

socket.on('ev', (ev) => {
  window.runtimeEvent(ev.type);
  if (ev.type === 'levelup') { toast(`⬆️ Level omhoog! Je hebt nu een statpunt.`); speelGeluid('tada'); }
  if (ev.type === 'geraakt') {
    speelGeluid('tik');
    /* Voelen dat je geraakt wordt: een rode rand die wegdooft en een kleine
       schok. Vroeger zag je alleen je levensbalk zakken — in een druk gevecht
       merkte je pas dat je in de problemen zat toen je al dood was. */
    schade.tot = Date.now() + 340;
    schade.kracht = Math.min(1, (ev.schade || 5) / 25);
    schok.tot = Date.now() + 180;
    schok.kracht = 3 + schade.kracht * 7;
    // Onthouden hoe hard die treffer aankwam. De leerling vraagt dat op met
    // "raak ik een vijandelijke kogel?" en "kracht kogel". Die vraag mag maar
    // ÉÉN keer waar zijn per treffer — een herhaal-lus draait 30x per seconde
    // en zou anders zeven keer schade aftrekken van dezelfde kogel.
    // alleen échte kogels, geen aanrijdingen — het blok heet niet voor niets
    // "raak ik een vijandelijke kogel?"
    if (!ev.contact) laatsteTreffer = { schade: ev.schade || 0, ongelezen: true };
  }
  if (ev.type === 'punten') {
    scorePopups.push({ x: ev.x, y: ev.y, n: ev.n, start: Date.now(), premie: !!ev.premie });
    speelGeluid('plop');
    if (ev.premie) toast('👑 Je versloeg de koning van de arena: dubbele punten!');
  }
  if (ev.type === 'raak') {
    raakMarker.tot = performance.now() + 220;
    speelGeluid('raak');
  }
  if (ev.type === 'kroon') {
    toast('👑 Jij hebt nu de meeste punten van de arena! Wie jou verslaat, krijgt dubbele punten — pas goed op.', 6000);
    speelGeluid('tada');
  }
  if (ev.type === 'dood') verslagenDoor = ev.door || null;
});
