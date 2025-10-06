const CACHE_NAME = 'jitakyo-aluno-v3'; // Versão do cache atualizada
const urlsToCache = [
    '/',
    '/index.html',
    '/main.js',
    '/firebase.js',
    '/manifest.json',
    '/icons/web-app-manifest-192x192.png',
    '/icons/web-app-manifest-512x512.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Instala o Service Worker e armazena os assets no cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache aberto e pronto para armazenar arquivos.');
                return cache.addAll(urlsToCache);
            })
    );
});

// Intercepta as requisições e serve do cache se disponível
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se o recurso estiver no cache, retorna ele. Senão, busca na rede.
                return response || fetch(event.request);
            })
    );
});

// Ativa o Service Worker e limpa caches antigos
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Limpando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


// "Ouve" por notificações push
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Recebido.');
    
    const notificationData = event.data.json();
    const title = notificationData.title || 'Nova Notificação';
    const options = {
        body: notificationData.body || 'Você tem uma nova mensagem.',
        icon: '/icons/web-app-manifest-192x192.png',
        badge: '/icons/favicon-96x96.png'
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Lida com o clique na notificação
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Clique na notificação recebido.');
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (let client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

