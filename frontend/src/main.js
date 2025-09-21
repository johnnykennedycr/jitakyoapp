import './style.css';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config/firebaseConfig.js";
import { renderLogin } from "./components/Login.js";
import { renderAuthenticatedApp } from "./auth/authContext.js";

const appContainer = document.getElementById('app-container');

if (!appContainer) {
    console.error("Erro crítico: O elemento #app-container não foi encontrado no DOM.");
} else {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            renderAuthenticatedApp(user, appContainer);
        } else {
            renderLogin(appContainer);
        }
    });
}

// --- REGISTRO DO SERVICE WORKER (PWA) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
