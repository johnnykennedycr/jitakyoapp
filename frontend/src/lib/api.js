import { auth } from "../config/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";

/**
 * Retorna uma Promise que resolve com o usuário atual do Firebase.
 * Isso resolve a race condition de tentar pegar o usuário antes do SDK inicializar.
 * @returns {Promise<import("firebase/auth").User|null>}
 */
const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, 
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
 * Executa uma chamada fetch para a API, adicionando automaticamente o token de autenticação.
 * @param {string} url - A URL da API para a qual fazer a requisição.
 * @param {object} options - Opções de fetch (método, corpo, etc.).
 * @returns {Promise<Response>}
 */
export const fetchWithAuth = async (url, options = {}) => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Usuário não autenticado no Firebase.');
  }

  // Pega o token mais recente, forçando a atualização se necessário.
  const token = await user.getIdToken(true);

  // Adiciona o cabeçalho de autorização às opções de fetch
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Erro da API:", errorData);
    throw new Error(`Erro na chamada da API: ${response.statusText}`);
  }

  return response;
};