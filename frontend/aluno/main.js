// Nenhuma alteração é necessária aqui. O main.js continua a funcionar da mesma forma.
import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase.js';

console.log("main.js: Script carregado e executado.");

// --- CONFIGURAÇÃO ---
const API_BASE_URL = 'https://jitakyoapp-r7fl5wa5ea-rj.a.run.app'; 

// --- VARIÁVEIS GLOBAIS ---
let authContainer, appContainer, loadingIndicator;
let currentUser = null;
let idToken = null;

// --- FUNÇÕES DE API ---
async function fetchWithAuth(endpoint, options = {}) {
    if (!currentUser) {
        throw new Error("Usuário não autenticado.");
    }
    idToken = await currentUser.getIdToken(true);
    const defaultHeaders = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
    };
    const config = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido na API.' }));
        console.error(`Erro na API [${response.status}]:`, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response;
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function showLoading(show) {
    if (loadingIndicator) {
        loadingIndicator.classList.toggle('hidden', !show);
    }
}

function renderLoginScreen() {
    console.log("main.js: Chamando renderLoginScreen.");
    if (!authContainer || !appContainer) {
        console.error("main.js: Elementos 'authContainer' ou 'appContainer' não encontrados para renderizar o login.");
        return;
    }

    authContainer.innerHTML = `
        <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
            <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">JitaKyoApp</h2>
            <p class="text-center text-gray-500 mb-6">Área do Aluno</p>
            <form id="login-form">
                <div class="mb-4">
                    <label for="email" class="block text-gray-700 text-sm font-bold mb-2">Email</label>
                    <input type="email" id="email" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div class="mb-6">
                    <label for="password" class="block text-gray-700 text-sm font-bold mb-2">Senha</label>
                    <input type="password" id="password" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full focus:outline-none focus:shadow-outline transition duration-300">
                    Entrar
                </button>
            </form>
            <p id="login-error" class="text-red-500 text-xs italic mt-4 text-center"></p>
        </div>
    `;
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        showLoading(true);
        try {
            const email = e.target.email.value;
            const password = e.target.password.value;
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Erro no login:", error);
            loginError.textContent = 'Email ou senha inválidos.';
        } finally {
            showLoading(false);
        }
    });
}

async function renderAuthenticatedApp(studentProfile) {
    if (!authContainer || !appContainer) return;

    appContainer.innerHTML = `
        <div class="w-full max-w-4xl mx-auto p-4 md:p-6">
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">Olá, ${studentProfile.name.split(' ')[0]}!</h1>
                    <p class="text-gray-500">Bem-vindo(a) à sua área.</p>
                </div>
                <button id="logout-button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-300">Sair</button>
            </header>
            <main class="space-y-6">
                <section id="classes-section" class="bg-white p-6 rounded-lg shadow-md">
                    <h2 class="text-xl font-semibold mb-4 text-gray-700">Minhas Turmas</h2>
                    <div id="classes-content">Carregando turmas...</div>
                </section>
                <section id="payments-section" class="bg-white p-6 rounded-lg shadow-md">
                    <h2 class="text-xl font-semibold mb-4 text-gray-700">Meu Financeiro</h2>
                    <div id="payments-content">Carregando histórico financeiro...</div>
                </section>
            </main>
        </div>
    `;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    document.getElementById('logout-button').addEventListener('click', () => signOut(auth));

    loadClasses();
    loadPayments();
}

async function loadClasses() {
    const contentDiv = document.getElementById('classes-content');
    try {
        const response = await fetchWithAuth('/api/student/classes');
        const enrollments = await response.json();
        if (enrollments.length === 0) {
            contentDiv.innerHTML = '<p class="text-gray-500">Você não está matriculado em nenhuma turma.</p>';
            return;
        }
        contentDiv.innerHTML = `<ul class="space-y-3">${enrollments.map(e => `
            <li class="p-4 bg-gray-50 rounded-md border border-gray-200">
                <p class="font-bold text-lg text-blue-600">${e.class_details.name}</p>
                <p class="text-sm text-gray-600">Professor: ${e.class_details.teacher_name}</p>
                <p class="text-sm text-gray-600">Horário: ${e.class_details.schedule}</p>
            </li>`).join('')}</ul>`;
    } catch (error) {
        contentDiv.innerHTML = '<p class="text-red-500">Não foi possível carregar suas turmas.</p>';
        console.error("Erro ao carregar turmas:", error);
    }
}

async function loadPayments() {
    const contentDiv = document.getElementById('payments-content');
    try {
        const response = await fetchWithAuth('/api/student/payments');
        const payments = await response.json();
        if (payments.length === 0) {
            contentDiv.innerHTML = '<p class="text-gray-500">Nenhum registro financeiro encontrado.</p>';
            return;
        }
        contentDiv.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="py-2 px-4 border-b">Vencimento</th>
                            <th class="py-2 px-4 border-b">Valor</th>
                            <th class="py-2 px-4 border-b">Status</th>
                            <th class="py-2 px-4 border-b">Data Pagto.</th>
                        </tr>
                    </thead>
                    <tbody>${payments.map(p => `
                        <tr class="text-center">
                            <td class="py-2 px-4 border-b">${new Date(p.due_date).toLocaleDateString()}</td>
                            <td class="py-2 px-4 border-b">R$ ${p.amount.toFixed(2)}</td>
                            <td class="py-2 px-4 border-b">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                                    p.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    p.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }">${p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Atrasado'}</span>
                            </td>
                            <td class="py-2 px-4 border-b">${p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '---'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        contentDiv.innerHTML = '<p class="text-red-500">Não foi possível carregar seu histórico financeiro.</p>';
        console.error("Erro ao carregar pagamentos:", error);
    }
}

async function initializeAuthenticatedState(user) {
    showLoading(true);
    try {
        const response = await fetchWithAuth('/api/student/profile');
        const studentProfile = await response.json();
        await renderAuthenticatedApp(studentProfile);
    } catch (error) {
        console.error("Erro ao buscar dados do aluno:", error);
        signOut(auth); 
    } finally {
        showLoading(false);
    }
}

// --- PONTO DE ENTRADA DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("main.js: Evento DOMContentLoaded disparado.");
    
    authContainer = document.getElementById('auth-container');
    appContainer = document.getElementById('app-container');
    loadingIndicator = document.getElementById('loading-indicator');
    
    console.log("main.js: Elementos do DOM obtidos:", { authContainer, appContainer, loadingIndicator });

    onAuthStateChanged(auth, (user) => {
        console.log("main.js: onAuthStateChanged callback executado. Usuário:", user);
        if (user) {
            currentUser = user;
            initializeAuthenticatedState(user);
        } else {
            currentUser = null;
            idToken = null;
            renderLoginScreen();
        }
    });
});

