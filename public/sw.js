/*
 * Service worker voor het beheerpaneel als geïnstalleerde app (PWA).
 *
 * WAAROM DIT BESTAAT
 * Zonder service worker draait de geïnstalleerde app op de gewone HTTP-cache van de
 * browser. In standalone-modus is er geen adresbalk en geen verversknop, dus die cache
 * raak je niet kwijt: na een nieuwe versie bleef de app de oude tonen en was verwijderen
 * en opnieuw installeren de enige uitweg.
 *
 * DE AANPAK: netwerk eerst
 * Elke pagina wordt eerst van het netwerk gehaald. Lukt dat, dan zie je altijd de nieuwste
 * versie. Lukt het niet (geen bereik), dan valt hij terug op de laatst opgehaalde versie
 * uit de cache, zodat de app niet met een foutscherm opent.
 *
 * De omgekeerde volgorde — cache eerst — is sneller maar levert precies het probleem op
 * dat we hier oplossen. Snelheid weegt niet op tegen een app die de verkeerde versie toont.
 *
 * WAT NOOIT IN DE CACHE KOMT
 * Alles onder /api/. Die antwoorden bevatten leads, facturen en klantgegevens; die horen
 * niet in een cache op het apparaat, en een verouderd antwoord uit de cache zou erger zijn
 * dan een foutmelding.
 */

// Verandert bij elke nieuwe versie zodat oude caches worden opgeruimd.
const CACHE = "jgm-beheer-v1";

// Bestanden onder /_next/static/ krijgen van Next een unieke naam per build. Die kunnen
// veilig uit de cache: bij een nieuwe versie horen er nieuwe namen bij.
const ONVERANDERLIJK = /\/_next\/static\//;

self.addEventListener("install", (event) => {
  // Niet wachten tot alle oude tabbladen dicht zijn; deze versie neemt direct over.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Laat de pagina de nieuwe versie meteen activeren als de gebruiker daarop klikt.
self.addEventListener("message", (event) => {
  if (event.data === "activeer-nu") self.skipWaiting();
});

async function netwerkEerst(request) {
  const cache = await caches.open(CACHE);
  try {
    const antwoord = await fetch(request);
    // Alleen bewaren wat echt gelukt is; een foutpagina cachen maakt het erger.
    if (antwoord && antwoord.ok && antwoord.type === "basic") {
      cache.put(request, antwoord.clone());
    }
    return antwoord;
  } catch (err) {
    const uitCache = await cache.match(request);
    if (uitCache) return uitCache;
    // Navigatie zonder bereik en zonder cache: val terug op het dashboard als dat er is.
    if (request.mode === "navigate") {
      const shell = await cache.match("/admin/dashboard");
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheEerst(request) {
  const cache = await caches.open(CACHE);
  const uitCache = await cache.match(request);
  if (uitCache) return uitCache;
  const antwoord = await fetch(request);
  if (antwoord && antwoord.ok) cache.put(request, antwoord.clone());
  return antwoord;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Alleen ophaalacties; POST/PUT/DELETE horen nooit uit een cache te komen.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Andere domeinen (Google Fonts, Vercel Blob) laten we met rust.
  if (url.origin !== self.location.origin) return;

  // Nooit gegevens uit de API cachen — zie de toelichting bovenaan.
  if (url.pathname.startsWith("/api/")) return;

  // De service worker zelf en het manifest altijd vers ophalen, anders blijft een
  // nieuwe versie onzichtbaar.
  if (url.pathname === "/sw.js" || url.pathname === "/manifest.webmanifest") return;

  if (ONVERANDERLIJK.test(url.pathname)) {
    event.respondWith(cacheEerst(request));
    return;
  }

  event.respondWith(netwerkEerst(request));
});
