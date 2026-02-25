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

// --- LÓGICA DE ATUALIZAÇÃO FORÇADA (ANTI-CACHE) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
            .then(registration => {
                // Verifica atualizações no servidor toda vez que o app abre
                registration.update();

                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Se uma nova versão foi instalada, recarrega a página automaticamente
                            console.log('Nova versão detectada. Atualizando sistema...');
                            window.location.reload();
                        }
                    };
                };
            });
    });

    // Escuta mudanças de controle para garantir que a página nova seja carregada
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}