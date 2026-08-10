/*
 * Gedeelde tekenfuncties voor het spelscherm en de beamer.
 * Vereist dat klassen.js eerst geladen is (window.KLASSEN).
 */
function drawVorm(c, vorm, r) {
  c.beginPath();
  if (vorm === 'cirkel') {
    c.arc(0, 0, r, 0, Math.PI * 2);
  } else if (vorm === 'ster') {
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.5;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      c[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  } else {
    const hoeken = { driehoek: 3, vierkant: 4, vijfhoek: 5 }[vorm] || 6;
    for (let i = 0; i < hoeken; i++) {
      const a = (i * 2 * Math.PI) / hoeken - Math.PI / 2;
      c[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  }
}

/* Kleuren zoals diep.io: neutraal grijze lopen, romp in teamkleur. */
const LOOP_KLEUR = '#999999';
const LOOP_RAND = '#727272';
const RAND = 3;             // dikte van elke omtreklijn

/* Een kleur donkerder maken — diep.io omlijnt alles met een donkerder tint
   van de kleur zelf, niet met zwart. Dat oogt veel rustiger. */
function donkerder(kleur, f) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(kleur || ''));
  if (!m) return 'rgba(0,0,0,0.4)';
  const n = parseInt(m[1], 16);
  const k = (v) => Math.round(v * (f || 0.72));
  return `rgb(${k((n >> 16) & 255)},${k((n >> 8) & 255)},${k(n & 255)})`;
}

/*
 * Bouwt het pad van één kanon in tank-coördinaten (de aanroeper heeft al naar
 * de kijkrichting gedraaid). Zie https://diepio.fandom.com/wiki/Cannons:
 * normaal = rechthoek, sniper = lang, destroyer = breed, gunner = dun,
 * machinegeweer = breder aan de muzzle, trapezium = breder aan de basis
 * (Ranger/Predator), launcher = rechthoek met brede kop (Trapper).
 */
function cannonPad(c, l, type, terug) {
  // l.start schuift een loop naar voren, zodat je twee lopen achter elkaar kan
  // zetten (de trap van de Jager) in plaats van over elkaar heen
  const x0 = terug + (l.start || 0), x1 = terug + (l.start || 0) + l.len, hw = l.w / 2;
  let pts;
  if (type === 'machinegeweer') {
    const b = hw * 0.62, t = hw * 1.15;
    pts = [[x0, -b], [x1, -t], [x1, t], [x0, b]];
  } else if (type === 'trapezium') {
    const b = hw * 1.25, t = hw * 0.85;
    pts = [[x0, -b], [x1, -t], [x1, t], [x0, b]];
  } else if (type === 'spawner') {
    const b = hw * 0.7, t = hw * 1.3; // dronefabriek: wijd open aan het uiteinde
    pts = [[x0, -b], [x1, -t], [x1, t], [x0, b]];
  } else if (type === 'stuw') {
    // stuwpijp van de Driehoekstank/Booster: smal aan de romp, wijd naar achter
    const b = hw * 0.55, t = hw * 1.35;
    pts = [[x0, -b], [x1, -t], [x1, t], [x0, b]];
  } else if (type === 'launcher') {
    /* Valstrikwerper: een loop die vooraan uitwaaiert tot een trechter. Eerst
       was de kop een recht blok dat op de loop geplakt leek; een schuine kop
       leest als een lanceerbuis, zoals in diep.io. */
    const k = hw * 1.6, d = Math.min(12, l.len * 0.34);
    pts = [[x0, -hw], [x1 - d, -hw], [x1, -k], [x1, k], [x1 - d, hw], [x0, hw]];
  } else {
    pts = [[x0, -hw], [x1, -hw], [x1, hw], [x0, hw]];
  }
  // draai naar de hoek van deze loop en schuif hem opzij
  const cos = Math.cos(l.hoek), sin = Math.sin(l.hoek);
  c.beginPath();
  pts.forEach(([x, y0], i) => {
    const y = y0 + l.zij;
    const px = x * cos - y * sin, py = x * sin + y * cos;
    c[i === 0 ? 'moveTo' : 'lineTo'](px, py);
  });
  c.closePath();
}

/*
 * Alle lopen van een tank. Eerst álle omtrekken, dán álle vullingen: zo lopen
 * de randen van elkaar rakende kanonnen netjes in elkaar over in plaats van
 * dat er donkere naden ontstaan waar ze overlappen (zoals in diep.io).
 */
function drawLopen(c, lopen, type, terug) {
  if (!lopen.length) return;
  c.lineJoin = 'miter';
  c.lineCap = 'butt';
  c.strokeStyle = LOOP_RAND;
  c.lineWidth = RAND * 2; // de helft valt binnen de vorm en wordt straks overschilderd
  // Een loop mag een eigen vorm hebben (l.vorm). Zo krijgt de Jager zijn brede
  // onderstuk met een smalle loop erop, en de Driehoekstank echte stuwpijpen —
  // in diep.io heeft één tank namelijk niet altijd overal hetzelfde kanon.
  const vormVan = (l) => l.vorm || type;
  for (const l of lopen) { cannonPad(c, l, vormVan(l), terug); c.stroke(); }
  c.fillStyle = LOOP_KLEUR;
  for (const l of lopen) { cannonPad(c, l, vormVan(l), terug); c.fill(); }
}

/* Tekent één tank op (0,0) — de aanroeper doet translate/scale. */
function drawTank(c, t, isIk) {
  const klasse = KLASSEN[t.klasse] || KLASSEN.basis;

  // sluiper: bijna onzichtbaar (jij ziet je eigen tank nog vaag)
  if (t.onzichtbaar) {
    if (!isIk) return;
    c.globalAlpha = 0.3;
  }

  const lijf = t.flits || t.kleur;

  // rammer/stekelbol: stekels achter de romp (grijs, mét omtrek zoals de lopen)
  if (klasse.ram) {
    c.save();
    c.rotate(t.angle);
    drawVorm(c, klasse.stekels ? 'ster' : 'zeshoek', klasse.stekels ? 34 : 30);
    c.lineJoin = 'round';
    c.strokeStyle = LOOP_RAND;
    c.lineWidth = RAND * 2;
    c.stroke();
    c.fillStyle = LOOP_KLEUR;
    c.fill();
    c.restore();
  }

  // lopen (kanonnen) per klasse — vorm hangt af van het cannon-type (diep.io)
  c.save();
  c.rotate(t.angle);
  drawLopen(c, klasse.lopen, klasse.cannon || 'normaal', t.__recoil ? -5 : 0);
  c.restore();

  // romp: omtrek in een donkerder tint van de eigen kleur (zoals diep.io),
  // en een witte ring als het jouw eigen tank is
  drawVorm(c, t.vorm, 22);
  c.lineJoin = 'round';
  c.strokeStyle = isIk ? '#ffffff' : donkerder(lijf);
  c.lineWidth = RAND * 2;
  c.stroke();
  c.fillStyle = lijf;
  c.fill();

  // schild
  if (t.schild) {
    c.beginPath();
    c.arc(0, 0, 34, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(79,195,247,0.9)';
    c.lineWidth = 3;
    c.stroke();
  }

  /* Naam + levensbalk horen bij het spel, niet bij een plaatje. In het
     keuzevenster voor je nieuwe tankklasse stond boven elk voorbeeld een
     groen streepje dat daar niets betekende — daar tekenen we alleen de tank
     zelf (t.alleenVorm). */
  if (!t.alleenVorm) {
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    c.font = 'bold 13px Segoe UI, sans-serif';
    c.fillText(t.naam, 0, -38);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(-24, -32, 48, 6);
    c.fillStyle = t.hp / t.maxHp > 0.4 ? '#2ecc71' : '#e74c3c';
    c.fillRect(-24, -32, 48 * (t.hp / t.maxHp), 6);
  }

  // tekstballon
  if (t.zeg) {
    c.font = '13px Segoe UI, sans-serif';
    const w = c.measureText(t.zeg).width + 16;
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    c.roundRect(-w / 2, -68, w, 24, 8);
    c.fill();
    c.fillStyle = '#1a1d27';
    c.fillText(t.zeg, 0, -51);
  }
  c.globalAlpha = 1;
}

/* Tekent één vorm/obstakel (vierkant, driehoek, vijfhoek of muur). */
function drawVormObj(c, v) {
  c.save();
  c.translate(v.x, v.y);
  c.rotate(v.hoek || 0);
  const p = v.__pulse || 1;   // zachtjes pulseren (animatie)
  c.scale(p, p);
  const vormNaam = v.type === 'muur' ? 'vierkant'
    : v.type === 'alfa' ? 'vijfhoek'
      : v.jaagt ? 'driehoek'          // crashers zijn roze driehoekjes
        : v.type;
  drawVorm(c, vormNaam, v.r);
  c.lineJoin = 'round';
  c.strokeStyle = donkerder(v.kleur);          // donkerder tint, geen zwart
  c.lineWidth = (v.type === 'muur' ? 4 : RAND) * 2;
  c.stroke();
  c.fillStyle = v.hit ? '#ffffff' : v.kleur;   // wit flitsje bij een treffer
  c.fill();
  c.restore();

  // levensbalkje enkel als de vorm al geraakt is
  if (v.hp < v.maxHp) {
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(v.x - v.r, v.y + v.r + 6, v.r * 2, 5);
    c.fillStyle = '#2ecc71';
    c.fillRect(v.x - v.r, v.y + v.r + 6, v.r * 2 * (v.hp / v.maxHp), 5);
  }
}

/*
 * Munitie tekenen. Drie soorten, zoals in diep.io:
 *   kogel — rond, vult zijn loop (https://diepio.fandom.com/wiki/Bullets)
 *   drone — driehoekje dat zelf op vijanden afgaat (.../wiki/Drones)
 *   trap  — driepuntige ster die blijft liggen (.../wiki/Traps)
 * Allemaal in de kleur van hun eigenaar, met een donkerder omtrek.
 */
function drawMunitie(c, b, schaal) {
  const r = (b.r || 6) * (schaal || 1);
  c.save();
  c.translate(b.x, b.y);
  c.lineJoin = 'round';
  c.strokeStyle = donkerder(b.kleur);
  c.lineWidth = RAND * 2;
  c.fillStyle = b.kleur;

  if (b.soort === 'drone') {
    c.rotate(b.hoek || 0);
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      c[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
    }
    c.closePath();
  } else if (b.soort === 'trap') {
    c.rotate(b.hoek || 0);
    c.beginPath();
    for (let i = 0; i < 6; i++) {                 // concave zeshoek = driepuntige ster
      // flink uitgesproken punten, anders vult de dikke omtreklijn de
      // inkepingen op en ziet een trap er net zo uit als een drone
      const rr = i % 2 === 0 ? r * 1.85 : r * 0.55;
      const a = (i * Math.PI) / 3;
      c[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  } else {
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
  }
  c.stroke();
  c.fill();
  c.restore();
}

/* Tekent de teamzones (les 2): veilige spawn-gebieden per team. */
const TEAM_ZONE_KLEUREN = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6'];

function drawZones(c, zones) {
  for (const z of zones || []) {
    const kleur = TEAM_ZONE_KLEUREN[z.team] || '#ffffff';
    c.save();
    c.globalAlpha = 0.13;
    c.fillStyle = kleur;
    c.fillRect(z.x, z.y, z.w, z.h);
    c.globalAlpha = 0.6;
    c.setLineDash([12, 8]);
    c.lineWidth = 3;
    c.strokeStyle = kleur;
    c.strokeRect(z.x, z.y, z.w, z.h);
    c.restore();
  }
}

/* Tekent de arena-achtergrond (vloer, raster, rand) op (0,0). */
function drawArena(c, arena, lijnDikte) {
  c.fillStyle = '#181c2a';
  c.fillRect(0, 0, arena.w, arena.h);
  c.strokeStyle = 'rgba(255,255,255,0.05)';
  c.lineWidth = lijnDikte || 1;
  for (let x = 0; x <= arena.w; x += 80) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, arena.h); c.stroke();
  }
  for (let y = 0; y <= arena.h; y += 80) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(arena.w, y); c.stroke();
  }
  c.strokeStyle = '#4fc3f7';
  c.lineWidth = (lijnDikte || 1) * 4;
  c.strokeRect(0, 0, arena.w, arena.h);
}
