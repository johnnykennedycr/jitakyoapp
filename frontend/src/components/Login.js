// frontend/src/components/Login.js

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebaseConfig.js";

/**
 * Renderiza o formulário de login e gerencia a lógica de autenticação.
 * @param {HTMLElement} container - O elemento do DOM onde o formulário será renderizado.
 */
export function renderLogin(container) {
  // 1. Define o HTML do formulário de login
  const loginHtml = `
    <div class="flex items-center justify-center min-h-screen bg-gray-900">
      <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div class="flex justify-center">
          <img src="assets/logo.png" alt="Logo JitaKyoApp" class="h-20">
        </div>
        <div class="text-center">
          <h2 class="text-3xl font-extrabold text-gray-900">Acesso ao Painel</h2>
          <p class="mt-2 text-sm text-gray-600">Entre com suas credenciais.</p>
        </div>
        <div id="error-message-container" class="text-center"></div>
        <form id="login-form" class="mt-8 space-y-6" novalidate>
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="email" class="sr-only">E-mail</label>
              <input id="email" name="email" type="email" autocomplete="email" required class="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Endereço de e-mail">
            </div>
            <div>
              <label for="password" class="sr-only">Senha</label>
              <input id="password" name="password" type="password" autocomplete="current-password" required class="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Senha">
            </div>
          </div>
          <div>
            <button type="submit" class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all">
              <span class="button-text">Entrar</span>
              <span class="spinner hidden"></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // 2. Insere o HTML no contêiner fornecido
  container.innerHTML = loginHtml;

  // 3. AGORA, com o HTML já no DOM, podemos selecionar os elementos com segurança
  const form = container.querySelector('#login-form');
  const emailInput = container.querySelector('#email');
  const passwordInput = container.querySelector('#password');
  const errorContainer = container.querySelector('#error-message-container');
  const submitButton = container.querySelector('button[type="submit"]');

  // 4. Adiciona o listener de evento ao formulário
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const email = emailInput.value;
      const password = passwordInput.value;
      
      errorContainer.innerHTML = '';
      submitButton.disabled = true;
      submitButton.querySelector('.button-text').textContent = 'Entrando...';

      try {
        await signInWithEmailAndPassword(auth, email, password);
        // O onAuthStateChanged no main.js vai detectar o login e recarregar a UI.
        // Não precisamos fazer mais nada aqui após o sucesso.
      } catch (error) {
        let friendlyMessage = 'E-mail ou senha inválidos. Tente novamente.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            friendlyMessage = 'Credenciais incorretas.';
        } else if (error.code === 'auth/invalid-email') {
            friendlyMessage = 'O formato do e-mail é inválido.';
        }
        console.error("Erro no login:", error.code, error.message);
        errorContainer.innerHTML = `<div class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">${friendlyMessage}</div>`;
        
        submitButton.disabled = false;
        submitButton.querySelector('.button-text').textContent = 'Entrar';
      }
    });
  } else {
    console.error('Elemento #login-form não foi encontrado após a renderização.');
  }
}