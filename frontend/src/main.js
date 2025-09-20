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