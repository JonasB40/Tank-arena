/*
 * ANIMATIES BIJ DE MOEILIJKE STAPPEN
 *
 * Sommige stappen vragen een handeling die je met woorden nauwelijks uitlegt:
 * een zeshoekig blokje in een zeshoekig gaatje schuiven, een getal in een blok
 * veranderen, of een KNOP indrukken die geen blok is. Kinderen van tien lezen
 * daar makkelijk overheen — maar ze kijken wél naar een handje dat het voordoet
 * (zoals in LEGO Spike).
 *
 * Daarom tekenen we hier kleine filmpjes na: dezelfde blokvormen en dezelfde
 * kleuren als in de echte editor, maar nagetekend op een canvas. Dat is licht,
 * werkt op elke chromebook, en we bepalen zelf precies wat er beweegt.
 *
 * Elke animatie is een functie (c, t) waarin t de tijd in seconden is binnen
 * één lus. De lus herhaalt zich vanzelf, met een adempauze aan het eind.
 */
(function (root) {
  const KLEUR = {
    beweging: '#4C97FF',
    gebeurtenissen: '#FFBF00',
    besturen: '#FFAB19',
    waarnemen: '#5CB1D6',
    variabelen: '#FF8C1A',
  };
  const RAND = (kleur) => donkerder(kleur, 0.78);

  function donkerder(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------------- bouwstenen ---------------- */

  /* Een gewoon commandoblok: rechthoek met het Scratch-nokje boven en onder. */
  function stapelBlok(c, x, y, b, h, kleur, tekst, opties = {}) {
    const r = 4, nok = 9, nokX = 12;
    c.save();
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + nokX, y);
    c.lineTo(x + nokX + 3, y + 4);
    c.lineTo(x + nokX + nok, y + 4);
    c.lineTo(x + nokX + nok + 3, y);
    c.lineTo(x + b - r, y);
    c.quadraticCurveTo(x + b, y, x + b, y + r);
    c.lineTo(x + b, y + h - r);
    c.quadraticCurveTo(x + b, y + h, x + b - r, y + h);
    c.lineTo(x + nokX + nok + 3, y + h);
    c.lineTo(x + nokX + nok, y + h + 4);
    c.lineTo(x + nokX + 3, y + h + 4);
    c.lineTo(x + nokX, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.fillStyle = kleur;
    c.fill();
    c.strokeStyle = RAND(kleur);
    c.lineWidth = 1.5;
    c.stroke();
    if (tekst) {
      c.fillStyle = '#fff';
      c.font = `600 ${opties.grootte || 11}px Segoe UI, sans-serif`;
      c.textBaseline = 'middle';
      c.fillText(tekst, x + 10, y + h / 2);
    }
    c.restore();
  }

  /* Een zeshoekig blokje (een vraag: "toets ingedrukt?"). */
  function hexBlok(c, x, y, b, h, kleur, tekst, alpha = 1) {
    const p = h / 2;
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.moveTo(x + p, y);
    c.lineTo(x + b - p, y);
    c.lineTo(x + b, y + h / 2);
    c.lineTo(x + b - p, y + h);
    c.lineTo(x + p, y + h);
    c.lineTo(x, y + h / 2);
    c.closePath();
    c.fillStyle = kleur;
    c.fill();
    c.strokeStyle = RAND(kleur);
    c.lineWidth = 1.5;
    c.stroke();
    if (tekst) {
      c.fillStyle = '#fff';
      c.font = '600 10px Segoe UI, sans-serif';
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      c.fillText(tekst, x + b / 2, y + h / 2);
      c.textAlign = 'left';
    }
    c.restore();
  }

  /* Het lege zeshoekige GAATJE in een als-blok. */
  function hexGat(c, x, y, b, h, gloed) {
    const p = h / 2;
    c.save();
    if (gloed) {
      c.shadowColor = '#fff';
      c.shadowBlur = 10 * gloed;
    }
    c.beginPath();
    c.moveTo(x + p, y);
    c.lineTo(x + b - p, y);
    c.lineTo(x + b, y + h / 2);
    c.lineTo(x + b - p, y + h);
    c.lineTo(x + p, y + h);
    c.lineTo(x, y + h / 2);
    c.closePath();
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.fill();
    c.strokeStyle = gloed ? '#fff' : 'rgba(0,0,0,.3)';
    c.lineWidth = gloed ? 2 : 1;
    c.stroke();
    c.restore();
  }

  /* Een wit invulvakje met een getal erin (zoals de graden). */
  function getalVak(c, x, y, b, h, tekst, gloed) {
    c.save();
    if (gloed) { c.shadowColor = '#fff'; c.shadowBlur = 10 * gloed; }
    c.beginPath();
    c.roundRect(x, y, b, h, h / 2);
    c.fillStyle = '#fff';
    c.fill();
    if (gloed) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
    c.restore();
    c.fillStyle = '#2d3436';
    c.font = '600 10px Segoe UI, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.fillText(tekst, x + b / 2, y + h / 2 + 0.5);
    c.textAlign = 'left';
  }

  /* Een rond gaatje (daar hoort een waarde in, bv. "max levens"). */
  function rondGat(c, x, y, b, h, gloed) {
    c.save();
    if (gloed) { c.shadowColor = '#fff'; c.shadowBlur = 10 * gloed; }
    c.beginPath();
    c.roundRect(x, y, b, h, h / 2);
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.fill();
    c.strokeStyle = gloed ? '#fff' : 'rgba(0,0,0,.3)';
    c.lineWidth = gloed ? 2 : 1;
    c.stroke();
    c.restore();
  }

  /* Een afgerond blokje dat een waarde is (past in een rond gaatje). */
  function rondBlok(c, x, y, b, h, kleur, tekst, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.roundRect(x, y, b, h, h / 2);
    c.fillStyle = kleur;
    c.fill();
    c.strokeStyle = RAND(kleur);
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#fff';
    c.font = '600 10px Segoe UI, sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.fillText(tekst, x + b / 2, y + h / 2);
    c.textAlign = 'left';
    c.restore();
  }

  /* Het als-blok: een C-vorm met een gaatje voor de vraag. */
  function alsBlok(c, x, y, b, kleur, opties = {}) {
    const kop = 22, binnen = opties.binnen || 20, staart = 12;
    c.save();
    c.beginPath();
    c.roundRect(x, y, b, kop, 4);
    c.roundRect(x, y + kop + binnen, b * 0.72, staart, 4);
    c.rect(x, y + kop, 13, binnen);
    c.fillStyle = kleur;
    c.fill();
    c.strokeStyle = RAND(kleur);
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#fff';
    c.font = '600 11px Segoe UI, sans-serif';
    c.textBaseline = 'middle';
    c.fillText('als', x + 8, y + kop / 2);
    c.fillText('dan', x + b - 26, y + kop / 2);
    c.restore();
    return { gatX: x + 26, gatY: y + 4, kop, binnen };
  }

  /* Het tekenhandje dat de blokken versleept (zoals in LEGO Spike). */
  function hand(c, x, y, knijpt) {
    c.save();
    c.translate(x, y);
    c.scale(0.5, 0.5);
    c.beginPath();
    // wijsvinger omhoog, rest gebald — bewust simpel, het moet klein leesbaar zijn
    c.moveTo(0, 0);
    c.bezierCurveTo(2, -14, 4, -30, 6, -42);
    c.bezierCurveTo(7, -50, 19, -50, 19, -42);
    c.lineTo(19, -14);
    c.lineTo(24, -18);
    c.bezierCurveTo(30, -23, 39, -15, 34, -9);
    c.lineTo(34, -6);
    c.bezierCurveTo(40, -10, 47, -3, 42, 3);
    c.bezierCurveTo(47, 1, 52, 8, 47, 13);
    c.bezierCurveTo(44, 26, 34, 34, 22, 34);
    c.bezierCurveTo(8, 34, 0, 24, -1, 12);
    c.closePath();
    c.fillStyle = '#fff';
    c.fill();
    c.strokeStyle = '#2d3436';
    c.lineWidth = knijpt ? 4 : 3;
    c.lineJoin = 'round';
    c.stroke();
    c.restore();
  }

  /* Een tekstregel onder de animatie: wat gebeurt er nu? */
  function bijschrift(c, tekst, breedte, hoogte) {
    c.save();
    c.fillStyle = '#5b4400';
    c.font = '600 10.5px Segoe UI, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillText(tekst, breedte / 2, hoogte - 6);
    c.restore();
  }

  /* Soepel van 0 naar 1 (traag starten, traag stoppen). */
  const soepel = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
  /* Hoever ben je in dit stukje van de film? */
  const deel = (t, van, tot) => soepel((t - van) / (tot - van));

  /* ---------------- de drie filmpjes ---------------- */

  const ANIMATIES = {
    /*
     * STAP 3 — het zeshoekje in het zeshoekige gaatje.
     * Dit is de handeling waar de meeste leerlingen op stukliepen: ze legden
     * "toets ingedrukt?" ONDER het als-blok in plaats van erín.
     */
    3: {
      duur: 6.5,
      teken(c, t, B, H) {
        const als = alsBlok(c, 24, 26, 150, KLEUR.besturen, { binnen: 24 });
        stapelBlok(c, 37, 26 + als.kop + 3, 118, 17, KLEUR.beweging, 'neem 10 stappen', { grootte: 10 });

        // het gaatje zit tussen "als" en "dan", binnen de kop van het blok
        const gatB = 92, gatH = 15;
        const doelX = als.gatX, doelY = als.gatY + 1;

        // 1. het blokje ligt links klaar   2. het handje sleept het erheen
        const vlucht = deel(t, 1.1, 3.2);
        const vast = t > 3.2;
        // het blokje ligt links onder klaar; hoger dan de onderrand, anders
        // valt het handje half buiten het doek
        const startX = 12, startY = 62;
        const x = startX + (doelX - startX) * vlucht;
        const y = startY + (doelY - startY) * vlucht;

        if (!vast) {
          hexGat(c, doelX, doelY, gatB, gatH, vlucht > 0.15 ? 0.4 + 0.6 * vlucht : 0);
          hexBlok(c, x, y, gatB, gatH, KLEUR.waarnemen, 'toets ↑ ingedrukt?');
          if (t > 0.8) hand(c, x + gatB * 0.5, y + gatH + 2, t > 1.1);
        } else {
          // klik! even opgloeien op zijn plek
          const puls = Math.max(0, 1 - (t - 3.2) * 2.2);
          hexBlok(c, doelX, doelY, gatB, gatH, KLEUR.waarnemen, 'toets ↑ ingedrukt?');
          if (puls > 0) {
            c.save();
            c.globalAlpha = puls;
            c.strokeStyle = '#fff';
            c.lineWidth = 3;
            hexGat(c, doelX - 2, doelY - 2, gatB + 4, gatH + 4, puls);
            c.restore();
          }
        }

        bijschrift(c,
          t < 1.1 ? 'het zeshoekje hoort in het zeshoekige gaatje'
            : t < 3.2 ? 'sleep het naar het gaatje…'
              : t < 4.6 ? 'klik! nu rijdt hij alleen bij ↑'
                : 'en je stappen-blok zit ERIN, niet eronder', B, H);
      },
    },

    /*
     * STAP 4 — het getal van de graden veranderen.
     * Kinderen vergeten bij het dupliceren het gétal aan te passen, waardoor
     * twee toetsen dezelfde kant op rijden. Het kompas laat zien welk getal
     * bij welke richting hoort.
     */
    4: {
      duur: 7.5,
      teken(c, t, B, H) {
        const graden = [0, 90, 180, -90];
        const pijl = ['↑', '→', '↓', '←'];
        const stap = Math.min(3, Math.floor(t / 1.7));
        const binnenIn = (t % 1.7) / 1.7;

        // het blok met het invulvakje, bovenaan
        const bx = (B - 156) / 2;
        stapelBlok(c, bx, 14, 156, 20, KLEUR.beweging, 'richt naar', { grootte: 11 });
        const klikt = binnenIn > 0.25 && binnenIn < 0.5;
        getalVak(c, bx + 72, 18, 34, 13, String(graden[stap]), klikt ? 1 : 0);
        c.fillStyle = '#fff';
        c.font = '600 11px Segoe UI, sans-serif';
        c.textBaseline = 'middle';
        c.fillText('graden', bx + 111, 24);

        // het handje tikt op het vakje
        if (binnenIn < 0.55) hand(c, bx + 84 + Math.sin(binnenIn * 9) * 1.5, 36, klikt);

        // een kompas eronder dat meedraait: welk getal is welke kant?
        const cx = B / 2, cy = 66, r = 18;
        c.save();
        c.strokeStyle = '#c9b8ea';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = '#7a5c9e';
        c.font = '600 9px Segoe UI, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('0', cx, cy - r - 6);
        c.fillText('90', cx + r + 9, cy);
        c.fillText('180', cx, cy + r + 7);
        c.fillText('-90', cx - r - 11, cy);
        // de tank wijst de kant op die bij het getal hoort
        const hoek = (graden[stap] - 90) * Math.PI / 180;
        c.translate(cx, cy);
        c.rotate(hoek);
        c.fillStyle = '#3498db';
        c.beginPath();
        c.arc(0, 0, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#8b96a8';
        c.fillRect(6, -3.5, 12, 7);
        c.restore();

        bijschrift(c, `pijltje ${pijl[stap]} hoort bij ${graden[stap]} graden`, B, H);
      },
    },

    /*
     * STAP 7 — een variabele maken.
     * De valkuil: "Maak een variabele" is een KNOP, geen blok. Wie dat niet
     * doorheeft, zoekt zich blind naar een blokje dat er niet is.
     */
    7: {
      duur: 9,
      teken(c, t, B, H) {
        // de knop bovenaan de oranje categorie
        const knopB = 108, knopX = 14, knopY = 18;
        const klikt = t > 1.2 && t < 1.8;
        c.save();
        c.beginPath();
        c.roundRect(knopX, knopY, knopB, 20, 10);
        c.fillStyle = klikt ? '#e07a12' : KLEUR.variabelen;
        c.fill();
        if (t < 2 && Math.floor(t * 3) % 2 === 0) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
        c.fillStyle = '#fff';
        c.font = '600 10px Segoe UI, sans-serif';
        c.textBaseline = 'middle';
        c.textAlign = 'center';
        c.fillText('➕ Maak een variabele', knopX + knopB / 2, knopY + 10);
        c.textAlign = 'left';
        c.restore();
        if (t < 2.1) hand(c, knopX + knopB / 2, knopY + 22, klikt);

        // het venstertje waarin je de naam typt
        if (t > 2.1 && t < 4.4) {
          const v = deel(t, 2.1, 2.5);
          c.save();
          c.globalAlpha = v;
          c.beginPath();
          c.roundRect(B / 2 - 62, 26, 124, 44, 8);
          c.fillStyle = '#fff';
          c.fill();
          c.strokeStyle = '#855cd6';
          c.lineWidth = 2;
          c.stroke();
          c.fillStyle = '#3d2d63';
          c.font = '600 9px Segoe UI, sans-serif';
          c.fillText('Nieuwe variabelenaam:', B / 2 - 54, 38);
          c.beginPath();
          c.roundRect(B / 2 - 54, 44, 76, 15, 4);
          c.fillStyle = '#f3eefb';
          c.fill();
          c.fillStyle = '#2d3436';
          c.font = '600 10px Segoe UI, sans-serif';
          // de naam wordt letter voor letter getypt
          const naam = 'Levens'.slice(0, Math.max(0, Math.floor((t - 2.6) * 6)));
          c.fillText(naam + (Math.floor(t * 3) % 2 ? '|' : ''), B / 2 - 50, 55);
          c.fillStyle = '#4CBF56';
          c.beginPath();
          c.roundRect(B / 2 + 26, 44, 30, 15, 5);
          c.fill();
          c.fillStyle = '#fff';
          c.font = '600 9px Segoe UI, sans-serif';
          c.textAlign = 'center';
          c.fillText('OK', B / 2 + 41, 52);
          c.textAlign = 'left';
          c.restore();
          if (t > 3.9) hand(c, B / 2 + 41, 62, t > 4.1);
        }

        // en dan het nieuwe blok, met het ronde gaatje
        if (t > 4.5) {
          const v = deel(t, 4.5, 5);
          c.save();
          c.globalAlpha = v;
          stapelBlok(c, 20, 52, 148, 20, KLEUR.variabelen, 'maak Levens =', { grootte: 10 });
          c.restore();

          const gatX = 110, gatY = 56, gatB = 52, gatH = 13;
          const vlucht = deel(t, 5.6, 7.4);
          const vast = t > 7.4;
          if (!vast) {
            rondGat(c, gatX, gatY, gatB, gatH, vlucht > 0.1 ? vlucht : 0);
            const sx = 18, sy = 84;
            const x = sx + (gatX - sx) * vlucht, y = sy + (gatY - sy) * vlucht;
            rondBlok(c, x, y, gatB, gatH, KLEUR.variabelen, 'max levens');
            if (t > 5.3) hand(c, x + gatB / 2, y + gatH + 2, t > 5.6);
          } else {
            rondBlok(c, gatX, gatY, gatB, gatH, KLEUR.variabelen, 'max levens');
          }
        }

        bijschrift(c,
          t < 2.1 ? 'let op: dit is een KNOP, geen blok'
            : t < 4.4 ? 'typ de naam: Levens'
              : t < 5.6 ? 'nu staat je eigen blok in de lade'
                : t < 7.4 ? 'sleep max levens in het ronde gaatje'
                  : 'klaar: je tank onthoudt nu zijn levens', B, H);
      },
    },
  };

  root.STAP_ANIMATIES = ANIMATIES;
})(typeof window !== 'undefined' ? window : globalThis);
