/* Service worker do NavLog Amazônia — só cuida do "esqueleto" do app
   (HTML/CSS/JS/ícones) pra abrir instantâneo como um app instalado, mesmo
   com internet ruim. Nunca guarda dados do Supabase (login, rotas,
   observações) em cache: essas requisições sempre vão direto pra rede,
   então a equipe nunca vê informação desatualizada ou de outra pessoa.

   Muda o nome do cache (CACHE_NAME) sempre que fizer uma atualização
   visível no app, pra garantir que o service worker antigo seja
   substituído e o cache velho, limpo. */
var CACHE_NAME = 'navlog-shell-v1';
var SHELL_FILES = [
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/js/data.js',
  '/js/supabase-config.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  // só mexe em GET do nosso próprio domínio — Supabase, CDN do supabase-js
  // e qualquer outra origem passam direto pra rede, sem cache
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; }); // sem internet: usa o que já tem em cache

      // "stale-while-revalidate": mostra o que já está em cache na hora
      // (app abre instantâneo) e atualiza o cache por trás pra próxima vez
      return cached || network;
    })
  );
});
