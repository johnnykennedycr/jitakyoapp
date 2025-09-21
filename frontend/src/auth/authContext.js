import { auth } from "../config/firebaseConfig.js";
import { fetchWithAuth } from "../lib/api.js";
import { createSidebar } from "../components/Sidebar.js";
import { renderLogin } from "../components/Login.js";
import { setUserProfile, getUserProfile } from "./userState.js";
import router from "../router.js";
import { renderAdminDashboard } from "../components/AdminDashboard.js";
import { renderTeacherList } from "../components/TeacherList.js";
import { renderStudentList } from "../components/StudentList.js";
import { renderClassList } from "../components/ClassList.js";

// Variável para guardar a função de limpeza da página atual
let currentPageCleanup = () => {};

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
        
        // A função de setup dos listeners da sidebar (que é persistente)
        setupEventListeners();

        // --- ROTEAMENTO COM LÓGICA DE LIMPEZA ---
        router.off(router.routes); // Limpa rotas antigas

        const navigateTo = async (renderFunction) => {
            // 1. Executa a limpeza da página anterior
            if (typeof currentPageCleanup === 'function') {
                currentPageCleanup();
            }
            // 2. Renderiza a nova página e guarda sua nova função de limpeza
            currentPageCleanup = await renderFunction(mainContent);
        };

        router.on({
            '/admin/dashboard': () => navigateTo((el) => renderAdminDashboard(el, getUserProfile())),
            '/admin/teachers': () => navigateTo(renderTeacherList),
            '/admin/students': () => navigateTo(renderStudentList),
            '/admin/classes': () => navigateTo(renderClassList),
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

function setupEventListeners() {
    const logoutDesktop = document.getElementById('logout-button');
    const logoutMobile = document.getElementById('logout-button-mobile');
    const toggleButton = document.getElementById('sidebar-toggle-btn');
    
    const sidebarNav = document.querySelector('#sidebar-container nav.hidden.md\\:flex');
    const mainContent = document.getElementById('main-content');
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

    if (toggleButton && sidebarNav && mainContent) {
        toggleButton.addEventListener('click', () => {
            sidebarNav.classList.toggle('w-64');
            sidebarNav.classList.toggle('w-20');
            mainContent.classList.toggle('md:ml-64');
            mainContent.classList.toggle('md:ml-20');
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
}

