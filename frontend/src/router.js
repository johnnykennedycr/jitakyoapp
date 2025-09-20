// frontend/src/router.js

import Navigo from 'navigo';

// Cria a instância do roteador que será usada em toda a aplicação
const router = new Navigo('/', { strategy: 'ALL' });

/**
 * Esta função agora é chamada pelo authContext para configurar as rotas
 * e resolver a rota inicial.
 */
export function initializeRouter(routes) {
    if (routes) {
        // Limpa rotas antigas antes de adicionar novas
        router.off(router.routes); 
        router.on(routes).resolve();
    } else {
        router.resolve();
    }
}

export default router;