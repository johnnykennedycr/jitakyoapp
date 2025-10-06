import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// --- CONFIGURAÇÃO ---
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
const auth = getAuth(app);
const messaging = getMessaging(app);

// Função para obter o token de notificação
async function getMessagingToken() {
    try {
        // IMPORTANTE: Adicione sua VAPID Key aqui
        const currentToken = await getToken(messaging, { vapidKey: "SUA_VAPID_KEY_DO_FIREBASE" });
        if (currentToken) {
            console.log('Token de notificação obtido:', currentToken);
            return currentToken;
        } else {
            console.log('Não foi possível obter o token. Permissão não concedida?');
            return null;
        }
    } catch (err) {
        console.error('Ocorreu um erro ao obter o token.', err);
        return null;
    }
}

export { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, getMessagingToken };