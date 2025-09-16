import './style.css';
import { auth } from './lib/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importa AMBOS os componentes de tela
import { renderLogin } from './components/Login.js';
import { renderDashboard } from './components/Dashboard.js'; 

const appContainer = document.getElementById('app');



// --- CONTROLE PRINCIPAL DA APLICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário estiver logado, renderiza o dashboard real
        console.log("Estado de autenticação mudou: USUÁRIO LOGADO", user);
        renderDashboard(appContainer);
    } else {
        // Se o usuário estiver deslogado, renderiza a tela de login
        console.log("Estado de autenticação mudou: USUÁRIO DESLOGADO");
        renderLogin(appContainer);
    }
});