const CACHE_NAME = 'jitakyo-aluno-v2';
// Adicionamos os ícones ao cache para uma experiência PWA mais completa
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

// Evento de instalação: armazena os arquivos essenciais.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento de fetch: serve do cache primeiro.
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

// --- NOVO: Evento de Push ---
// Este evento é acionado quando uma notificação push é recebida.
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Recebido.');
    
    // Extrai os dados da notificação (título, corpo, etc.)
    const notificationData = event.data.json();
    const title = notificationData.title || 'Nova Notificação';
    const options = {
        body: notificationData.body || 'Você tem uma nova mensagem.',
        icon: '/icons/web-app-manifest-192x192.png', // Ícone que aparecerá na notificação
        badge: '/icons/favicon-96x96.png' // Ícone menor (opcional)
    };

    // Exibe a notificação
    event.waitUntil(self.registration.showNotification(title, options));
});

// Opcional: Evento para quando o usuário clica na notificação
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Clique na notificação recebido.');
    event.notification.close();
    // Foca na janela do app se ela já estiver aberta, senão abre uma nova.
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
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

