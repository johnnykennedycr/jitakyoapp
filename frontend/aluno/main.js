import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut, getMessagingToken } from './firebase.js';

// --- CONFIGURAÇÕES ---
const API_BASE_URL = 'https://jitakyoapp-217073545024.southamerica-east1.run.app';
const MERCADO_PAGO_PUBLIC_KEY = 'APP_USR-a89c1142-728d-4318-ba55-9ff8e7fdfb90';


// --- ESTADO DA APLICAÇÃO ---
let currentUser = null;
let userProfile = null;
let mp = null;
let currentBrick = null;

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

// --- LÓGICA DE NOTIFICAÇÕES ---
async function requestAndSavePushToken() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const currentToken = await getMessagingToken();
            if (currentToken) {
                await sendTokenToServer(currentToken);
            } else {
                console.error('Não foi possível obter o token de notificação.');
            }
        } else {
            console.warn('Permissão de notificação não concedida.');
        }
    } catch (error) {
        console.error('Erro ao solicitar permissão ou obter token:', error);
    }
}

async function sendTokenToServer(token) {
    try {
        await fetchWithAuth('/api/student/save-push-token', {
            method: 'POST',
            body: JSON.stringify({ token: token }),
        });
        console.log('Token de notificação salvo no servidor.');
    } catch (error) {
        console.error('Erro ao enviar token de notificação para o servidor:', error);
    }
}


// --- FUNÇÕES DE RENDERIZAÇÃO E UI ---
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
                <div class="flex items-center space-x-4">
                    <button id="notification-icon" class="relative text-gray-500 hover:text-gray-700">
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span id="notification-badge" class="hidden absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"></span>
                    </button>
                    <button id="logout-button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Sair</button>
                </div>
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
        <!-- MODAL DE NOTIFICAÇÕES -->
        <div id="notifications-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
            <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md mx-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Notificações</h3>
                    <button id="close-notifications-modal" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div id="notifications-list" class="space-y-3 max-h-80 overflow-y-auto">
                </div>
            </div>
        </div>
        <!-- Outros modais (pagamento, sucesso) -->
        <div id="payment-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
             <div id="payment-modal-content" class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-auto flex flex-col" style="max-height: 90vh;"></div>
        </div>
        <div id="success-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
            <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm mx-auto text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 class="text-lg leading-6 font-medium text-gray-900">Pagamento Aprovado!</h3>
                <div class="mt-2 px-7 py-3"><p class="text-sm text-gray-500">Seu pagamento foi processado com sucesso. Obrigado!</p></div>
                <div class="mt-4"><button id="close-success-modal-button" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Fechar</button></div>
            </div>
        </div>
    `;
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    document.getElementById('user-name').textContent = userProfile.name;
    document.getElementById('logout-button').addEventListener('click', () => signOut(auth));

    setupTabListeners();
    setupModalListeners();
    
    document.getElementById('notification-icon').addEventListener('click', loadNotifications);
    document.getElementById('close-notifications-modal').addEventListener('click', () => {
        document.getElementById('notifications-modal').classList.add('hidden');
    });

    appContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.pay-button');
        if (button) {
            const paymentId = button.dataset.paymentId;
            const paymentAmount = button.dataset.paymentAmount;
            handlePayment(paymentId, paymentAmount);
        }
    });

    loadClasses();
    loadPayments();
    
    if (Notification.permission === 'default') {
        const banner = document.createElement('div');
        banner.id = 'notification-banner';
        banner.className = 'fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 flex justify-between items-center shadow-lg z-50';
        banner.innerHTML = `
            <p>Deseja receber notificações sobre novidades e avisos?</p>
            <div>
                <button id="allow-notifications" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg mr-2">Sim</button>
                <button id="deny-notifications" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Agora não</button>
            </div>
        `;
        document.body.appendChild(banner);
        document.getElementById('allow-notifications').addEventListener('click', () => {
            requestAndSavePushToken();
            banner.remove();
        });
        document.getElementById('deny-notifications').addEventListener('click', () => banner.remove());
    } else if (Notification.permission === 'granted') {
        requestAndSavePushToken();
    }
}


// --- LÓGICA DE NOTIFICAÇÕES (continuação) ---

async function loadNotifications() {
    const modal = document.getElementById('notifications-modal');
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notification-badge');

    list.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    modal.classList.remove('hidden');

    try {
        const notifications = await fetchWithAuth('/api/student/notifications');
        
        if (notifications && notifications.length > 0) {
            list.innerHTML = notifications.map(notif => {
                const date = new Date(notif.created_at._seconds * 1000);
                const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `
                    <div class="p-3 ${notif.read ? 'bg-gray-100' : 'bg-blue-50'} rounded-lg border-l-4 ${notif.read ? 'border-gray-300' : 'border-blue-500'}">
                        <p class="font-semibold text-gray-800">${notif.title}</p>
                        <p class="text-sm text-gray-600">${notif.body}</p>
                        <p class="text-xs text-gray-400 text-right mt-1">${formattedDate}</p>
                    </div>
                `;
            }).join('');
            
            const unreadCount = notifications.filter(n => !n.read).length;
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }

        } else {
            list.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Nenhuma notificação encontrada.</p>';
            badge.classList.add('hidden');
        }

    } catch (error) {
        console.error("Erro ao buscar notificações:", error);
        list.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Não foi possível carregar as notificações.</p>';
    }
}

// --- OUTRAS FUNÇÕES (loadClasses, loadPayments, formatDate, etc.) ---

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
    const paymentModal = document.getElementById('payment-modal');
    const successModal = document.getElementById('success-modal');
    
    paymentModal.addEventListener('click', (event) => {
        if (event.target.id === 'close-modal-button' || event.target === paymentModal) {
            paymentModal.classList.add('hidden');
            if (currentBrick) {
                currentBrick.unmount();
                currentBrick = null;
            }
        }
    });

    document.getElementById('close-success-modal-button').addEventListener('click', () => {
        successModal.classList.add('hidden');
    });
}


async function loadClasses() {
    const classesList = document.getElementById('classes-list');
    classesList.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    try {
        const classes = await fetchWithAuth('/api/student/classes');
        if (classes && classes.length > 0) {
            classesList.innerHTML = classes.map(c => {
                // Formata os horários para exibição de forma segura
                const scheduleHtml = (c.schedule && Array.isArray(c.schedule) && c.schedule.length > 0)
                    ? `<div class="text-sm text-gray-500 mt-2 space-y-1">
                        ${c.schedule.map(s => `<div>${s.day_of_week || ''}: ${s.start_time || ''} - ${s.end_time || ''}</div>`).join('')}
                      </div>`
                    : '<p class="text-sm text-gray-500 mt-2">Horários não definidos.</p>';

                return `
                <div class="border-b last:border-b-0 pb-4 mb-4">
                    <h3 class="font-bold text-lg text-gray-800">${c.class_name || 'Turma sem nome'}</h3>
                    <p class="text-sm text-gray-600">Professor: ${c.teacher_name || 'Não informado'}</p>
                    ${scheduleHtml}
                </div>
            `;
            }).join('');
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

function formatDate(dateSource) {
    if (!dateSource) return 'Data inválida';

    let date;
    // Tenta tratar como objeto Firestore Timestamp ({ _seconds: ... })
    if (typeof dateSource === 'object' && dateSource.hasOwnProperty('_seconds')) {
        date = new Date(dateSource._seconds * 1000);
    } 
    // Tenta tratar como string (ex: ISO 8601 ou o formato GMT)
    else {
        date = new Date(dateSource);
    }
    
    if (isNaN(date.getTime())) {
        return 'Data inválida';
    }
    
    // Usar UTC para evitar problemas de fuso horário que podem mudar o dia
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
    if (!payment || !payment.status || !payment.due_date) return '';

    let dueDate;
    // Lógica unificada para tratar a data
    if (typeof payment.due_date === 'object' && payment.due_date.hasOwnProperty('_seconds')) {
        dueDate = new Date(payment.due_date._seconds * 1000);
    } else {
        dueDate = new Date(payment.due_date);
    }

    if (isNaN(dueDate.getTime())) return ''; // Retorna vazio se a data for inválida

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (payment.status === 'paid') {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Pago</span>`;
    }
    // Compara apenas a data, ignorando a hora
    if (dueDate < today) {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Atrasado</span>`;
    }
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>`;
}


function handlePayment(paymentId, paymentAmount) {
    const modal = document.getElementById('payment-modal');
    const modalContent = document.getElementById('payment-modal-content');

    modalContent.innerHTML = `
        <div class="flex-shrink-0 flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold text-gray-800">Informações para Pagamento</h3>
            <button id="close-modal-button" class="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
        </div>
        <div id="payment-step-1">
            <p class="text-gray-600 mb-4">Para habilitar todas as formas de pagamento, por favor, informe seu CPF.</p>
            <form id="cpf-form">
                <label for="cpf" class="block text-gray-700 text-sm font-bold mb-2">CPF</label>
                <input type="text" id="cpf" placeholder="000.000.000-00" required class="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button type="submit" class="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-300">
                    Continuar
                </button>
            </form>
        </div>
    `;

    modal.classList.remove('hidden');

    const cpfForm = document.getElementById('cpf-form');
    cpfForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cpf = document.getElementById('cpf').value;
        initializeBrick(paymentId, paymentAmount, cpf);
    });
}

async function initializeBrick(paymentId, paymentAmount, cpf) {
    const modalContent = document.getElementById('payment-modal-content');
    modalContent.innerHTML = `
        <div class="flex-shrink-0 flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold text-gray-800">Finalizar Pagamento</h3>
            <button id="close-modal-button" class="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
        </div>
        <div id="payment-error-container" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <strong class="font-bold">Erro!</strong>
            <span id="payment-error-message" class="block sm:inline"></span>
        </div>
        <div class="flex-grow overflow-y-auto">
             <div id="payment-brick-container"><p class="text-center text-gray-600">Gerando link de pagamento...</p></div>
        </div>
    `;
    
    try {
        const { preferenceId } = await fetchWithAuth(`/api/student/payments/${paymentId}/create-preference`, { 
            method: 'POST',
            body: JSON.stringify({ cpf })
        });
        
        if (currentBrick) {
            currentBrick.unmount();
        }
        document.getElementById('payment-brick-container').innerHTML = '';
        
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
                onSubmit: async ({ formData }) => {
                    document.getElementById('payment-error-container').classList.add('hidden');
                    try {
                        const response = await fetchWithAuth(`/api/student/payments/process`, {
                            method: 'POST',
                            body: JSON.stringify({
                                paymentId: paymentId,
                                mercadoPagoData: { formData }
                            }),
                        });
                        
                        if (response && response.status === 'success') {
                            document.getElementById('payment-modal').classList.add('hidden');
                            if (currentBrick) currentBrick.unmount();
                            document.getElementById('success-modal').classList.remove('hidden');
                            loadPayments();
                        } else {
                            const message = response.message || "Ocorreu um erro desconhecido.";
                            document.getElementById('payment-error-message').textContent = message;
                            document.getElementById('payment-error-container').classList.remove('hidden');
                        }
                    } catch (error) {
                        document.getElementById('payment-error-message').textContent = "Ocorreu um erro de comunicação. Por favor, tente novamente.";
                        document.getElementById('payment-error-container').classList.remove('hidden');
                    }
                },
                onError: (error) => {
                    console.error('Erro no brick de pagamento:', error);
                    document.getElementById('payment-error-message').textContent = "Erro ao inicializar o formulário. Verifique os dados.";
                    document.getElementById('payment-error-container').classList.remove('hidden');
                },
            },
        };
        
        currentBrick = await mp.bricks().create("payment", "payment-brick-container", settings);
    } catch (error) {
        console.error("Erro ao criar preferência de pagamento:", error);
        document.getElementById('payment-brick-container').innerHTML = '<p class="text-center text-red-500 font-semibold">Não foi possível gerar o link de pagamento. Tente novamente mais tarde.</p>';
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

