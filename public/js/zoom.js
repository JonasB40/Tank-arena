/*
 * ZOOM HERSTELLEN (vooral voor iPads). Knijpt een kind met twee vingers op de
 * pagina, dan zoomt Safari de hele pagina in — de knoppen schuiven buiten
 * beeld en het lijkt alsof alles vastzit. Daarom:
 *  1. de pagina zelf inzoomen kan niet meer: touch-action op html en body
 *     (style.css), de "gesture"-gebeurtenissen van Safari houden we tegen, en
 *     maximum-scale=1 in index.html. Dat laatste is nodig omdat Safari ook
 *     vanzelf inzoomt als je een tekstvakje aantikt dat kleiner is dan 16 px —
 *     zoals het getal in "neem 10 stappen". In het werkblad met twee vingers
 *     zoomen blijft wél werken;
 *  2. de knop "Zoom" bij Opruimen/Inklappen zet het werkblad én de pagina
 *     terug zoals bij de start, met je blokken in beeld;
 *  3. raakt de pagina toch ingezoomd (een oudere iPad), dan verschijnt er een
 *     zwevende knop die altijd in beeld blijft, hoe ver je ook ingezoomd bent.
 */
(function () {
  const meta = document.querySelector('meta[name="viewport"]');
  const GEWOON = meta ? meta.getAttribute('content') : 'width=device-width, initial-scale=1.0';

  /* De pagina terug op ware grootte. Safari heeft daar geen opdracht voor; de
     bekende manier is even een vaste schaal van 1 opleggen en het dan weer
     vrijgeven. (Het moet een andere tekst zijn dan GEWOON, anders kijkt Safari
     er niet opnieuw naar.) */
  function herstelPaginaZoom() {
    if (meta) {
      meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1');
      setTimeout(() => meta.setAttribute('content', GEWOON), 400);
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  /* Het werkblad terug op de beginzoom, met je blokken in het midden. */
  function herstelWerkbladZoom() {
    const ws = window.blocklyWerkruimte;
    if (!ws) return;
    const begin = (ws.options && ws.options.zoomOptions && ws.options.zoomOptions.startScale) || 0.68;
    ws.setScale(begin);
    ws.scrollCenter();
    if (window.herschaalWerkveld) window.herschaalWerkveld();
  }

  window.herstelZoom = function () {
    herstelPaginaZoom();
    herstelWerkbladZoom();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 450);
  };

  const knop = document.getElementById('knop-zoom');
  if (knop) knop.addEventListener('click', window.herstelZoom);

  /* Safari (iPad) zoomt met twee vingers soms tóch de pagina in, ook al zegt
     touch-action dat het niet mag. Daarvoor stuurt Safari eigen "gesture"-
     gebeurtenissen; die houden we tegen. Knijpen in het werkblad loopt via
     gewone aanrakingen, dus dat zoomt gewoon het werkblad. */
  for (const soort of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(soort, (e) => e.preventDefault(), { passive: false });
  }

  /* Na het typen (een getal in een blok, je naam) schuift Safari de pagina
     soms omhoog om plaats te maken voor het toetsenbord — en vergeet hij ze
     terug te zetten. De bovenbalk stond dan buiten beeld en er viel niet meer
     terug te scrollen. Op een pagina die niet hoort te scrollen zetten we ze
     zelf terug. */
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (getComputedStyle(document.body).overflowY !== 'hidden') return;   // smalle scherm: daar mag het
      if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }, 300);
  });

  /* Staat het werkblad ver in- of uitgezoomd (meer dan anderhalf keer of minder
     dan de helft van de beginzoom), dan knippert de Zoom-knop: zo vindt een kind
     de weg terug zonder te weten waar het zit. */
  setInterval(() => {
    const ws = window.blocklyWerkruimte;
    if (!ws || !knop) return;
    const begin = (ws.options && ws.options.zoomOptions && ws.options.zoomOptions.startScale) || 0.68;
    const verhouding = ws.scale / begin;
    knop.classList.toggle('opvallend', verhouding > 1.5 || verhouding < 0.5);
  }, 500);

  /* De zwevende knop: alleen als de pagina ingezoomd is. Hij staat altijd
     linksboven in wat je nu ziet, en even groot als gewoon (vandaar 1/scale). */
  const zweef = document.getElementById('zoom-zweef');
  const vv = window.visualViewport;
  if (vv && zweef) {
    const kijk = () => {
      const ingezoomd = vv.scale > 1.05;
      zweef.classList.toggle('verborgen', !ingezoomd);
      if (ingezoomd) {
        zweef.style.transform = `translate(${vv.offsetLeft + 10}px, ${vv.offsetTop + 10}px) scale(${1 / vv.scale})`;
      }
    };
    vv.addEventListener('resize', kijk);
    vv.addEventListener('scroll', kijk);
    zweef.addEventListener('click', window.herstelZoom);
    kijk();
  }
})();
