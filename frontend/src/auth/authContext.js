import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { renderLogin } from "../components/Login.js";
import { setUserProfile, getUserProfile } from "./userState.js";
import router from "../router.js";

// Importa todos os componentes de página que o roteador irá controlar
import { renderAdminDashboard } from "../components/AdminDashboard.js";
import { renderTeacherList } from "../components/TeacherList.js";
import { renderStudentList } from "../components/StudentList.js";
import { renderClassList } from "../components/ClassList.js"; // <-- Importação que faltava

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

        // --- LÓGICA DE EVENTOS PARA SIDEBAR E LOGOUT ---
        const setupEventListeners = () => {
            const logoutDesktop = document.getElementById('logout-button');
            const logoutMobile = document.getElementById('logout-button-mobile');
            const toggleButton = document.getElementById('sidebar-toggle-btn');
            
            const sidebarNav = document.querySelector('#sidebar-container nav.hidden.md\\:flex');
            const mainContentEl = document.getElementById('main-content');
            const textElements = document.querySelectorAll('.sidebar-text');
            const logo = document.querySelector('.sidebar-logo');
            const links = document.querySelectorAll('.sidebar-link');
            const header = document.querySelector('.sidebar-header');

            const handleLogout = (e) => {
                e.preventDefault();
                setUserProfile(null);
                auth.signOut();
            };

            if(logoutDesktop) logoutDesktop.addEventListener('click', handleLogout);
            if(logoutMobile) logoutMobile.addEventListener('click', handleLogout);

            if (toggleButton && sidebarNav && mainContentEl) {
                toggleButton.addEventListener('click', () => {
                    sidebarNav.classList.toggle('w-64');
                    sidebarNav.classList.toggle('w-20');
                    mainContentEl.classList.toggle('md:ml-64');
                    mainContentEl.classList.toggle('md:ml-20');
                    textElements.forEach(el => el.classList.toggle('hidden'));
                    logo?.classList.toggle('hidden');
                    header?.classList.toggle('justify-between');
                    header?.classList.toggle('justify-center');
                    links.forEach(link => {
                        link.classList.toggle('justify-start');
                        link.classList.toggle('justify-center');
                    });
                });
            }
        };
        setupEventListeners();

        // --- ROTEAMENTO ---
        router.off(router.routes); // Limpa rotas antigas para evitar duplicação
        router.on({
            '/admin/dashboard': () => renderAdminDashboard(mainContent, getUserProfile()),
            '/admin/teachers': () => renderTeacherList(mainContent),
            '/admin/students': () => renderStudentList(mainContent),
            '/admin/classes': () => renderClassList(mainContent), // <-- Rota que faltava
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

