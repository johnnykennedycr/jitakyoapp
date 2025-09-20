// frontend/src/auth/authContext.js

import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { initializeRouter, default as router } from "../router.js";
import { renderLogin } from "../components/Login.js";

// 1. Criamos um "estado" global para o perfil do usuário
let currentUserProfile = null;

// 2. Criamos uma função "getter" para que outros arquivos possam acessar o perfil
export const getUserProfile = () => currentUserProfile;

export async function renderAuthenticatedApp(user, container) {
    try {
        const response = await fetchWithAuth('/api/users/me');
        const userProfile = await response.json();
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }
        
        // 3. Armazenamos o perfil no nosso "estado" global
        currentUserProfile = userProfile;

        // O resto da sua função continua...
        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = '';
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        // 4. A função createSidebar agora não precisa mais de argumentos!
        const sidebarHTML = createSidebar(); 
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;

        document.getElementById('logout-button').addEventListener('click', () => {
            currentUserProfile = null; // Limpa o perfil ao deslogar
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