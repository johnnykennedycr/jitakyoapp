const { initializeApp } = firebase;
const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } = firebase.auth;
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

// Reexporta as funções para que o main.js as possa importar
export { onAuthStateChanged, signInWithEmailAndPassword, signOut };