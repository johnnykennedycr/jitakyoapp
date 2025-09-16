// Importa as funções necessárias do Firebase
import { auth } from '../lib/firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// A função 'renderLogin' aceita um 'container' (a <div id="app">) onde ela irá se desenhar.
export function renderLogin(container) {
    // Injeta o HTML do formulário de login no container
    container.innerHTML = `
        <div class="flex items-center justify-center min-h-screen bg-gray-900">
            <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                <div class="flex justify-center">
                    <img src="/logo-horizontal.png" alt="Logo JitaKyoApp" class="h-20">
                </div>
                <div class="text-center">
                    <h2 class="text-3xl font-extrabold text-gray-900">Acesso ao Painel</h2>
                    <p class="mt-2 text-sm text-gray-600">Entre com suas credenciais.</p>
                </div>
                <div id="flash-messages"></div>
                <form id="login-form" class="mt-8 space-y-6">
                    <div class="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label for="email" class="sr-only">E-mail</label>
                            <input id="email" name="email" type="email" autocomplete="email" required 
                                   class="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                                   placeholder="Endereço de e-mail">
                        </div>
                        <div>
                            <label for="password" class="sr-only">Senha</label>
                            <input id="password" name="password" type="password" autocomplete="current-password" required 
                                   class="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                                   placeholder="Senha">
                        </div>
                    </div>
                    <div>
                        <button type="submit" class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all">
                            Entrar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Agora, adicionamos a lógica de evento ao formulário que acabamos de criar
    const form = container.querySelector('#login-form');
    const flashContainer = container.querySelector('#flash-messages');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;

        submitButton.textContent = 'Entrando...';
        submitButton.disabled = true;
        flashContainer.innerHTML = '';

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // SUCESSO!
                console.log("Login bem-sucedido:", userCredential.user);
                // Não precisamos fazer mais nada. O 'onAuthStateChanged' no main.js
                // irá detectar a mudança e trocar a tela para o dashboard.
            })
            .catch((error) => {
                console.error("Erro no login com Firebase:", error.message);
                flashContainer.innerHTML = `<div class="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">Email ou senha inválidos.</div>`;
                submitButton.textContent = 'Entrar';
                submitButton.disabled = false;
            });
    });
}