const CACHE_NAME = 'jitakyoapp-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/logo-horizontal.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Cache opened, adding static assets.');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Para chamadas de API, sempre vá para a rede
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Para outros recursos, use a estratégia "cache-first"
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchResponse => {
                // Cache a nova resposta se for válida
                if (fetchResponse.status === 200) {
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return fetchResponse;
            });
        })
    );/**
 * Service Worker - JitaKyoApp
 * Estratégia: Network-First (Prioridade total para a rede)
 * Objetivo: Evitar que o usuário fique preso em versões antigas do sistema.
 */

const CACHE_NAME = 'jitakyo-live-cache-v2'; // Mude o 'v2' sempre que fizer um grande deploy

// Cacheamos apenas recursos que demoram a carregar e raramente mudam (imagens/ícones)
const IMAGE_ASSETS = [
    '/assets/logo-horizontal.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
    '/icons/android-launchericon-512-512.png'
];

self.addEventListener('install', event => {
    // Força o Service Worker a assumir o controle imediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Cache de imagens configurado.');
            return cache.addAll(IMAGE_ASSETS);
        })
    );
});

self.addEventListener('activate', event => {
    // Limpa caches antigos de versões anteriores para liberar espaço e evitar conflitos
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Ignora requisições que não sejam GET (como POST de login ou biometria)
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 1. Requisições de API: SEMPRE rede. Nunca cachear.
    if (url.pathname.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. Estratégia Network-First para o resto (HTML, JS, CSS)
    // Tenta baixar a versão mais nova. Se falhar (offline), usa o que tem no cache.
    event.respondWith(
        fetch(event.request)
            .then(fetchResponse => {
                // Se for uma imagem da nossa lista, aproveitamos para atualizar o cache
                if (IMAGE_ASSETS.some(asset => url.pathname.endsWith(asset))) {
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return fetchResponse;
            })
            .catch(() => {
                // Se a rede falhar (usuário sem internet), tenta o cache
                return caches.match(event.request);
            })
    );
});
});
