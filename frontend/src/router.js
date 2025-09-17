// frontend/src/router.js

import Navigo from 'navigo';

// CORREÇÃO APLICADA: Usando o nome da função e o caminho de import corretos.
import { renderAdminDashboard } from './components/AdminDashboard'; 

const router = new Navigo('/', { strategy: 'ALL' });

router.on('/admin/dashboard', () => {
    // Também é importante garantir que o #main-content exista no DOM antes de usá-lo.
    // A lógica de renderização do layout principal deve garantir isso.
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        // Usando a função correta
        renderAdminDashboard(mainContent);
    } else {
        console.error('Elemento #main-content não encontrado no DOM.');
    }
});

// ... outras rotas ...

router.notFound(() => {
    const mainContent = document.getElementById('main-content');
    if(mainContent) {
        mainContent.innerHTML = '<h1>Erro 404: Página não encontrada</h1>';
    }
});


export function initializeRouter() {
    router.resolve();
}

export default router;