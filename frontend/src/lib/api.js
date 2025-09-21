import { auth } from "../config/firebaseConfig.js";

/**
 * Retorna uma Promise que resolve com o usuário atual do Firebase.
 * Isso resolve a race condition de tentar pegar o usuário antes do SDK inicializar.
 * @returns {Promise<import("firebase/auth").User|null>}
 */
const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        unsubscribe(); // Para de ouvir após obter o primeiro resultado
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
};


/**
 * Executa uma chamada fetch para a API, adicionando automaticamente o token de autenticação
 * e aprimorando o tratamento de erros.
 * @param {string} url - A URL da API para a qual fazer a requisição.
 * @param {object} options - Opções de fetch (método, corpo, etc.).
 * @returns {Promise<Response>}
 */
export const fetchWithAuth = async (url, options = {}) => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado no Firebase.');
  }

  const token = await user.getIdToken(true);

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    // Tenta extrair a mensagem de erro específica do backend
    try {
        const errorData = await response.json();
        // Lança um erro com a mensagem do servidor
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
    } catch (e) {
        // Se a resposta de erro não for JSON, lança um erro genérico
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
  }

  return response;
};
