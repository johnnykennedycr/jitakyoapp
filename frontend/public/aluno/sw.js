// Importa as bibliotecas do Firebase diretamente da CDN.
// Isso é necessário porque os Service Workers não suportam módulos ES6 da mesma forma que o navegador.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// --- LÓGICA DE CACHE ---
const CACHE_NAME = 'jitakyo-aluno-cache-v2'; // Versão do cache atualizada
const urlsToCache = [
    '/',
    '/index.html',
    '/main.js',
    '/firebase.js',
    '/manifest.json',
    '/icons/web-app-manifest-192x192.png',
    '/icons/web-app-manifest-512x512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cache aberto e pronto para instalar.');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Se encontrar no cache, retorna a resposta do cache
                if (response) {
                    return response;
                }
                // Senão, faz a requisição na rede
                return fetch(event.request);
            })
    );
});


// --- LÓGICA DE NOTIFICAÇÕES (Nova lógica integrada) ---

// IMPORTANTE: Cole aqui a mesma configuração do seu arquivo firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAwAjcrYDm6GplMlbBtYwPdHAoJSBrnkB8",
  authDomain: "jitakyoapp.firebaseapp.com",
  projectId: "jitakyoapp",
  storageBucket: "jitakyoapp.firebasestorage.app",
  messagingSenderId: "217073545024",
  appId: "1:217073545024:web:80e4d80f30b55ecfaed4a5",
  measurementId: "G-8D4CHETJQY"
};

// Inicializa o Firebase usando a versão de compatibilidade
firebase.initializeApp(firebaseConfig);

// Obtém a instância do Messaging
const messaging = firebase.messaging();

// Adiciona um "ouvinte" para mensagens recebidas em segundo plano.
// Isso garante que a notificação seja exibida mesmo se o app estiver fechado.
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Mensagem de fundo recebida: ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icons/web-app-manifest-192x192.png' // Ícone padrão para a notificação
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
