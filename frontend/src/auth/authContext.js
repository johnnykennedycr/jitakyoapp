// frontend/src/auth/authContext.js

import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { renderLogin } from "../components/Login.js";
import { setUserProfile, getUserProfile } from "./userState.js";

// Importe os componentes de página que o roteador irá controlar
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

        // --- NOVA LÓGICA DE ROTEAMENTO ---
        const router = new Navigo('/');

        router.on('/admin/dashboard', () => {
            // Passa os dados do usuário DIRETAMENTE para a função de renderização
            renderAdminDashboard(mainContent, getUserProfile());
        });

        router.on('/admin/teachers', () => {
            mainContent.innerHTML = '<h1>Página de Professores</h1>';
        });
        
        router.notFound(() => {
            mainContent.innerHTML = '<h1>Erro 404: Página não encontrada</h1>';
        });

        router.resolve(); // Inicia o roteador

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