import { auth } from './firebase.js'; // Importa o serviço de auth que acabamos de criar

/**
 * Uma função 'wrapper' para o fetch que anexa automaticamente o token de autenticação.
 * @param {string} url - A URL do endpoint da API para chamar (ex: '/api/admin/dashboard-data').
 * @param {object} options - As opções padrão do fetch (method, body, etc.).
 * @returns {Promise<Response>} - A promessa da resposta do fetch.
 */
export async function fetchWithAuth(url, options = {}) {
    const user = auth.currentUser;

    if (!user) {
        console.error("Nenhum usuário logado, redirecionando para o login.");
        // Se não houver usuário, redireciona para a página de login
        window.location.href = '/login'; 
        throw new Error('Usuário não autenticado.');
    }

    // Pega o token do usuário atual. O SDK do Firebase gerencia a renovação automaticamente.
    const idToken = await user.getIdToken();

    // Cria os cabeçalhos, incluindo o de Autorização
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
    };
    
    // Converte o corpo da requisição para JSON se for um objeto
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }
    
    // Faz a requisição fetch com os novos cabeçalhos
    const response = await fetch(url, { ...options, headers });

    // Se o backend retornar 401 ou 403, pode ser um token inválido, então deslogamos.
    if (response.status === 401 || response.status === 403) {
        console.error("Token inválido ou permissão negada pelo backend.");
        auth.signOut(); // Desloga o usuário do Firebase
        window.location.href = '/login';
        throw new Error('Token inválido ou sem permissão.');
    }

    return response;
}