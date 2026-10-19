/*
 * Muis en vinger op het speelveld: mikken en "muis ingedrukt?".
 * Deel van het spel in de browser (spel-*.js, geladen in deze volgorde).
 */

/* ---------------- muis én vinger (invoer!) ----------------
 * Pointer-events in plaats van muis-events: dezelfde code vangt de muis op
 * een laptop én een vinger op een iPad. Voor het programma van de leerling is
 * een vinger op het speelveld gewoon "de muis": hij mikt waar je tikt, en
 * zolang je vinger erop staat is "muis ingedrukt?" waar.
 *
 * We houden bij wélke vingers op het speelveld staan. Met de ene duim op de
 * joystick en de andere op het speelveld mag het loslaten van de joystick het
 * schieten niet stoppen — dat gebeurde wel met één gewone "muis los".
 */
const vingersOpSpeelveld = new Set();

/*
 * De richtjoystick (rechts, op tablets) is óók "de muis". Hij zet het
 * mikpunt in de arena op een afstand van je tank, in de richting waarin je
 * hem duwt, en zolang je duwt is "muis ingedrukt?" waar. Laat je los, dan
 * blijft het geschut die kant op wijzen — tot je weer op het speelveld tikt
 * of een echte muis beweegt; die nemen het dan over.
 *   spel.richtStok = { x, y (richting, lengte 1), afstand, vuurt } of null
 */
spel.richtStok = null;
function werkMuisKnopBij() {
  spel.muisKnop = vingersOpSpeelveld.size > 0 || !!(spel.richtStok && spel.richtStok.vuurt);
}
spel.zetRichtStok = (stok) => {
  spel.richtStok = stok;
  werkMuisKnopBij();
  werkMuisWereldBij();
};

/* Waar in de arena staat de muis (of de vinger)? */
function werkMuisWereldBij() {
  const stok = spel.richtStok;
  const ik = stok && spel.mijnTank();
  if (stok && ik) {
    // vanaf je tank, dus het mikpunt rijdt met je mee
    spel.muisWereld.x = ik.x + stok.x * stok.afstand;
    spel.muisWereld.y = ik.y + stok.y * stok.afstand;
    // ook het punt op het scherm, voor wie straks weer met een muis verdergaat
    spel.muisScherm.x = spel.muisWereld.x * zoom + tekenOffset.x;
    spel.muisScherm.y = spel.muisWereld.y * zoom + tekenOffset.y;
    return;
  }
  spel.muisWereld.x = (spel.muisScherm.x - tekenOffset.x) / zoom;
  spel.muisWereld.y = (spel.muisScherm.y - tekenOffset.y) / zoom;
}
/*
 * Meteen omrekenen naar de arena, niet pas bij de volgende tik. Een muis
 * schuift eerst naar zijn doel en klikt dan; een vinger springt ergens anders
 * naartoe én drukt tegelijk. Wachtten we op de tik, dan vertrok het eerste
 * schot op een iPad nog naar de plek waar je vóórdien had getikt.
 */
function zetMuisScherm(e) {
  // een echte muis of een vinger op het speelveld neemt het over van de richtjoystick
  if (spel.richtStok && !spel.richtStok.vuurt) spel.richtStok = null;
  if (spel.richtStok) return;   // de richtjoystick wordt nog vastgehouden: die wint
  const r = canvas.getBoundingClientRect();
  spel.muisScherm.x = (e.clientX - r.left) * (canvas.width / r.width);
  spel.muisScherm.y = (e.clientY - r.top) * (canvas.height / r.height);
  werkMuisWereldBij();
}
canvas.addEventListener('pointermove', zetMuisScherm);
/*
 * Een klik telt minstens een tiende van een seconde. Het programma van de
 * leerling kijkt dertig keer per seconde of de muis ingedrukt is; een tikje op
 * het touchpad van een chromebook (tikken-om-te-klikken) duurt soms maar 10 à
 * 30 ms, en dan zag het programma de klik nooit en kwam er geen kogel uit.
 */
const KORTSTE_KLIK_MS = 100;
const ingedruktSinds = new Map();   // vinger/muis → wanneer ingedrukt
canvas.addEventListener('pointerdown', (e) => {
  zetMuisScherm(e);
  vingersOpSpeelveld.add(e.pointerId);
  ingedruktSinds.set(e.pointerId, performance.now());
  werkMuisKnopBij();
  // een vinger: niet ook nog laten scrollen, zoomen of een vergrootglas tonen
  if (e.pointerType !== 'mouse') e.preventDefault();
});
function laatVingerLos(e) {
  if (!vingersOpSpeelveld.has(e.pointerId)) return;   // deze vinger stond niet op het speelveld
  const nogEven = KORTSTE_KLIK_MS - (performance.now() - (ingedruktSinds.get(e.pointerId) || 0));
  ingedruktSinds.delete(e.pointerId);
  const los = () => {
    // intussen opnieuw ingedrukt (dubbelklik)? dan die tweede klik niet afbreken
    if (ingedruktSinds.has(e.pointerId)) return;
    vingersOpSpeelveld.delete(e.pointerId);
    werkMuisKnopBij();
  };
  if (nogEven > 0) setTimeout(los, nogEven); else los();
}
window.addEventListener('pointerup', laatVingerLos);
window.addEventListener('pointercancel', laatVingerLos);
window.addEventListener('blur', () => {
  vingersOpSpeelveld.clear();
  ingedruktSinds.clear();
  if (spel.richtStok) spel.richtStok.vuurt = false;
  werkMuisKnopBij();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
