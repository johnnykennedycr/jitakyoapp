import Navigo from 'navigo';
import { renderAdminDashboard } from './components/AdminDashboard.js'; 

const router = new Navigo('/', { strategy: 'ALL' });

// --- Definição das Rotas ---

router.on('/admin/dashboard', () => {
    // Buscamos o elemento AQUI, dentro do handler
    const mainContent = document.getElementById('main-content'); // BOM 👍
    if (mainContent) {
        renderAdminDashboard(mainContent);
    } else {
        console.error('Elemento #main-content não encontrado no DOM.');
    }
});

router.on('/admin/teachers', () => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = '<h1>Página de Professores (a ser criada)</h1>';
    }
});

router.on('/admin/students/edit/:id', (match) => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        const studentId = match.data.id;
        mainContent.innerHTML = `<h1>Editando Aluno com ID: ${studentId}</h1>`;
    }
});

router.on('/admin', () => {
    router.navigate('/admin/dashboard');
});

// Handler para rotas não encontradas
router.notFound(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = '<h1>Erro 404: Página não encontrada</h1>';
    }
});

export function initializeRouter() {
    router.resolve();
}

export default router;