/*
 * Tekenen: het speelveld, de camera, de minikaart, het scorebord en de HUD.
 * spelTik() en teken() worden pas gestart in spel-start.js.
 * Deel van het spel in de browser (spel-*.js, geladen in deze volgorde).
 */

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
/* Volledig scherm verlaten zonder onze knop — met Esc, het kruisje van de
   browser, of op de iPad naar beneden vegen — zet ook het speelveld terug
   naast je blokken. Anders bleven de blokken verborgen terwijl het volledig
   scherm al weg was, en zocht een kind de weg terug. */
for (const soort of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(soort, () => {
    const vol = document.fullscreenElement || document.webkitFullscreenElement;
    if (!vol && document.body.classList.contains('speelmodus')) zetGrootte('normaal');
  });
}
/* Op een liggende iPad (1024-1180 px breed) bleef er naast het gewone
   speelveld maar een smalle strook werkblad over: na de blokkenlade amper
   250 px om te bouwen. Rechtop was het werkblad om dezelfde reden laag. Op
   zulke schermen begint het speelveld klein; met ◻ of ⛶ maak je het groter
   zodra je wil spelen. (Een telefoon scrolt, daar hoeft dit niet.) */
if (window.innerWidth > 600 && window.innerWidth < 1200) zetGrootte('klein');

/* ---------------- toast-meldingen ---------------- */
let toastTimer = null;
function toast(tekst, ms) {
  const el = document.getElementById('toast');
  el.textContent = tekst;
  el.classList.remove('verborgen');
  clearTimeout(toastTimer);
  // lange zinnen langer laten staan: een kind van acht leest geen twintig woorden in 2,6 seconden
  toastTimer = setTimeout(() => el.classList.add('verborgen'), ms || Math.max(2600, tekst.length * 70));
}

/* ---------------- tekenen (uitvoer!) ---------------- */
function maatAanpassen() {
  canvas.width = podium.clientWidth;
  canvas.height = podium.clientHeight;
  /* Met de joysticks aan staan de statbalken linksboven en de spatieknop
     linksonder. Op een liggende iPad (Safari neemt bovenaan ook ruimte in)
     kwamen ze over elkaar te liggen. De balkjes worden dus zo hoog als er
     plaats is: 26 px als het kan, kleiner als het moet. */
  const stokMaat = document.body.classList.contains('podium-klein') ? 104 : 128;
  const vrij = canvas.height - (14 + stokMaat + 10 + 40) - 10 - 8;   // onder de spatieknop af, boven een randje
  const rij = Math.max(14, Math.min(26, Math.floor(vrij / 8) - 3));
  document.getElementById('stat-balken').style.setProperty('--sb-hoogte', rij + 'px');
  // de joysticks zijn kleiner op een klein speelveld
  if (spel.meetRichtstokOpnieuw) spel.meetRichtstokOpnieuw();
}
window.addEventListener('resize', maatAanpassen);

/*
 * De camera volgt je tank. Dat gebeurt nu bij elk beeldje (zestig keer per
 * seconde) en niet meer dertig keer per seconde in een losse tik: anders
 * schoof de hele wereld in schokjes onder je door, ook al bewogen de tanks
 * zelf vloeiend. Hoe snel hij bijtrekt hangt af van de echte tijd tussen twee
 * beeldjes, zodat het op een trage chromebook even snel aanvoelt.
 */
function werkCameraBij(dt, ik) {
  if (ik) {
    const k = 1 - Math.exp(-dt * 4.9);   // ≈ 15% per dertigste seconde, zoals vroeger
    camera.x += (ik.x - camera.x) * k;
    camera.y += (ik.y - camera.y) * k;
  }
  /*
   * De camera blijft binnen de arena. Zonder deze klem stond je bij de start
   * (je basis ligt in de hoek) met het halve scherm buiten het speelveld te
   * kijken naar zwarte leegte — zonde van de ruimte, en je zag minder van het
   * spel dan iemand die in het midden stond. Past de arena in het venster,
   * dan centreren we hem gewoon.
   */
  // het zichtbare stuk wereld is groter dan het canvas doordat we uitzoomen
  /* Ondergrens: een Ranger op level 45 zoomt zo ver uit dat je op een klein
     podium je eigen tank nauwelijks nog ziet. Bij 0.30 is de romp nog altijd
     een pixel of tien groot. */
  zoomDoel = ik ? Math.max(0.30, ZOOM / zichtVan(ik.klasse, ik.level)) : ZOOM;
  zoom += (zoomDoel - zoom) * (1 - Math.exp(-dt * 1.86));   // ≈ 6% per dertigste seconde
  const zichtB = canvas.width / zoom, zichtH = canvas.height / zoom;
  /* De server stuurt alleen wat je kan zien, dus moet hij weten hoe groot je
     venster is. Dat verandert zelden (schermgrootte, uitzoomen bij een
     sluipschutter), dus we melden het pas als het echt anders is. */
  if (mijnId && (Math.abs(zichtB - gemeldZicht.w) > zichtB * 0.06
              || Math.abs(zichtH - gemeldZicht.h) > zichtH * 0.06)) {
    gemeldZicht = { w: zichtB, h: zichtH };
    socket.emit('kijk', { w: Math.round(zichtB), h: Math.round(zichtH) });
  }
  /* ...maar niet helemaal tot tegen de rand. Klemden we de camera precies op
     de rand, dan stond je tank bij de start (je basis ligt in de hoek
     linksonder) ook op je scherm in de hoek linksonder — precies onder de
     statbalken, waardoor je je eigen tank niet zag. Nu mag de camera een
     stukje (30% van het beeld) over de rand kijken. */
  const halfB = zichtB / 2, halfH = zichtH / 2;
  const overRand = Math.min(zichtB, zichtH) * 0.3;
  camera.x = arena.w <= zichtB ? arena.w / 2 : Math.max(halfB - overRand, Math.min(arena.w - halfB + overRand, camera.x));
  camera.y = arena.h <= zichtH ? arena.h / 2 : Math.max(halfH - overRand, Math.min(arena.h - halfH + overRand, camera.y));
  /* Even doorschudden als je geraakt wordt: een paar pixels, kort. Meer is
     hinderlijk als je net probeert te mikken. */
  let schokX = 0, schokY = 0;
  if (Date.now() < schok.tot) {
    const rest = (schok.tot - Date.now()) / 180;
    schokX = (Math.random() - 0.5) * schok.kracht * rest * 2;
    schokY = (Math.random() - 0.5) * schok.kracht * rest * 2;
  }
  tekenOffset = { x: canvas.width / 2 - camera.x * zoom + schokX, y: canvas.height / 2 - camera.y * zoom + schokY };
}

/*
 * Muis-wereldpositie, HUD en de vinkjes van de les lopen op een vaste tik, LOS
 * van het tekenen: requestAnimationFrame pauzeert in verborgen tabbladen en de
 * spellogica mag daar nooit van afhangen.
 */
let laatsteTekenbeurt = 0;
function spelTik() {
  if (canvas.width !== podium.clientWidth || canvas.height !== podium.clientHeight) maatAanpassen();
  const ik = spel.mijnTank();
  // er wordt niet getekend (tabblad op de achtergrond)? dan hier de camera bijhouden
  if (performance.now() - laatsteTekenbeurt > 250) werkCameraBij(1 / 30, ik);
  werkMuisWereldBij();
  vernieuwHud(ik);
  // de waarnemer kijkt mee voor de checkpoints van de les
  stapWaarnemer.tik(ik, eigenKogelsTeller, window.runtime ? runtime.vars : {});
  eigenKogelsTeller = 0;
}

function teken() {
  requestAnimationFrame(teken);
  const nuMs = performance.now();
  const dt = laatsteTekenbeurt ? Math.min(0.1, (nuMs - laatsteTekenbeurt) / 1000) : 1 / 60;
  laatsteTekenbeurt = nuMs;

  // buiten de arena: een tint donkerder dan de vloer, zoals in diep.io
  ctx.fillStyle = ARENA_BUITEN;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const zicht = huidigeTussenstand();
  if (!staat || !zicht) return;

  // alles op zijn tussenplek: zie "vloeiend bewegen" bovenaan
  const { a, b, f } = zicht;
  const tanks = b.s.tanks.map((t) => opTussenplek(t, a.tanks.get(t.id), f, 'angle'));
  const kogels = b.s.bullets.map((k) => opTussenplek(k, a.bullets.get(k.id), f, 'hoek'));
  const vormen = b.s.vormen.map((v) => opTussenplek(v, a.vormen.get(v.id), f, 'hoek'));

  werkCameraBij(dt, tanks.find((t) => t.id === mijnId) || spel.mijnTank());
  const ox = tekenOffset.x;
  const oy = tekenOffset.y;

  const nu = Date.now();
  bijwerkAnimaties(nu, kogels, vormen);

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
  drawHeuvel(ctx, staat.heuvel, nu);   // alleen tijdens een heuvelronde

  // vormen: zachtjes pulseren, wit flitsen bij een treffer
  for (const v of vormen) {
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
  for (const b of kogels) {
    const leeftijd = nu - (kogelGeboorte.get(b.id) || nu);
    const pop = leeftijd < 120 ? 1.45 - (leeftijd / 120) * 0.45 : 1;
    const alpha = b.tl < 300 ? Math.max(0.15, b.tl / 300) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawMunitie(ctx, b, pop);
    ctx.restore();
  }

  // tanks: terugstoot bij schieten, schudden bij een treffer
  for (const t of tanks) {
    if (t.dood) continue;
    const schud = t.flits === '#ff5252' ? 2.5 : 0;
    t.__recoil = nu - (terugstoot.get(t.id) || 0) < 110;
    ctx.save();
    ctx.translate(t.x + (Math.random() - 0.5) * schud * 2, t.y + (Math.random() - 0.5) * schud * 2);
    drawTank(ctx, t, t.id === mijnId);
    ctx.restore();
  }
  tekenLevelRingen(tanks, nu);

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
    const tekst = `+${p.n}${p.premie ? ' 👑' : ''}`;
    ctx.strokeText(tekst, p.x, p.y - d * 46);
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(tekst, p.x, p.y - d * 46);
    ctx.restore();
  }

  ctx.restore();

  tekenRaakMarker();
  tekenMinimap();
  /*
   * Het scorebord hoort bij het SPEL, niet bij de les. Wie in zijn eigen
   * oefenarena tegen de computer werkt, is aan het programmeren — dan hoeft
   * er geen ranglijst in beeld te staan waar hij toch alleen op staat.
   */
  if (modus === 'samen') tekenScorebord();
  // zonder scorebord horen de tellertjes weer helemaal bovenaan
  else document.getElementById('var-watchers').style.top = '';
  if (modus === 'samen') tekenKillFeed(nu);
  tekenSchadeFlits(nu);
}

/* ---------------- animatie-boekhouding ---------------- */
const kogelGeboorte = new Map();  // kogel-id -> eerste keer gezien
const terugstoot = new Map();     // tank-id -> laatst geschoten
const brokstukken = [];           // deeltjes van kapotte vormen
let vorigeVormen = new Map();

/* Gebeurt op wat er GETEKEND wordt (niet op de nieuwste stand): anders vloog
   een vorm al in brokstukken terwijl hij nog een fractie van een seconde in
   beeld stond. */
function bijwerkAnimaties(nu, kogels, vormen) {
  // nieuwe kogels registreren (voor de pop + terugstoot van de schutter)
  const levend = new Set();
  for (const b of kogels) {
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
  for (const v of vormen) huidige.set(v.id, v);
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

/* ---------------- level omhoog en raak ----------------
 * Een level omhoog: een gouden ring die uitdijt rond de tank. Iedereen in de
 * buurt ziet het (de server zet "lu" een seconde in het pakketje); bij een
 * nieuwe klasse (level 15, 30, 45) is de ring groter en staat er voor jezelf
 * bij dat je mag kiezen. Vroeger kwam er alleen een melding onderaan.
 */
const levelRingen = new Map();   // tank-id → { level, start }
const KLASSE_LEVELS = [15, 30, 45];
function tekenLevelRingen(tanks, nu) {
  for (const t of tanks) {
    if (!t.lu || t.dood) continue;
    const ring = levelRingen.get(t.id);
    if (!ring || ring.level !== t.lu) levelRingen.set(t.id, { level: t.lu, start: nu });
  }
  for (const [id, ring] of levelRingen) {
    const d = (nu - ring.start) / 1000;
    const t = tanks.find((x) => x.id === id);
    if (d > 1 || !t) { if (d > 1) levelRingen.delete(id); continue; }
    const groot = KLASSE_LEVELS.includes(ring.level);
    const r = (t.r || 22) * (1.15 + d * (groot ? 3.2 : 2));
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - d);
    ctx.strokeStyle = groot ? '#ffcf33' : '#fff3a6';
    ctx.lineWidth = groot ? 9 : 5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (id === mijnId) {
      const tekst = groot ? `⬆ LEVEL ${ring.level} — kies een nieuwe tank!` : `⬆ LEVEL ${ring.level}`;
      ctx.font = `bold ${groot ? 22 : 18}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,24,32,.85)';
      const ty = t.y - (t.r || 22) - 46 - d * 30;
      ctx.strokeText(tekst, t.x, ty);
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(tekst, t.x, ty);
    }
    ctx.restore();
  }
}

/* Raak: een klein wit kruisje rond je mikpunt (zie raakMarker in spel-verbinding.js). */
function tekenRaakMarker() {
  const over = raakMarker.tot - performance.now();
  if (over <= 0) return;
  const { x, y } = spel.muisScherm;
  const binnen = 5 + (220 - over) / 50, buiten = binnen + 7;
  ctx.save();
  ctx.globalAlpha = Math.min(1, over / 120);
  ctx.lineCap = 'round';
  for (const [kleur, dikte] of [['rgba(20,24,32,.7)', 5], ['#ffffff', 2.5]]) {
    ctx.strokeStyle = kleur;
    ctx.lineWidth = dikte;
    ctx.beginPath();
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      ctx.moveTo(x + sx * binnen, y + sy * binnen);
      ctx.lineTo(x + sx * buiten, y + sy * buiten);
    }
    ctx.stroke();
  }
  ctx.restore();
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
/*
 * Staat de richtjoystick rechtsonder? Dan schuift de kaart erboven. De hoogte
 * meten we hooguit één keer per seconde: elk beeldje opvragen dwong de browser
 * om de hele pagina opnieuw op te meten (de HUD verandert ondertussen), en dat
 * kost op een oudere iPad merkbaar tijd.
 */
let richtstokRuimte = 0, richtstokGemeten = 0;
// joysticks aan/uit of een ander formaat speelveld: meteen opnieuw meten
spel.meetRichtstokOpnieuw = () => { richtstokGemeten = 0; };
function ruimteVoorRichtstok() {
  const nu = performance.now();
  if (nu - richtstokGemeten > 1000) {
    richtstokGemeten = nu;
    const stok = document.getElementById('richtstok');
    richtstokRuimte = stok && !stok.classList.contains('verborgen') ? stok.offsetHeight + 24 : 0;
  }
  return richtstokRuimte;
}

/*
 * Waar staat de minikaart (en hoe groot)? Op één plek uitgerekend, zodat het
 * tekenen en de rest het altijd eens zijn. Op het kleine speelveld (▫) is ze
 * kleiner; staan daar ook nog de joysticks, dan laten we haar weg — in 320
 * pixels breed passen twee joysticks, een spatieknop en een kaart gewoon niet
 * naast elkaar. Op een klein speelveld ben je vooral aan het programmeren.
 */
function minikaartPlek() {
  const klein = document.body.classList.contains('podium-klein');
  if (klein && ruimteVoorRichtstok()) return null;
  const mw = Math.round(Math.min(240, Math.max(klein ? 100 : 150, canvas.width * 0.2)));
  const mh = Math.round(mw * (arena.h / arena.w));
  return { x: canvas.width - mw - 14, y: canvas.height - mh - 14 - ruimteVoorRichtstok(), w: mw, h: mh };
}
spel.minikaartPlek = minikaartPlek;

function tekenMinimap() {
  const plek = minikaartPlek();
  if (!plek) return;
  const { w: mw, h: mh, x: mx, y: my } = plek;
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

  // de heuvel: een stip in de kleur van wie hem houdt, wit omrand als hij betwist is
  if (staat.heuvel) {
    const h = staat.heuvel;
    const houder = h.houder;
    ctx.fillStyle = !houder ? 'rgba(138,148,173,.8)'
      : houder.team !== undefined ? (TEAM_ZONE_KLEUREN[houder.team] || '#fff') : (houder.kleur || '#fff');
    ctx.beginPath();
    ctx.arc(px(h.x), py(h.y), Math.max(4, h.r * s), 0, Math.PI * 2);
    ctx.fill();
    if (h.betwist) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
  }

  const ik = staat.tanks.find((t) => t.id === mijnId);

  // de andere tanks als stipje in hun teamkleur
  for (const t of staat.tanks) {
    // een onzichtbare Sluiper of Landmijn verraden we ook niet op de kaart
    if (t.dood || t.onzichtbaar || t.id === mijnId) continue;
    ctx.fillStyle = t.kleur;
    ctx.beginPath();
    ctx.arc(px(t.x), py(t.y), t.ai ? 2.2 : 3.2, 0, Math.PI * 2);
    ctx.fill();
    // echte spelers krijgen een randje: die zijn belangrijker dan de robots
    if (!t.ai) { ctx.strokeStyle = 'rgba(20,24,34,.8)'; ctx.lineWidth = 1; ctx.stroke(); }
    // de koning: een gouden ring, zodat je weet waar de premie rondrijdt
    if (t.kroon) {
      ctx.strokeStyle = '#ffcf33';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(t.x), py(t.y), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  /* Loopt er een ronde? Dan telt wat je DEZE ronde verdiend hebt — anders
     staat wie al een uur speelt onhaalbaar ver voor. */
  const ronde = staat.ronde;
  const punt = (t) => (ronde ? (t.rondePunten || 0) : t.score);
  const top = [...spelers].sort((a, b) => punt(b) - punt(a));
  const ik = spel.mijnTank();
  const rijen = top.slice(0, 5);
  if (ik && !rijen.some((t) => t.id === ik.id)) rijen.push(ik);

  const teams = [];
  if (staat.teamModus) {
    const som = new Map();
    for (const t of staat.tanks) {
      if (t.team === null || t.team === undefined) continue;
      som.set(t.team, (som.get(t.team) || 0) + punt(t));
    }
    for (let i = 0; i < staat.teamModus; i++) if (!som.has(i)) som.set(i, 0);
    teams.push(...[...som.entries()].sort((a, b) => b[1] - a[1]));
  }

  // op het kleine speelveld smaller, anders botst hij met de statbalken
  const klein = document.body.classList.contains('podium-klein');
  const B = klein ? 132 : 168, regel = 17, kopH = teams.length ? teams.length * regel + 8 : 0;
  const heuvel = staat.heuvel;
  const klokH = (ronde ? 26 : 0) + (heuvel ? 16 : 0);
  const H = 24 + klokH + kopH + rijen.length * regel + 6;
  const x = canvas.width - B - 12, y = 12;
  /* De variabelen-tellertjes staan ook rechtsboven. Het scorebord groeit met
     het aantal spelers, dus schuiven we ze er netjes onder in plaats van
     erdoorheen. */
  const watchers = document.getElementById('var-watchers');
  if (watchers) watchers.style.top = Math.round(y + H + 8) + 'px';
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
  /* De klok van de ronde: hoeveel tijd nog, en waar spelen we voor? De laatste
     halve minuut kleurt rood — dan wordt het spannend. */
  if (ronde) {
    const m = Math.floor(ronde.over / 60), sec = ronde.over % 60;
    ctx.font = 'bold 17px Segoe UI, sans-serif';
    ctx.fillStyle = ronde.over <= 30 ? '#ff7b6b' : '#ffd54f';
    ctx.fillText(`⏱ ${m}:${String(sec).padStart(2, '0')}`, x + 10, y + 38);
    if (ronde.doel) {
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.fillStyle = '#9aa3bb';
      ctx.textAlign = 'right';
      ctx.fillText(`tot ${ronde.doel} ptn`, x + B - 10, y + 38);
      ctx.textAlign = 'left';
    }
    // heuvelronde: wie houdt de heuvel nu?
    if (heuvel) {
      const houder = heuvel.houder;
      ctx.font = 'bold 11px Segoe UI, sans-serif';
      ctx.fillStyle = heuvel.betwist ? '#ffffff'
        : !houder ? '#9aa3bb'
          : houder.team !== undefined ? (TEAM_ZONE_KLEUREN[houder.team] || '#fff') : (houder.kleur || '#fff');
      const wie = heuvel.betwist ? 'betwist!'
        : !houder ? 'nog vrij'
          : houder.team !== undefined ? (TEAM_NAAM_CLIENT[houder.team] || 'Team ' + houder.team) : houder.naam;
      ctx.fillText(`🏔 heuvel: ${String(wie).slice(0, 14)}`, x + 10, y + 55);
    }
    ry += klokH;
  }
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
    const naam = (t.kroon ? '👑' : '') + String(t.naam || '').slice(0, klein ? 9 : 13);
    ctx.fillText(naam, x + 10, ry);
    ctx.textAlign = 'right';
    ctx.fillText(String(punt(t)), x + B - 10, ry);
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
    dood.textContent = verslagenDoor
      ? `💥 Verslagen door ${verslagenDoor}! Je komt terug over ${ik.respawnOver}...`
      : `💥 Kapot! Je komt zwakker terug over ${ik.respawnOver}...`;
  } else {
    dood.classList.add('verborgen');
    verslagenDoor = null;
  }
  vernieuwStatOverzicht(ik);
  vernieuwVariabeleTellers();
  if (!ik) return;

  document.getElementById('hud-score').textContent = ik.score;
  document.getElementById('hud-level').textContent = ik.level;
  // inhaalbonus actief? dan zie je dat: vormen leveren anderhalve keer zoveel op
  document.getElementById('hud-inhaal').classList.toggle('verborgen', !ik.inhaal);
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

  if ((ik.statPunten > 0 && statpuntenMogenZichtbaar()) || (ik.klasseAanbod && ik.klasseAanbod.length)) {
    statChip.classList.remove('verborgen');
    statChip.textContent = ik.klasseAanbod && ik.klasseAanbod.length
      ? '⬆️ Nieuwe klasse beschikbaar!'
      : `⬆️ ${ik.statPunten} statpunt${ik.statPunten > 1 ? 'en' : ''}`;
  } else {
    statChip.classList.add('verborgen');
  }
}
document.getElementById('hud-statpunten').addEventListener('click', () => spel.toonUpgrade());
