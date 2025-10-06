const CACHE_NAME = 'jitakyo-aluno-v1';
// Arquivos essenciais para o funcionamento offline do app.
const urlsToCache = [
    '/',
    '/index.html',
    '/main.js',
    '/firebase.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Evento de instalação: abre o cache e armazena os arquivos.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Evento de fetch: intercepta as requisições.
// Tenta servir do cache primeiro, se falhar, busca na rede.
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se o recurso estiver no cache, retorna ele.
                if (response) {
                    return response;
                }
                // Se não, busca na rede.
                return fetch(event.request);
            })
    );
});
