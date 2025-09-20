import Navigo from 'navigo';

// Cria a instância do roteador que será usada em toda a aplicação
const router = new Navigo('/', { strategy: 'ALL' });

export default router;