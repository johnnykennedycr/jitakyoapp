import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { renderLogin } from "../components/Login.js";
import { setUserProfile, getUserProfile } from "./userState.js";
import router from "../router.js";
import { renderAdminDashboard } from "../components/AdminDashboard.js";
import { renderTeacherList } from "../components/TeacherList.js";

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

        // --- LÓGICA PARA BOTÕES DE LOGOUT E SIDEBAR ---
        const setupEventListeners = () => {
            const logoutDesktop = document.getElementById('logout-button');
            const logoutMobile = document.getElementById('logout-button-mobile');
            const toggleButton = document.getElementById('sidebar-toggle-btn');
            const layoutContainer = document.querySelector('.sidebar-wrapper');

            const handleLogout = (e) => {
                e.preventDefault();
                setUserProfile(null);
                auth.signOut();
            };

            if(logoutDesktop) logoutDesktop.addEventListener('click', handleLogout);
            if(logoutMobile) logoutMobile.addEventListener('click', handleLogout);

            if (toggleButton && layoutContainer) {
                toggleButton.addEventListener('click', () => {
                    layoutContainer.classList.toggle('sidebar-collapsed');
                });
            }
        };
        
        setupEventListeners();

        // --- ROTEAMENTO ---
        router.off(router.routes); // Limpa rotas antigas
        router.on({
            '/admin/dashboard': () => renderAdminDashboard(mainContent, getUserProfile()),
            '/admin/teachers': () => renderTeacherList(mainContent),
            // Adicione outras rotas aqui
        }).notFound(() => {
            mainContent.innerHTML = '<h1>404 - Página Não Encontrada</h1>';
        });

        const homeRoute = {
            admin: '/admin/dashboard',
            super_admin: '/admin/dashboard',
        };
        router.navigate(homeRoute[userProfile.role] || '/login');
        router.resolve();

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        auth.signOut();
    }
}
