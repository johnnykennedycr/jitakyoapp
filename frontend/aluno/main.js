import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from './firebase.js';

// --- CONFIGURAÇÕES ---
const API_BASE_URL = 'https://jitakyoapp-217073545024.southamerica-east1.run.app';
// IMPORTANTE: Substitua pela sua Public Key de PRODUÇÃO ou TESTE do Mercado Pago
const MERCADO_PAGO_PUBLIC_KEY = 'APP_USR-a89c1142-728d-4318-ba55-9ff8e7fdfb90';


// --- ESTADO DA APLICAÇÃO ---
let currentUser = null;
let userProfile = null;
let mp = null; // Instância do Mercado Pago
let currentBrick = null; // Armazena a instância do brick atual para poder destruí-la

// --- ELEMENTOS DO DOM ---
let authContainer;
let appContainer;
let loadingIndicator;

// --- FUNÇÕES DE API ---
async function fetchWithAuth(endpoint, options = {}) {
    if (!currentUser) {
        throw new Error("Usuário não autenticado.");
    }
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
                    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Faturas</h2>
                    <div class="border-b border-gray-200">
                        <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                            <button id="tab-pending" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-600 border-blue-600">Pendentes e Atrasadas</button>
                            <button id="tab-paid" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">Histórico de Pagas</button>
                        </nav>
                    </div>
                    <div id="pending-payments-content"></div>
                    <div id="paid-payments-content" class="hidden"></div>
                </section>
            </main>
        </div>
        <div id="payment-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
            <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-auto flex flex-col" style="max-height: 90vh;">
                <div class="flex-shrink-0 flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-800">Finalizar Pagamento</h3>
                    <button id="close-modal-button" class="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
                </div>
                <div class="flex-grow overflow-y-auto">
                    <div id="payment-brick-container"></div>
                </div>
            </div>
        </div>
    `;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    document.getElementById('user-name').textContent = userProfile.name;
    document.getElementById('logout-button').addEventListener('click', () => signOut(auth));

    setupTabListeners();
    setupModalListeners();
    
    appContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('pay-button')) {
            const paymentId = event.target.dataset.paymentId;
            const paymentAmount = event.target.dataset.paymentAmount;
            handlePayment(paymentId, paymentAmount);
        }
    });

    loadClasses();
    loadPayments();
}

function setupTabListeners() {
    const tabPending = document.getElementById('tab-pending');
    const tabPaid = document.getElementById('tab-paid');
    const pendingContent = document.getElementById('pending-payments-content');
    const paidContent = document.getElementById('paid-payments-content');

    tabPending.addEventListener('click', () => {
        pendingContent.classList.remove('hidden');
        paidContent.classList.add('hidden');
        tabPending.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-600 border-blue-600';
        tabPaid.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300';
    });

    tabPaid.addEventListener('click', () => {
        paidContent.classList.remove('hidden');
        pendingContent.classList.add('hidden');
        tabPaid.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-600 border-blue-600';
        tabPending.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300';
    });
}

function setupModalListeners() {
    const modal = document.getElementById('payment-modal');
    document.getElementById('close-modal-button').addEventListener('click', () => {
        modal.classList.add('hidden');
        if (currentBrick) {
            currentBrick.unmount();
            currentBrick = null;
        }
    });
}

async function loadClasses() {
    const classesList = document.getElementById('classes-list');
    classesList.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    try {
        const classes = await fetchWithAuth('/api/student/classes');
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
    const pendingContent = document.getElementById('pending-payments-content');
    const paidContent = document.getElementById('paid-payments-content');
    pendingContent.innerHTML = '<p class="text-gray-500 mt-4">Carregando...</p>';
    paidContent.innerHTML = '<p class="text-gray-500 mt-4">Carregando...</p>';

    try {
        const payments = await fetchWithAuth('/api/student/payments');
        console.log("Pagamentos recebidos da API:", payments);
        
        const pendingPayments = payments.filter(p => p.status !== 'paid');
        const paidPayments = payments.filter(p => p.status === 'paid');

        renderPaymentsTable(pendingContent, pendingPayments, false);
        renderPaymentsTable(paidContent, paidPayments, true);

    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        pendingContent.innerHTML = '<p class="text-red-500 mt-4">Não foi possível carregar seu histórico financeiro.</p>';
        paidContent.innerHTML = '<p class="text-red-500 mt-4">Não foi possível carregar seu histórico financeiro.</p>';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Data inválida';
    const date = new Date(dateString);
    if (isNaN(date)) return 'Data inválida';
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function renderPaymentsTable(container, payments, isPaidTable) {
     if (!payments || payments.length === 0) {
        container.innerHTML = `<p class="text-gray-500 mt-4">${isPaidTable ? 'Nenhum pagamento finalizado encontrado.' : 'Nenhuma fatura pendente encontrada.'}</p>`;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto mt-4">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        ${isPaidTable ? '<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Pag.</th>' : '<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>'}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${payments.map(p => {
                        const description = p.description || `${p.type || 'Fatura'} - ${p.reference_month}/${p.reference_year}`;
                        return `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${description}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDate(p.due_date)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">R$ ${p.amount.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">${renderPaymentStatus(p)}</td>
                                ${isPaidTable ? 
                                    `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDate(p.payment_date)}</td>` 
                                    : 
                                    `<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button class="pay-button text-blue-600 hover:text-blue-800 font-semibold" 
                                                data-payment-id="${p.id}" 
                                                data-payment-amount="${p.amount}">Pagar</button>
                                     </td>`
                                }
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderPaymentStatus(payment) {
    if (!payment || !payment.status) return '';
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

async function handlePayment(paymentId, paymentAmount) {
    const modal = document.getElementById('payment-modal');
    const brickContainer = document.getElementById('payment-brick-container');
    brickContainer.innerHTML = '<p class="text-center text-gray-600">Gerando link de pagamento...</p>';
    modal.classList.remove('hidden');

    try {
        const { preferenceId } = await fetchWithAuth(`/api/student/payments/${paymentId}/create-preference`, { method: 'POST' });
        
        if (currentBrick) {
            currentBrick.unmount();
        }
        brickContainer.innerHTML = '';
        
        const settings = {
            initialization: {
                amount: parseFloat(paymentAmount), 
                preferenceId: preferenceId,
            },
            customization: {
                paymentMethods: {
                    creditCard: "all",
                    debitCard: "all",
                    ticket: "all",
                    pix: "all", 
                },
            },
            callbacks: {
                onReady: () => { console.log("Brick de pagamento pronto!"); },
                // --- CORREÇÃO PRINCIPAL APLICADA AQUI ---
                onSubmit: async (cardFormData) => {
                    // cardFormData contém os dados do pagamento (valor, método, etc.)
                    // O SDK do Mercado Pago usa esses dados para processar o pagamento
                    // quando esta função é chamada.
                    console.log("Enviando pagamento...", cardFormData);
                    // A função deve retornar uma promessa que resolve com o ID do pagamento
                    // ou rejeita com um erro. O SDK cuida da maior parte disso.
                },
                onError: (error) => console.error('Erro no brick de pagamento:', error),
            },
        };
        
        currentBrick = await mp.bricks().create("payment", "payment-brick-container", settings);

    } catch (error) {
        console.error("Erro ao criar preferência de pagamento:", error);
        brickContainer.innerHTML = '<p class="text-center text-red-500 font-semibold">Não foi possível gerar o link de pagamento. Tente novamente mais tarde.</p>';
    }
}


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
        
        try {
            mp = new MercadoPago(MERCADO_PAGO_PUBLIC_KEY, {
                locale: 'pt-BR'
            });

            onAuthStateChanged(auth, (user) => {
                currentUser = user;
                if (user) {
                    initializeAuthenticatedState(user);
                } else {
                    userProfile = null;
                    renderLoginScreen();
                    loadingIndicator.classList.add('hidden');
                }
            });

        } catch(e) {
            console.error("Erro ao inicializar Mercado Pago. Verifique sua Public Key.", e);
            alert("Erro na configuração de pagamentos. Verifique o console para mais detalhes.");
        }
    });
}

initialize();

