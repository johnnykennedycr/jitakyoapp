import { fetchWithAuth } from "../api/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { initializeRouter, default as router } from "../router.js"; // Importe o roteador

// ... (outras importações e código)

export async function renderAuthenticatedApp(user, container) {
    try {
        const userProfile = await fetchWithAuth('/api/users/me');
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }

        // 1. Renderiza o layout principal na tela
        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = ''; // Limpa a tela de login
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        // 2. Cria e insere o sidebar com os dados do usuário
        const sidebarHTML = createSidebar(userProfile);
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;

        // 3. Adiciona listeners de eventos (ex: logout)
        document.getElementById('logout-button').addEventListener('click', () => {
            // Chame sua função de logout do Firebase aqui
            // auth.signOut();
        });

        // 4. INICIA O ROTEADOR!
        // Agora que a página tem o layout, o roteador pode começar a funcionar.
        initializeRouter();
        
        // Opcional: Navega para a página inicial correta com base no perfil
        const homeRoute = {
            admin: '/admin/dashboard',
            super_admin: '/admin/dashboard',
            teacher: '/teacher/dashboard',
            student: '/student/dashboard'
        };
        router.navigate(homeRoute[userProfile.role] || '/login');


    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        // Deslogar e redirecionar para o login em caso de falha
        // auth.signOut();
        // renderLogin(container);
    }
}