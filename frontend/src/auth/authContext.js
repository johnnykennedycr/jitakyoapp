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
import { renderKioskMode } from "../components/KioskMode.js";
import { renderFaceRegister } from "../components/FaceRegister.js"; // Importe do novo componente

// Variável para guardar a função de limpeza da página atual
let currentPageCleanup = () => {};

export async function renderAuthenticatedApp(user, container) {
    try {
        const response = await fetchWithAuth('/api/users/me');
        const userProfile = await response.json();
        
        if (!userProfile || !userProfile.role) {
            throw new Error("Perfil do usuário ou 'role' não encontrado.");
        }
        
        // --- LÓGICA DE VERIFICAÇÃO DE ROLE ---
        const userRole = userProfile.role;

        if (userRole !== 'admin' && userRole !== 'super_admin') {
            console.log(`Usuário com role '${userRole}' não tem acesso a este painel. Redirecionando...`);
            
            if (userRole === 'student') {
                window.location.href = 'https://aluno-jitakyoapp.web.app'; 
            } else if (userRole === 'teacher') {
                window.location.href = 'https://professor-jitakyoapp.web.app'; 
            } else {
                alert('Você não tem permissão para acessar esta área.');
                auth.signOut();
            }
            return; 
        }

        // --- INICIALIZA PERFIL ---
        setUserProfile(userProfile);

        // --- FUNÇÃO AUXILIAR PARA GARANTIR O LAYOUT DO ADMIN (COM SIDEBAR) ---
        const ensureAdminLayout = () => {
            if (!document.getElementById('sidebar-container')) {
                const layoutTemplate = document.getElementById('layout-template');
                container.innerHTML = '';
                container.appendChild(layoutTemplate.content.cloneNode(true));
                
                const sidebarHTML = createSidebar(); 
                document.getElementById('sidebar-container').innerHTML = sidebarHTML;
                
                setupEventListeners(); // Reativa os cliques do menu
            }
            const mainContent = document.getElementById('main-content');
            mainContent.classList.add('overflow-y-auto', 'pb-20', 'md:pb-0');
            return mainContent;
        };

        // --- FUNÇÃO DE NAVEGAÇÃO PADRÃO (DENTRO DO PAINEL) ---
        const navigateToAdmin = async (renderFunction) => {
            const mainContent = ensureAdminLayout();
            
            if (typeof currentPageCleanup === 'function') {
                currentPageCleanup();
            }
            currentPageCleanup = await renderFunction(mainContent);
        };

        // --- FUNÇÃO DE NAVEGAÇÃO PARA O QUIOSQUE (TELA CHEIA) ---
        const navigateToKiosk = async () => {
            if (typeof currentPageCleanup === 'function') {
                currentPageCleanup();
            }
            // Limpa todo o container para remover a Sidebar e Header
            container.innerHTML = '';
            container.className = 'h-screen w-screen overflow-hidden bg-gray-900'; // Garante fundo escuro

            currentPageCleanup = await renderKioskMode(container);
        };

        // --- ROTEAMENTO ---
        router.off(router.routes); // Limpa rotas antigas

        router.on({
            // Nova regra de redirecionamento da raiz
            '/': () => {
                router.navigate('/admin/dashboard');
            },
            '/admin/dashboard': () => navigateToAdmin((el) => renderAdminDashboard(el, getUserProfile())),
            '/admin/teachers': () => navigateToAdmin(renderTeacherList),
            '/admin/students': () => navigateToAdmin(renderStudentList),
            '/admin/classes': () => navigateToAdmin(renderClassList),
            '/admin/financial': () => navigateToAdmin(renderFinancialDashboard),
            
            // Nova Rota do Registro Facial (Dentro do Layout Admin)
            '/admin/face-register': () => navigateToAdmin(renderFaceRegister),
            
            // Rota do Quiosque (Fora do Layout Admin)
            '/kiosk': () => navigateToKiosk(),
        }).notFound(() => {
            const mainContent = ensureAdminLayout();
            mainContent.innerHTML = '<div class="p-8 text-white"><h1>404 - Página Não Encontrada</h1></div>';
        });
        
        router.resolve();

    } catch (error) {
        console.error("Falha ao carregar o perfil e montar a página:", error);
        auth.signOut();
    }
}

function setupEventListeners() {
    // Esta função contém os listeners para os elementos persistentes como a sidebar
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