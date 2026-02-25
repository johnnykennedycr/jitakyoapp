// Importa as bibliotecas do Firebase diretamente da CDN (versão compatível para SW)
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

/**
 * Service Worker - Portal do Aluno JitaKyoApp
 * Estratégia: Network-First (Rede Primeiro)
 * Objetivo: Garantir que o aluno sempre veja a versão mais atual sem precisar de Ctrl+F5.
 */

const CACHE_NAME = 'jitakyo-aluno-live-v3'; // Incremente este nome sempre que fizer um grande deploy

// Recursos básicos para funcionamento offline e identidade visual
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/main.js',
    '/firebase.js',
    '/manifest.json',
    '/icons/web-app-manifest-192x192.png',
    '/icons/web-app-manifest-512x512.png'
];

// Instalação: Salva assets mas força o novo SW a não ficar esperando
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('SW Aluno: Cache estático inicializado.');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// Ativação: Limpa absolutamente todos os caches antigos para evitar conflitos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW Aluno: Removendo cache obsoleto:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptação de Requisições: Estratégia NETWORK-FIRST
self.addEventListener('fetch', event => {
    // Ignora métodos que não sejam GET (POST de login, biometria, etc)
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 1. Chamadas de API: SEMPRE buscar na rede. Nunca usar cache.
    if (url.pathname.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. Estratégia para Interface (HTML, JS, CSS, Imagens)
    // Tenta a rede primeiro para garantir que o código é o mais novo.
    event.respondWith(
        fetch(event.request)
            .then(fetchResponse => {
                // Se a rede respondeu, atualizamos o cache para um eventual uso offline
                if (fetchResponse && fetchResponse.status === 200) {
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return fetchResponse;
            })
            .catch(() => {
                // Se a rede falhar (offline), aí sim recorremos ao cache salvo
                return caches.match(event.request);
            })
    );
});

// --- LÓGICA DE NOTIFICAÇÕES (Firebase Cloud Messaging) ---

const firebaseConfig = {
  apiKey: "AIzaSyAwAjcrYDm6GplMlbBtYwPdHAoJSBrnkB8",
  authDomain: "jitakyoapp.firebaseapp.com",
  projectId: "jitakyoapp",
  storageBucket: "jitakyoapp.firebasestorage.app",
  messagingSenderId: "217073545024",
  appId: "1:217073545024:web:80e4d80f30b55ecfaed4a5",
  measurementId: "G-8D4CHETJQY"
};

// Inicializa o Firebase no contexto do Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Listener para mensagens recebidas com o app fechado ou em segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('[SW Aluno] Notificação recebida em background:', payload);

    const notificationTitle = payload.notification.title || "JitaKyoApp";
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icons/web-app-manifest-192x192.png',
        badge: '/icons/web-app-manifest-192x192.png',
        tag: 'jitakyo-alert', // Agrupa notificações similares
        renotify: true
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});