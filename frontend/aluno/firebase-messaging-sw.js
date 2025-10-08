import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-sw.js";

// IMPORTANTE: Cole aqui a mesma configuração do seu outro arquivo firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAwAjcrYDm6GplMlbBtYwPdHAoJSBrnkB8",
  authDomain: "jitakyoapp.firebaseapp.com",
  projectId: "jitakyoapp",
  storageBucket: "jitakyoapp.firebasestorage.app",
  messagingSenderId: "217073545024",
  appId: "1:217073545024:web:80e4d80f30b55ecfaed4a5",
  measurementId: "G-8D4CHETJQY"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Este service worker não precisa de mais nada. O SDK do Firebase
// cuida do recebimento de mensagens em segundo plano.
console.log("Firebase Messaging Service Worker inicializado.");
