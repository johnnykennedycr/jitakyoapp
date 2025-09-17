import { auth } from './firebase.js';

export async function fetchWithAuth(url, options = {}) {
    const user = auth.currentUser;
    if (!user) {
        // Se por algum motivo o usuário não estiver logado no Firebase, não continue.
        // O onAuthStateChanged no main.js já deve ter redirecionado para /login.
        throw new Error('Usuário não autenticado no Firebase.');
    }

    const idToken = await user.getIdToken();
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
    };

    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }
    
    // O rewrite no firebase.json garante que esta chamada vá para o Cloud Run
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        // Se a resposta não for OK, lança um erro para o .catch() lidar.
        const errorData = await response.json().catch(() => ({ error: "Erro desconhecido do servidor." }));
        throw new Error(errorData.error);
    }

    return response;
}