/* Service worker do NavLog Amazônia — só cuida do "esqueleto" do app
   (HTML/CSS/JS/ícones) pra abrir instantâneo como um app instalado, mesmo
   com internet ruim. Nunca guarda dados do Supabase (login, rotas,
   observações) em cache: essas requisições sempre vão direto pra rede,
   então a equipe nunca vê informação desatualizada ou de outra pessoa.

   Muda o nome do cache (CACHE_NAME) sempre que fizer uma atualização
   visível no app, pra garantir que o service worker antigo seja
   substituído e o cache velho, limpo. */
var CACHE_NAME = 'navlog-shell-v5';
var SHELL_FILES = [
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/js/data.js',
  '/js/supabase-config.js',
  '/img/mapa-fundo.png',
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

/* Notificação push chegou (nível do rio mudou de regime, dado de
   município foi editado, ou qualidade do ar mudou — ver README, seção
   "Notificações push"). O payload vem em JSON: {title, body, url, tag}.
   "tag" agrupa notificações do mesmo assunto (ex.: chega uma nova
   notificação de nível do rio, substitui a anterior em vez de empilhar
   várias antigas na tela). */
self.addEventListener('push', function (event) {
  var dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) { dados = { body: event.data ? event.data.text() : '' }; }

  var titulo = dados.title || 'NavLog Amazônia';
  var opcoes = {
    body: dados.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: dados.tag || 'navlog',
    data: { url: dados.url || '/index.html' }
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

/* Clicar na notificação: foca uma aba já aberta do app (se tiver) em
   vez de abrir uma nova toda vez, senão abre uma nova na URL indicada. */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        var c = lista[i];
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
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
