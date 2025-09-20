import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { renderLogin } from "../components/Login.js";
import { setUserProfile } from "./userState.js";
import router from "../router.js";
import { renderAdminDashboard } from "../components/AdminDashboard.js";

export async function renderAuthenticatedApp(user, container) {
    try {
        const response = await fetchWithAuth('/api/users/me');
        const userProfile = await response.json();
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }
        
        setUserProfile(userProfile);

        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = '';
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        const sidebarHTML = createSidebar(); 
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;
        const mainContent = document.getElementById('main-content');

        document.getElementById('logout-button').addEventListener('click', (e) => {
            e.preventDefault();
            setUserProfile(null);
            auth.signOut();
        });

        // Configuração das rotas AQUI
        router.on('/admin/dashboard', () => {
            renderAdminDashboard(mainContent, userProfile);
        }).resolve(); // Configura e resolve a rota atual

        const homeRoute = {
            admin: '/admin/dashboard',
            super_admin: '/admin/dashboard',
        };
        router.navigate(homeRoute[userProfile.role] || '/login');

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        auth.signOut();
    }
}