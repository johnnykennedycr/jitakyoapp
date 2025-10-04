import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from './firebase.js';

// --- CONFIGURAÇÕES ---
const API_BASE_URL = 'https://jitakyoapp-217073545024.southamerica-east1.run.app';

// --- ESTADO DA APLICAÇÃO ---
let currentUser = null;
let userProfile = null;

// --- ELEMENTOS DO DOM ---
let authContainer;
let appContainer;
let loadingIndicator;

// --- FUNÇÕES DE API ---
async function fetchWithAuth(endpoint, options = {}) {
    if (!currentUser) {
        throw new Error("Usuário não autenticado.");
    }
    // Força a atualização do token para evitar expiração
    const idToken = await currentUser.getIdToken(true);

    const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Falha ao decodificar erro da API.' }));
        console.error('Erro na API:', response.status, errorData);
        throw new Error(errorData.error || `Erro na API: ${response.status}`);
    }
    return response.json();
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function renderLoginScreen() {
    if (!authContainer) return;
    authContainer.innerHTML = `
        <div class="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-2">JitaKyoApp</h2>
            <p class="text-center text-gray-500 mb-8">Área do Aluno</p>
            <form id="login-form">
                <div class="mb-4">
                    <label for="email" class="block text-gray-700 text-sm font-bold mb-2">Email</label>
                    <input type="email" id="email" required class="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="mb-6">
                    <label for="password" class="block text-gray-700 text-sm font-bold mb-2">Senha</label>
                    <input type="password" id="password" required class="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-300">Entrar</button>
            </form>
            <p id="login-error" class="text-red-500 text-center mt-4"></p>
        </div>
    `;
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async(e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        loginError.textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error('Erro no login:', error);
            loginError.textContent = 'Email ou senha inválidos.';
        }
    });
}

function renderAppScreen() {
    if (!appContainer) return;
    appContainer.innerHTML = `
        <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <header class="flex justify-between items-center py-6">
                <h1 class="text-3xl font-bold text-gray-900">Olá, <span id="user-name"></span>!</h1>
                <button id="logout-button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Sair</button>
            </header>
            <main class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                <section class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-md">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Minhas Turmas</h2>
                    <div id="classes-list" class="space-y-4"></div>
                </section>
                <section class="lg:col-span-2 bg-white p-6 rounded-2xl shadow-md">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Meu Financeiro</h2>
                    <div id="financial-list" class="space-y-4"></div>
                </section>
            </main>
        </div>

        <!-- Modal de Pagamento (inicialmente oculto) -->
        <div id="payment-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-2xl font-bold text-gray-800">Realizar Pagamento</h3>
                    <button id="close-modal-button" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div id="modal-content"></div>
                <button id="close-modal-button-footer" class="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Fechar</button>
            </div>
        </div>
    `;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    document.getElementById('user-name').textContent = userProfile.name;
    document.getElementById('logout-button').addEventListener('click', () => signOut(auth));
    
    // Adiciona os listeners para o modal
    const modal = document.getElementById('payment-modal');
    document.getElementById('close-modal-button').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('close-modal-button-footer').addEventListener('click', () => modal.classList.add('hidden'));
    
    // Adiciona listener para os botões de pagar (usando delegação de evento)
    const financialList = document.getElementById('financial-list');
    financialList.addEventListener('click', (event) => {
        if (event.target.classList.contains('pay-button')) {
            const button = event.target;
            openPaymentModal({
                id: button.dataset.paymentId,
                description: button.dataset.description,
                amount: button.dataset.amount,
            });
        }
    });

    loadClasses();
    loadPayments();
}

async function loadClasses() {
    const classesList = document.getElementById('classes-list');
    classesList.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    try {
        const classes = await fetchWithAuth('/api/student/classes');
        console.log("Dados das turmas recebidos da API:", classes);
        if (classes && classes.length > 0) {
            classesList.innerHTML = classes.map(c => `
                <div class="border-b pb-2">
                    <h3 class="font-bold text-lg">${c.class_name || 'Turma sem nome'}</h3>
                    <p class="text-sm text-gray-600">Professor: ${c.teacher_name || 'Não informado'}</p>
                </div>
            `).join('');
        } else {
            classesList.innerHTML = '<p class="text-gray-500">Você não está matriculado em nenhuma turma.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar turmas:', error);
        classesList.innerHTML = '<p class="text-red-500">Não foi possível carregar suas turmas.</p>';
    }
}

async function loadPayments() {
    const paymentsList = document.getElementById('financial-list');
    paymentsList.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    try {
        const payments = await fetchWithAuth('/api/student/payments');
        console.log("Dados financeiros recebidos da API:", payments);
        if (payments && payments.length > 0) {
            paymentsList.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${payments.map(p => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${p.description}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${new Date(p.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">R$ ${p.amount.toFixed(2)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">${renderPaymentStatus(p)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        ${p.status !== 'paid' ?
                                            `<button class="pay-button text-blue-600 hover:text-blue-800 font-semibold" 
                                                     data-payment-id="${p.id}" 
                                                     data-description="${p.description}" 
                                                     data-amount="${p.amount.toFixed(2)}">
                                                Pagar
                                            </button>` :
                                            `<span class="text-green-600 font-semibold">Finalizado</span>`
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            paymentsList.innerHTML = '<p class="text-gray-500">Nenhum registro financeiro encontrado.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        paymentsList.innerHTML = '<p class="text-red-500">Não foi possível carregar seu histórico financeiro.</p>';
    }
}

function renderPaymentStatus(payment) {
    const dueDate = new Date(payment.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (payment.status === 'paid') {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Pago</span>`;
    }
    if (dueDate < today) {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Atrasado</span>`;
    }
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>`;
}

function openPaymentModal({ id, description, amount }) {
    const modal = document.getElementById('payment-modal');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <p class="text-gray-700 mb-2"><strong>Descrição:</strong> ${description}</p>
        <p class="text-gray-700 mb-4"><strong>Valor:</strong> R$ ${amount}</p>
        <div class="mt-4 p-4 border rounded-lg text-center bg-gray-50">
            <p class="font-semibold text-gray-800">Pague com Pix!</p>
            <img src="https://placehold.co/250x250/fafafa/333?text=QR+Code+PIX" alt="QR Code PIX" class="mx-auto mt-2 rounded-md">
            <p class="mt-2 text-xs text-gray-500">Aponte a câmera do seu celular para o QR Code para pagar.</p>
        </div>
        <p class="mt-4 text-sm text-gray-600 text-center">Após o pagamento, o status será atualizado automaticamente em alguns minutos.</p>
    `;
    modal.classList.remove('hidden');
}

// --- LÓGICA DE INICIALIZAÇÃO ---
async function initializeAuthenticatedState(user) {
    loadingIndicator.classList.remove('hidden');
    try {
        const profile = await fetchWithAuth('/api/student/profile');
        userProfile = profile;
        renderAppScreen();
    } catch (error) {
        console.error('Erro ao buscar dados do aluno:', error);
        signOut(auth); 
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function initialize() {
    console.log("main.js: Script carregado e executado.");

    document.addEventListener('DOMContentLoaded', () => {
        console.log("main.js: Evento DOMContentLoaded disparado.");
        authContainer = document.getElementById('auth-container');
        appContainer = document.getElementById('app-container');
        loadingIndicator = document.getElementById('loading-indicator');
        console.log("main.js: Elementos do DOM obtidos:", { authContainer, appContainer, loadingIndicator });

        onAuthStateChanged(auth, (user) => {
            console.log("main.js: onAuthStateChanged callback executado. Usuário:", user ? 'UserImpl' : null);
            currentUser = user;
            if (user) {
                initializeAuthenticatedState(user);
            } else {
                userProfile = null;
                console.log("main.js: Chamando renderLoginScreen.");
                renderLoginScreen();
                loadingIndicator.classList.add('hidden');
            }
        });
    });
}

initialize();

