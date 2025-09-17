// frontend/src/main.js (VERSÃO FINAL)

import './style.css';
import { auth } from './lib/firebase.js';
import { fetchWithAuth } from './lib/api.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { renderLogin } from './components/Login.js';
import { renderAdminDashboard } from './components/AdminDashboard.js';
// Importe seus outros dashboards aqui quando criá-los

const appContainer = document.getElementById('app');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário logado no Firebase.
        appContainer.innerHTML = `<p class="text-white">Autenticado. Verificando perfil...</p>`;
        try {
            // Busca o perfil no nosso backend para obter a 'role'
            const response = await fetchWithAuth('/api/users/me');
            const userData = await response.json();
            
            // Roteamento baseado na 'role'
            if (userData.role === 'admin' || userData.role === 'super_admin') {
                renderAdminDashboard(appContainer, userData);
            } else if (userData.role === 'teacher') {
                // renderTeacherDashboard(appContainer, userData);
            } else {
                // renderStudentDashboard(appContainer, userData);
            }
        } catch (error) {
            console.error("Erro ao buscar perfil, deslogando:", error);
            auth.signOut(); // Se não conseguir pegar o perfil, força o logout
        }
    } else {
        // Usuário deslogado.
        renderLogin(appContainer);
    }
});