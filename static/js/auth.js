// Esta função será nosso "fetch com crachá".
async function fetchWithAuth(url, options = {}) {
    // 1. Pega o token que salvamos no login
    const idToken = sessionStorage.getItem('firebaseIdToken');

    // 2. Se não houver token, o usuário não está logado. Manda para o login.
    if (!idToken) {
        console.error("Nenhum ID Token encontrado, redirecionando para o login.");
        window.location.href = '/login';
        // Lança um erro para parar a execução do código seguinte
        throw new Error('Usuário não autenticado.');
    }

    // 3. Prepara os cabeçalhos da requisição
    const headers = {
        ...options.headers, // Mantém quaisquer outros cabeçalhos que já existam
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json' // Padrão para POST/PUT
    };

    // 4. Se o body for um objeto, converte para JSON
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }
    
    // 5. Faz a requisição fetch, agora com o cabeçalho de autorização
    const response = await fetch(url, { ...options, headers });

    // 6. Se o token expirou (erro 401), o backend nos dirá.
    // Redirecionamos para o login para que o usuário possa se autenticar novamente.
    if (response.status === 401) {
        console.error("Token expirado ou inválido, redirecionando para o login.");
        sessionStorage.removeItem('firebaseIdToken'); // Limpa o token antigo
        window.location.href = '/login';
        throw new Error('Token expirado ou inválido.');
    }

    return response;
}