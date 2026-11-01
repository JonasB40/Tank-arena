/*
 * LEESHULP: voorlezen en grotere letters, voor wie nog niet vlot leest.
 *
 * Voorlezen: de opdracht van de stap, de uitleg en een bericht van de lesgever
 * leest de stem van het toestel zelf voor (geen extra software, en het werkt
 * ook zonder internet). Nog eens tikken = stoppen. Een koptelefoon is handig.
 *
 * Grotere letters (A+): drie standen — gewoon, groot en extra groot — voor de
 * les, de uitleg, berichten, de blokkenlade en de upgradebalkjes. Onthouden
 * per toestel.
 */
(function () {
  /* ---------------- voorlezen ---------------- */
  const spraak = window.speechSynthesis;
  const KNOPPEN = ['stap-voorlees', 'uitleg-voorlees', 'lb-voorlees'].map((id) => document.getElementById(id));
  let stem = null;            // de Nederlandse stem van het toestel (Vlaams als die er is)
  let sprekendeKnop = null;

  function kiesStem() {
    const stemmen = spraak.getVoices();
    stem = stemmen.find((v) => /^nl[-_]BE/i.test(v.lang))
      || stemmen.find((v) => /^nl/i.test(v.lang)) || null;
  }

  function zetSprekend(knop) {
    if (sprekendeKnop) sprekendeKnop.classList.remove('spreekt');
    sprekendeKnop = knop;
    if (knop) knop.classList.add('spreekt');
  }

  /* Emoji's en tekentjes zou de stem letterlijk uitspreken ("doelwit", "lege
     cirkel"): die gaan eruit. Een pijl wordt gewoon "naar". */
  function schoon(tekst) {
    return String(tekst || '')
      .replace(/[\p{Extended_Pictographic}️‍○✓]/gu, '')
      .replace(/[→⟶]/g, ' naar ')
      .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 van $2')   // "stap 3/15" → "stap 3 van 15"
      .replace(/(^|\s)-(?=\p{L})/gu, '$1')            // "🚩-startblok" zonder vlag → "startblok"
      .replace(/\s+([.,!?:])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function leesVoor(tekst, knop) {
    if (!spraak) return;
    const wasDezeKnop = sprekendeKnop === knop;
    if (spraak.speaking || spraak.pending) spraak.cancel();
    zetSprekend(null);
    if (wasDezeKnop) return;   // nog eens tikken = stoppen
    const zin = schoon(tekst);
    if (!zin) return;
    const u = new SpeechSynthesisUtterance(zin);
    u.lang = stem ? stem.lang : 'nl-BE';
    if (stem) u.voice = stem;
    u.rate = 0.92;             // net iets trager: het zijn kinderen van acht
    u.onend = () => { if (sprekendeKnop === knop) zetSprekend(null); };
    u.onerror = u.onend;
    zetSprekend(knop);
    spraak.speak(u);
  }
  window.stopVoorlezen = function () {
    if (spraak && (spraak.speaking || spraak.pending)) spraak.cancel();
    zetSprekend(null);
  };

  if (spraak && window.SpeechSynthesisUtterance) {
    kiesStem();
    // de stemmen komen in sommige browsers pas na een tikje binnen
    if (spraak.addEventListener) spraak.addEventListener('voiceschanged', kiesStem);
    else spraak.onvoiceschanged = kiesStem;
    for (const k of KNOPPEN) if (k) k.classList.remove('verborgen');

    /* Een genummerd lijstje ("1. Sleep… 2. Zet…") plakt anders aan elkaar
       tot "onder.Zet daarin": elk stapje wordt een eigen zin. */
    const tekstVan = (id) => {
      const el = document.getElementById(id);
      if (!el) return '';
      const stapjes = [...el.querySelectorAll('li')];
      return stapjes.length ? stapjes.map((li) => li.textContent.trim().replace(/[.!?]?$/, '.')).join(' ') : el.textContent;
    };
    document.getElementById('stap-voorlees').addEventListener('click', (e) => {
      // de stap, de opdracht, en wanneer je klaar bent (de twee vinkjes)
      const checks = [tekstVan('check-structuur'), tekstVan('check-gedrag')].map(schoon).filter(Boolean);
      leesVoor(`${tekstVan('stap-nr')}. ${tekstVan('stap-titel')}. ${tekstVan('stap-doel')}`
        + (checks.length ? ` Je bent klaar als: ${checks.join(', en ')}.` : ''), e.currentTarget);
    });
    document.getElementById('uitleg-voorlees').addEventListener('click', (e) => {
      leesVoor(`${tekstVan('uitleg-titel')}. ${tekstVan('stap-probleem')} ${tekstVan('stap-ontdekking')}`, e.currentTarget);
    });
    document.getElementById('lb-voorlees').addEventListener('click', (e) => {
      const vak = document.getElementById('lesgever-bericht');
      leesVoor(vak.querySelector('.lb-tekst').textContent, e.currentTarget);
    });
    // de uitleg of het bericht dichtklikken: dan ook stoppen met lezen
    for (const id of ['uitleg-sluit', 'lb-sluit', 'lb-terug']) {
      const k = document.getElementById(id);
      if (k) k.addEventListener('click', window.stopVoorlezen);
    }
  }

  /* ---------------- grotere letters ---------------- */
  const STANDEN = [1, 1.15, 1.3];
  const NAMEN = ['gewone letters', 'grote letters', 'extra grote letters'];
  const knop = document.getElementById('tekst-groter');
  let stand = 0;
  try { stand = Math.min(2, Math.max(0, Math.round(Number(localStorage.getItem('tankTekstMaat')) || 0))); } catch { /* geen opslag */ }

  function zetTekstMaat(nieuw) {
    stand = nieuw;
    document.documentElement.style.setProperty('--tekst', String(STANDEN[stand]));
    document.body.classList.toggle('tekst-groot', stand === 1);
    document.body.classList.toggle('tekst-xl', stand === 2);
    knop.classList.toggle('aan', stand > 0);
    knop.textContent = stand === 2 ? 'A−' : 'A+';
    knop.title = `Nu: ${NAMEN[stand]}. Tik voor ${NAMEN[(stand + 1) % 3]}.`;
    try { localStorage.setItem('tankTekstMaat', String(stand)); } catch { /* geen opslag */ }
    // de blokkenlade wordt breder: Blockly moet alles opnieuw uitmeten
    setTimeout(() => { if (window.herschaalWerkveld) window.herschaalWerkveld(); }, 60);
  }
  knop.addEventListener('click', () => {
    zetTekstMaat((stand + 1) % STANDEN.length);
    toast(`🔠 ${NAMEN[stand][0].toUpperCase()}${NAMEN[stand].slice(1)}`);
  });
  zetTekstMaat(stand);
})();
