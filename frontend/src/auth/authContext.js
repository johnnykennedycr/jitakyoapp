import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { initializeRouter, default as router } from "../router.js";
import { renderLogin } from "../components/Login.js";

/**
 * Orquestra a renderização da aplicação para um usuário autenticado.
 * @param {object} user - O objeto de usuário do Firebase.
 * @param {HTMLElement} container - O contêiner principal da aplicação.
 */
export async function renderAuthenticatedApp(user, container) {
    try {
        const userProfile = await fetchWithAuth('/api/users/me');
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }

        // 1. Renderiza o layout principal a partir do template
        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = ''; // Limpa a tela de login
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        // 2. Cria e insere o menu lateral com os dados do usuário
        const sidebarHTML = createSidebar(userProfile);
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;

        // 3. Adiciona o listener para o botão de logout
        document.getElementById('logout-button').addEventListener('click', () => {
            auth.signOut(); // Executa o logout no Firebase
        });

        // 4. Inicia o roteador para gerenciar a navegação
        initializeRouter();
        
        // 5. Navega para a rota inicial correta com base no perfil do usuário
        const homeRoute = {
            admin: '/admin/dashboard',
            super_admin: '/admin/dashboard',
            teacher: '/teacher/dashboard',
            student: '/student/dashboard'
        };
        // Usa o router para navegar para a página correta, ou para o login se o perfil for inválido
        router.navigate(homeRoute[userProfile.role] || '/login');

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        // Em caso de qualquer erro, desloga o usuário para evitar um estado quebrado
        auth.signOut();
        // A linha acima irá acionar o onAuthStateChanged novamente, que chamará renderLogin()
    }
}