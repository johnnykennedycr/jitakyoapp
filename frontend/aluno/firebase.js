import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

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



// IMPORTANTE: Cole aqui a sua VAPID key do Firebase Cloud Messaging
const VAPID_KEY = 'BDJXmwLSObDCGq6dgVYQLOlMchriI3KFFzsQqR5G2wLh1Y1jyR_oCYmlG2yGjycUzXGg2ccQ24vD8D2t6v8jE5Y';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const messaging = getMessaging(app);

// Função para obter o token, agora exportada daqui
const getMessagingToken = () => getToken(messaging, { vapidKey: VAPID_KEY });

export { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut, getMessagingToken };