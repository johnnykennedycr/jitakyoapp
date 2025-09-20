import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { initializeRouter, default as router } from "../router.js";
import { renderLogin } from "../components/Login.js";

export async function renderAuthenticatedApp(user, container) {
    try {
        console.log("DEBUG (authContext): Iniciando renderAuthenticatedApp. Buscando /api/users/me...");
        
        const response = await fetchWithAuth('/api/users/me');
        console.log("DEBUG (authContext): Resposta da API recebida.", response);
        
        const userProfile = await response.json();
        console.log("DEBUG (authContext): Perfil do usuário (JSON):", userProfile);
        
        if (!userProfile || !userProfile.role) {
            // Este é o erro que está acontecendo. O log acima nos dirá por quê.
            console.error("DEBUG (authContext): CONDIÇÃO DE ERRO ATINGIDA! userProfile ou userProfile.role é falso/nulo.", userProfile);
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }
        
        console.log("DEBUG (authContext): Perfil validado com sucesso. Role:", userProfile.role);

        // O resto da sua função continua...
        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = '';
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        const sidebarHTML = createSidebar(userProfile);
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;

        document.getElementById('logout-button').addEventListener('click', () => {
            auth.signOut();
        });

        initializeRouter();
        
        const homeRoute = {
            admin: '/admin/dashboard',
            super_admin: '/admin/dashboard',
            teacher: '/teacher/dashboard',
            student: '/student/dashboard'
        };
        router.navigate(homeRoute[userProfile.role] || '/login');

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        auth.signOut();
    }
}