// frontend/src/auth/authContext.js

import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { initializeRouter, default as router } from "../router.js";
import { renderLogin } from "../components/Login.js";
// Importa o SETTER do nosso novo arquivo de estado
import { setUserProfile } from "./userState.js";

export async function renderAuthenticatedApp(user, container) {
    try {
        const response = await fetchWithAuth('/api/users/me');
        const userProfile = await response.json();
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }
        
        // Usa o SETTER para armazenar o perfil no estado central
        setUserProfile(userProfile);

        // O resto da sua função continua igual...
        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = '';
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        const sidebarHTML = createSidebar(); 
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;

        // O listener do botão de logout agora precisa ser adicionado aqui,
        // pois o botão é criado junto com o sidebar
        document.getElementById('logout-button').addEventListener('click', () => {
            setUserProfile(null); // Limpa o perfil ao deslogar
            auth.signOut();
        });

        initializeRouter();
        
        const homeRoute = {
            admin: '/admin/dashboard',
            super_admin: '/admin/dashboard',
            // ... outros perfis
        };
        router.navigate(homeRoute[userProfile.role] || '/login');

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        auth.signOut();
    }
}