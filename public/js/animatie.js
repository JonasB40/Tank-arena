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

  /* Een afgerond blokje dat een waarde is (past in een rond gaatje). Met
     pijltje = een keuzeblok: één blok waarin je uit een lijstje kiest. */
  function rondBlok(c, x, y, b, h, kleur, tekst, alpha = 1, pijltje = false) {
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

  /* Een hoedblok: bovenaan rond, want er kan niets bovenop. */
  function hatBlok(c, x, y, b, h, kleur, tekst) {
    c.save();
    c.beginPath();
    c.moveTo(x, y + h);
    c.lineTo(x, y + 9);
    c.quadraticCurveTo(x + b * 0.22, y - 8, x + b * 0.5, y + 1);
    c.quadraticCurveTo(x + b * 0.78, y + 9, x + b, y + 4);
    c.lineTo(x + b, y + h);
    c.lineTo(x + 24, y + h);
    c.lineTo(x + 21, y + h + 4);
    c.lineTo(x + 15, y + h + 4);
    c.lineTo(x + 12, y + h);
    c.closePath();
    c.fillStyle = kleur;
    c.fill();
    c.strokeStyle = RAND(kleur);
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#fff';
    c.font = '600 9.5px Segoe UI, sans-serif';
    c.textBaseline = 'middle';
    c.fillText(tekst, x + 8, y + h / 2 + 3);
    c.restore();
  }

  /* Een uitklaplijstje: zo laat je zien dat er meer keuzes onder het pijltje
     zitten dan alleen wat er nu in het blok staat. */
  function keuzeLijst(c, x, y, b, keuzes, gekozen, alpha) {
    const h = 15;
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.roundRect(x, y, b, keuzes.length * h + 6, 6);
    c.fillStyle = '#e07a12';
    c.fill();
    c.strokeStyle = '#b35f08';
    c.lineWidth = 1.5;
    c.stroke();
    keuzes.forEach((k, i) => {
      if (i === gekozen) {
        c.beginPath();
        c.roundRect(x + 3, y + 3 + i * h, b - 6, h, 4);
        c.fillStyle = '#fff3e0';
        c.fill();
      }
      c.fillStyle = i === gekozen ? '#8a4b00' : '#fff';
      c.font = '600 9px Segoe UI, sans-serif';
      c.textBaseline = 'middle';
      c.fillText(k, x + 8, y + 3 + i * h + h / 2);
    });
    c.restore();
  }

  /* De groene vlag boven het speelveld: hiermee test je je programma. */
  function vlagKnop(c, x, y, ingedrukt) {
    c.save();
    c.beginPath();
    c.roundRect(x, y, 30, 26, 7);
    c.fillStyle = ingedrukt ? '#cdebd0' : '#fff';
    c.fill();
    c.strokeStyle = ingedrukt ? '#2e7d32' : '#c9b8ea';
    c.lineWidth = ingedrukt ? 2.5 : 1.5;
    c.stroke();
    c.translate(x + 15, y + 13);
    c.beginPath();
    c.moveTo(-5, -8); c.lineTo(-5, 8);
    c.strokeStyle = '#2e7d32';
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(-4, -7);
    c.bezierCurveTo(0, -9.5, 4, -4.5, 8, -7);
    c.lineTo(8, 0);
    c.bezierCurveTo(4, 2.5, 0, -2.5, -4, 0);
    c.closePath();
    c.fillStyle = '#4CBF56';
    c.fill();
    c.strokeStyle = '#2e7d32';
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }

  /* Een klein tankje, om te laten zien wat je programma dóet. */
  function miniTank(c, x, y, hoek) {
    c.save();
    c.translate(x, y);
    c.rotate(hoek || 0);
    c.fillStyle = '#8b96a8';
    c.strokeStyle = '#6d7787';
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(7, -3.5, 11, 7, 1);
    c.fill(); c.stroke();
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.fillStyle = '#3498db';
    c.strokeStyle = '#2a7cb0';
    c.fill(); c.stroke();
    c.restore();
  }

  /*
   * Een C-blok (als … dan, herhaal): ÉÉN doorlopende omtrek, zoals in Scratch.
   * Eerst tekenden we de kop, de staart en het linkerbalkje als drie losse
   * vormen; dan zie je de naden ertussen en valt het blok in stukken uiteen.
   */
  function alsBlok(c, x, y, b, kleur, opties = {}) {
    const kop = opties.kop || 22, binnen = opties.binnen || 20, staart = opties.staart || 12;
    const L = 13, r = 4;
    const y2 = y + kop, y3 = y2 + binnen, y4 = y3 + staart;
    c.save();
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + b, y, x + b, y + r, r);           // rechtsboven
    c.arcTo(x + b, y2, x + b - r, y2, r);         // rechts van de kop
    c.arcTo(x + L, y2, x + L, y2 + r, r);         // de mond in
    c.lineTo(x + L, y3 - r);
    c.arcTo(x + L, y3, x + L + r, y3, r);         // onderkant van de mond
    c.arcTo(x + b, y3, x + b, y3 + r, r);         // naar de staart
    c.arcTo(x + b, y4, x + b - r, y4, r);         // rechtsonder
    c.arcTo(x, y4, x, y4 - r, r);                 // linksonder
    c.arcTo(x, y, x + r, y, r);                   // helemaal terug omhoog
    c.closePath();
    c.fillStyle = kleur;
    c.fill();
    c.strokeStyle = RAND(kleur);
    c.lineWidth = 1.5;
    c.lineJoin = 'round';
    c.stroke();
    c.fillStyle = '#fff';
    c.font = '600 10.5px Segoe UI, sans-serif';
    c.textBaseline = 'middle';
    c.fillText(opties.links || 'als', x + 8, y + kop / 2);
    if (opties.rechts !== null) c.fillText(opties.rechts || 'dan', x + b - 26, y + kop / 2);
    // het rondje-pijltje van een herhaal-blok, in de staart
    if (opties.lus) {
      c.save();
      c.translate(x + 13, y3 + staart / 2);
      c.strokeStyle = '#fff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(0, 0, 4, 0.5, Math.PI * 1.7);
      c.stroke();
      c.beginPath();
      c.moveTo(1.5, -4.5); c.lineTo(4.5, -3); c.lineTo(1.5, -1);
      c.fillStyle = '#fff';
      c.fill();
      c.restore();
    }
    c.restore();
    return { gatX: x + 26, gatY: y + 4, kop, binnen, mondX: x + L, mondY: y2 };
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
     * STAP 1 — twee blokken slepen én daarna TESTEN.
     * Het testen is het halve verhaal: een leerling die de blokken neerlegt en
     * niet op de vlag drukt, denkt dat er niets werkt.
     */
    1: {
      duur: 10,
      teken(c, t, B, H) {
        const hatX = 30, hatY = 34, hatB = 132;
        const stapX = 30, stapY = 34 + 22;

        // de groene vlag staat rechtsboven, boven het speelveld
        const vlagAan = t > 7 && t < 8.4;
        vlagKnop(c, B - 42, 12, vlagAan);
        c.fillStyle = '#7a5c9e';
        c.font = '600 9px Segoe UI, sans-serif';
        c.textAlign = 'center';
        c.fillText('start', B - 27, 50);
        c.textAlign = 'left';

        // 1. het 🚩-blok naar het werkblad slepen
        const v1 = deel(t, 0.8, 2.6);
        if (t > 0.6) {
          const sx = 8, sy = 76;
          const x = sx + (hatX - sx) * v1, y = sy + (hatY - sy) * v1;
          hatBlok(c, x, y, hatB, 20, KLEUR.gebeurtenissen, 'wanneer op 🚩 wordt geklikt');
          if (t < 2.9) hand(c, x + 40, y + 24, v1 > 0 && v1 < 1);
        }

        // 2. het stappen-blok eronder hangen
        if (t > 3) {
          const v2 = deel(t, 3.2, 5);
          const sx = 8, sy = 80;
          const x = sx + (stapX - sx) * v2, y = sy + (stapY - sy) * v2;
          if (v2 > 0.1 && v2 < 1) {
            // schaduw op de plek waar hij vastklikt
            c.save();
            c.globalAlpha = 0.35;
            stapelBlok(c, stapX, stapY, 116, 18, '#8b8b8b', '', {});
            c.restore();
          }
          stapelBlok(c, x, y, 116, 18, KLEUR.beweging, 'neem 10 stappen', { grootte: 10 });
          if (t < 5.4) hand(c, x + 40, y + 22, v2 > 0 && v2 < 1);
        }

        // 3. testen! het handje gaat naar de groene vlag
        if (t > 5.8 && t < 8.6) {
          const v3 = deel(t, 5.8, 7);
          const hx = 60 + (B - 27 - 60) * v3, hy = 84 + (44 - 84) * v3;
          hand(c, hx, hy, vlagAan);
          if (vlagAan) {
            c.save();
            c.strokeStyle = '#4CBF56';
            c.lineWidth = 2;
            c.globalAlpha = Math.max(0, 1 - (t - 7) * 1.5);
            c.beginPath();
            c.arc(B - 27, 25, 18 + (t - 7) * 8, 0, Math.PI * 2);
            c.stroke();
            c.restore();
          }
        }

        // 4. en dan zet je tank één stapje
        const rijdt = t > 7.4 ? Math.min(1, (t - 7.4) / 1.2) : 0;
        if (t > 6.6) miniTank(c, 44 + rijdt * 26, 96, 0);

        bijschrift(c,
          t < 0.8 ? 'je werkblad is nog leeg'
            : t < 3 ? 'sleep het 🚩-blok op je werkblad'
              : t < 5.6 ? 'hang "neem 10 stappen" eronder'
                : t < 7.4 ? 'klik op de groene vlag om te TESTEN!'
                  : 'kijk: je tank zet één stapje', B, H);
      },
    },

    /*
     * STAP 2 — het stappen-blok BINNENIN een herhaal.
     * De valkuil is dat kinderen het herhaal-blok eronder hangen in plaats van
     * hun blok erin te leggen. Daarom laten we het blok eerst opzij gaan.
     */
    2: {
      duur: 9.5,
      teken(c, t, B, H) {
        const hatX = 26, hatY = 16, hatB = 132;
        hatBlok(c, hatX, hatY, hatB, 20, KLEUR.gebeurtenissen, 'wanneer op 🚩 wordt geklikt');

        // 1. het stappen-blok gaat even opzij
        const opzij = deel(t, 1, 2.6);
        const stapStart = { x: hatX, y: hatY + 22 };
        const stapOpzij = { x: B - 126, y: 78 };
        // 2. het herhaal-blok komt onder de hoed
        const herhaalIn = deel(t, 2.8, 4.4);
        if (t > 2.6) {
          c.save();
          c.globalAlpha = Math.min(1, herhaalIn + 0.2);
          const hy = hatY + 22 + (1 - herhaalIn) * 20;
          const lus = alsBlok(c, hatX, hy, 128, KLEUR.besturen,
            { kop: 18, binnen: 22, staart: 12, links: 'herhaal', rechts: null, lus: true });
          // 3. en daar hoort je stappen-blok IN
          const erin = deel(t, 5, 6.8);
          const doel = { x: lus.mondX + 3, y: lus.mondY + 2 };
          const van = stapOpzij;
          const x = van.x + (doel.x - van.x) * erin;
          const y = van.y + (doel.y - van.y) * erin;
          c.restore();
          if (erin > 0.05 && erin < 1) {
            c.save();
            c.globalAlpha = 0.4;
            stapelBlok(c, doel.x, doel.y, 108, 17, '#8b8b8b', '', {});
            c.restore();
          }
          if (t > 4.6) {
            stapelBlok(c, x, y, 108, 17, KLEUR.beweging, 'neem 10 stappen', { grootte: 9.5 });
            if (t < 7.1) hand(c, x + 36, y + 21, erin > 0 && erin < 1);
          } else {
            stapelBlok(c, stapOpzij.x, stapOpzij.y, 108, 17, KLEUR.beweging, 'neem 10 stappen', { grootte: 9.5 });
          }
        } else {
          const x = stapStart.x + (stapOpzij.x - stapStart.x) * opzij;
          const y = stapStart.y + (stapOpzij.y - stapStart.y) * opzij;
          stapelBlok(c, x, y, 108, 17, KLEUR.beweging, 'neem 10 stappen', { grootte: 9.5 });
          if (t > 0.7) hand(c, x + 36, y + 21, opzij > 0 && opzij < 1);
        }

        // 4. nu blijft hij rijden
        if (t > 7) {
          const rijdt = ((t - 7) % 2.5) / 2.5;
          miniTank(c, 20 + rijdt * (B - 44), H - 30, 0);
        }

        bijschrift(c,
          t < 2.6 ? 'haal je stappen-blok er even uit'
            : t < 4.8 ? 'hang een herhaal-blok onder de 🚩'
              : t < 7 ? 'leg je stappen-blok BINNENIN de herhaal'
                : 'nu blijft je tank doorrijden', B, H);
      },
    },

    /*
     * STAP 3 — het zeshoekje in het zeshoekige gaatje.
     * Dit is de handeling waar de meeste leerlingen op stukliepen: ze legden
     * "toets ingedrukt?" ONDER het als-blok in plaats van erín.
     */
    3: {
      duur: 8,
      teken(c, t, B, H) {
        /* De herhaal staat er met opzet omheen: leerlingen hingen hun als-blok
           eronder in plaats van erin, en snapten dan niet waarom hun tank maar
           één keer reageerde. */
        const lus = alsBlok(c, 12, 12, 196, KLEUR.besturen,
          { kop: 18, binnen: 46, staart: 12, links: 'herhaal', rechts: null, lus: true });

        // het als-blok hangt IN de mond van de herhaal
        const als = alsBlok(c, lus.mondX + 3, lus.mondY + 2, 168, KLEUR.besturen,
          { kop: 20, binnen: 20, staart: 10 });
        stapelBlok(c, als.gatX - 12, lus.mondY + 24, 128, 16, KLEUR.beweging, 'neem 10 stappen', { grootte: 9.5 });

        // in het begin lichten we even aan waar het als-blok hangt
        if (t < 1.6) {
          const puls = 0.35 + 0.35 * Math.sin(t * 6);
          c.save();
          c.globalAlpha = puls;
          c.strokeStyle = '#fff';
          c.lineWidth = 2.5;
          c.setLineDash([5, 4]);
          c.strokeRect(lus.mondX + 1, lus.mondY, 172, 50);
          c.restore();
        }

        const gatB = 90, gatH = 14;
        const doelX = als.gatX, doelY = als.gatY + 1;
        const vlucht = deel(t, 2.4, 4.6);
        const vast = t > 4.6;
        const startX = 10, startY = H - 46;
        const x = startX + (doelX - startX) * vlucht;
        const y = startY + (doelY - startY) * vlucht;

        if (!vast) {
          hexGat(c, doelX, doelY, gatB, gatH, vlucht > 0.15 ? 0.4 + 0.6 * vlucht : 0);
          if (t > 1.9) {
            hexBlok(c, x, y, gatB, gatH, KLEUR.waarnemen, 'toets ↑ ingedrukt?');
            hand(c, x + gatB * 0.5, y + gatH + 2, t > 2.4);
          }
        } else {
          const puls = Math.max(0, 1 - (t - 4.6) * 2.2);
          hexBlok(c, doelX, doelY, gatB, gatH, KLEUR.waarnemen, 'toets ↑ ingedrukt?');
          if (puls > 0) hexGat(c, doelX - 2, doelY - 2, gatB + 4, gatH + 4, puls);
        }

        bijschrift(c,
          t < 1.9 ? 'het als-blok hangt BINNENIN de herhaal'
            : t < 4.6 ? 'sleep het zeshoekje in het gaatje…'
              : t < 6.3 ? 'klik! nu rijdt hij alleen als je ↑ indrukt'
                : 'en je stappen-blok zit ín het als-blok', B, H);
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
      duur: 13,
      teken(c, t, B, H) {
        // de knop bovenaan de oranje categorie
        const knopB = 108, knopX = 14, knopY = 14;
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
          c.roundRect(B / 2 - 62, 22, 124, 44, 8);
          c.fillStyle = '#fff';
          c.fill();
          c.strokeStyle = '#855cd6';
          c.lineWidth = 2;
          c.stroke();
          c.fillStyle = '#3d2d63';
          c.font = '600 9px Segoe UI, sans-serif';
          c.fillText('Nieuwe variabelenaam:', B / 2 - 54, 34);
          c.beginPath();
          c.roundRect(B / 2 - 54, 40, 76, 15, 4);
          c.fillStyle = '#f3eefb';
          c.fill();
          c.fillStyle = '#2d3436';
          c.font = '600 10px Segoe UI, sans-serif';
          const naam = 'Levens'.slice(0, Math.max(0, Math.floor((t - 2.6) * 6)));
          c.fillText(naam + (Math.floor(t * 3) % 2 ? '|' : ''), B / 2 - 50, 51);
          c.fillStyle = '#4CBF56';
          c.beginPath();
          c.roundRect(B / 2 + 26, 40, 30, 15, 5);
          c.fill();
          c.fillStyle = '#fff';
          c.font = '600 9px Segoe UI, sans-serif';
          c.textAlign = 'center';
          c.fillText('OK', B / 2 + 41, 48);
          c.textAlign = 'left';
          c.restore();
          if (t > 3.9) hand(c, B / 2 + 41, 58, t > 4.1);
        }

        // je eigen blok, met het ronde gaatje
        const gatX = 112, gatY = 52, gatB = 62, gatH = 14;
        if (t > 4.5) {
          const v = deel(t, 4.5, 5);
          c.save();
          c.globalAlpha = v;
          stapelBlok(c, 20, 48, 152, 20, KLEUR.variabelen, 'maak Levens =', { grootte: 10 });
          c.restore();

          /* Het blok dat erin moet heet "mijn levens" — max levens is GEEN
             apart blok, maar een keuze onder het pijltje. Precies daar liepen
             leerlingen op vast, dus dat laten we hier helemaal zien. */
          const vlucht = deel(t, 5.6, 7.2);
          const gekozen = t > 10.2;
          if (t < 7.2) {
            rondGat(c, gatX, gatY, gatB, gatH, vlucht > 0.1 ? vlucht : 0);
            const sx = 16, sy = 80;
            const x = sx + (gatX - sx) * vlucht, y = sy + (gatY - sy) * vlucht;
            rondBlok(c, x, y, gatB, gatH, KLEUR.variabelen, 'mijn levens ❤️', 1, true);
            if (t > 5.3) hand(c, x + gatB / 2, y + gatH + 2, vlucht > 0 && vlucht < 1);
          } else {
            rondBlok(c, gatX, gatY, gatB, gatH, KLEUR.variabelen,
              gekozen ? 'max levens ❤️' : 'mijn levens ❤️', 1, true);
          }

          // op het pijltje klikken en de tweede keuze pakken
          if (t > 7.6 && t < 10.6) {
            const opent = deel(t, 8, 8.4);
            keuzeLijst(c, gatX - 4, gatY + gatH + 3, gatB + 20,
              ['mijn levens ❤️', 'max levens ❤️', 'mijn score 🏆'], t > 9.5 ? 1 : -1, opent);
            hand(c, gatX + gatB - 9, t > 9.3 ? gatY + gatH + 24 : gatY + gatH + 2,
              (t > 7.8 && t < 8.2) || (t > 9.7 && t < 10.1));
          }
          if (gekozen) {
            const puls = Math.max(0, 1 - (t - 10.2) * 1.6);
            if (puls > 0) rondGat(c, gatX - 2, gatY - 2, gatB + 4, gatH + 4, puls);
          }
        }

        bijschrift(c,
          t < 2.1 ? 'let op: dit is een KNOP, geen blok'
            : t < 4.4 ? 'typ de naam: Levens'
              : t < 5.6 ? 'nu staat je eigen blok in de lade'
                : t < 7.6 ? 'sleep "mijn levens" in het ronde gaatje'
                  : t < 10.2 ? 'klik op ▾ en kies "max levens"'
                    : 'klaar: je teller begint vol', B, H);
      },
    },
  };

  root.STAP_ANIMATIES = ANIMATIES;
})(typeof window !== 'undefined' ? window : globalThis);
