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
import { renderFinancialDashboard } from "../components/FinancialDashboard.js";

// Variável para guardar a função de limpeza da página atual
let currentPageCleanup = () => {};

export async function renderAuthenticatedApp(user, container) {
    try {
        const response = await fetchWithAuth('/api/users/me');
        const userProfile = await response.json();
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }
        
        // --- NOVA LÓGICA DE VERIFICAÇÃO DE ROLE ---
        const userRole = userProfile.role;

        if (userRole !== 'admin' && userRole !== 'super_admin') {
            // Se o usuário NÃO É admin ou super_admin, ele não pertence a este painel.
            console.log(`Usuário com role '${userRole}' não tem acesso a este painel. Redirecionando...`);
            
            // Você pode customizar os alertas e redirecionamentos
            if (userRole === 'student') {
                // Removido o alert para uma melhor experiência do usuário
                // IMPORTANTE: Use a URL correta do seu app de aluno aqui!
                window.location.href = 'https://aluno-jitakyoapp.web.app'; 
            } else if (userRole === 'teacher') {
                // IMPORTANTE: Use a URL correta do seu futuro app de professor
                window.location.href = 'https://professor-jitakyoapp.web.app'; 
            } else {
                // Se for uma role desconhecida, desloga por segurança.
                alert('Você não tem permissão para acessar esta área.');
                auth.signOut();
            }
            return; // Interrompe a execução para que o painel de admin não seja renderizado.
        }

        // --- O CÓDIGO ABAIXO SÓ EXECUTA SE FOR ADMIN OU SUPER_ADMIN ---
        setUserProfile(userProfile);

        const layoutTemplate = document.getElementById('layout-template');
        container.innerHTML = '';
        container.appendChild(layoutTemplate.content.cloneNode(true));
        
        const sidebarHTML = createSidebar(); 
        document.getElementById('sidebar-container').innerHTML = sidebarHTML;
        const mainContent = document.getElementById('main-content');
        mainContent.classList.add('overflow-y-auto', 'pb-20', 'md:pb-0');
        
        setupEventListeners();

        // --- ROTEAMENTO COM LÓGICA DE LIMPEZA ---
        router.off(router.routes); // Limpa rotas antigas

        const navigateTo = async (renderFunction) => {
            if (typeof currentPageCleanup === 'function') {
                currentPageCleanup();
            }
            currentPageCleanup = await renderFunction(mainContent);
        };

        router.on({
            '/admin/dashboard': () => navigateTo((el) => renderAdminDashboard(el, getUserProfile())),
            '/admin/teachers': () => navigateTo(renderTeacherList),
            '/admin/students': () => navigateTo(renderStudentList),
            '/admin/classes': () => navigateTo(renderClassList),
            '/admin/financial': () => navigateTo(renderFinancialDashboard),
        }).notFound(() => {
            mainContent.innerHTML = '<h1>404 - Página Não Encontrada</h1>';
        });
        
        // Como já verificamos a role, podemos navegar diretamente para o dashboard,
        // removendo a lógica antiga do 'homeRoute'.
        router.navigate('/admin/dashboard');
        router.resolve();

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        auth.signOut();
    }
}

function setupEventListeners() {
    // Esta função contém os listeners para os elementos persistentes como a sidebar
    // e o botão de logout. Como eles não mudam, não precisam de limpeza.
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
        // Redireciona para a página de login após o logout
        router.navigate('/login');
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
