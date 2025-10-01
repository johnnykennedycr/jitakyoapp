import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Importe o getAuth e todas as funções de autenticação necessárias aqui
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- CONFIGURAÇÃO ---
// IMPORTANTE: SUBSTITUA O OBJETO ABAIXO PELO SEU firebaseConfig REAL
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

// Inicializa e exporta a instância do Auth
export const auth = getAuth(app);

// Reexporta as funções para que possam ser usadas em outros lugares
export { onAuthStateChanged, signInWithEmailAndPassword, signOut };

