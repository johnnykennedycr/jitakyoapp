import './style.css';
import { auth } from './lib/firebase.js';
import { fetchWithAuth } from './lib/api.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importa nossos componentes de tela
import { renderLogin } from './components/Login.js';
import { renderAdminDashboard } from './components/AdminDashboard.js'; // <-- NOVA IMPORTAÇÃO
// import { renderStudentDashboard } from './components/StudentDashboard.js'; // <-- Futuro
// import { renderTeacherDashboard } from './components/TeacherDashboard.js'; // <-- Futuro

const appContainer = document.getElementById('app');

// --- ROTEADOR PRINCIPAL DA APLICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // O usuário está logado no Firebase. Buscando perfil no backend...
        try {
            const response = await fetchWithAuth('/api/users/me');
            const userData = await response.json();
            console.log("Perfil recebido do backend:", userData);

            // Com base na role, renderiza o dashboard correto
            const userRole = userData.role;
            if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'receptionist') {
                renderAdminDashboard(appContainer, userData); 
            } else if (userRole === 'teacher') {
                // renderTeacherDashboard(appContainer, userData); // <-- Futuro
                appContainer.innerHTML = `<h1>Dashboard do Professor (Em construção)</h1>`;
            } else {
                // renderStudentDashboard(appContainer, userData); // <-- Futuro
                appContainer.innerHTML = `<h1>Dashboard do Aluno (Em construção)</h1>`;
            }
        } catch (error) {
            console.error("Erro ao buscar perfil do usuário. Deslogando.", error);
            auth.signOut();
        }
    } else {
        // O usuário está deslogado.
        renderLogin(appContainer);
    }
});