import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config/firebaseConfig.js";
import { renderLogin } from "./components/Login.js";
import { renderAuthenticatedApp } from "./auth/authContext.js";

// O contêiner principal da nossa aplicação
const appContainer = document.getElementById('app-container');

// Verificação de segurança: garante que o contêiner existe antes de continuar.
if (!appContainer) {
    console.error("Erro crítico: O elemento #app-container não foi encontrado no DOM.");
} else {
    // onAuthStateChanged é o nosso "porteiro". Ele direciona o fluxo inicial.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado. Delega TODA a lógica para o authContext.
            renderAuthenticatedApp(user, appContainer);
        } else {
            // Usuário está deslogado. Mostra a tela de login.
            renderLogin(appContainer);
        }
    });
}
