import { auth, signInWithEmailAndPassword, onAuthStateChanged, signOut, getMessagingToken } from './firebase.js';

// --- CONFIGURAÇÕES ---
const API_BASE_URL = 'https://jitakyoapp-217073545024.southamerica-east1.run.app';
const MERCADO_PAGO_PUBLIC_KEY = 'APP_USR-a89c1142-728d-4318-ba55-9ff8e7fdfb90';
const LOGO_PATH = 'aluno/icons/Square150x150Logo.scale-400.png';

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

// --- LÓGICA DO PAR-Q ---

const parQQuestions = [
    { id: 'q1', text: 'Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionada por profissionais de saúde?' },
    { id: 'q2', text: 'Você Sente dores do peito quanto pratica atividade física?' },
    { id: 'q3', text: 'No último mês, você sentiu dores no peito quando praticou atividade física?' },
    { id: 'q4', text: 'Você apresenta desequilíbrio devido à tontura e/ou perda de consciência?' },
    { id: 'q5', text: 'Você possui algum problema ósseo/ou articular que poderia ser piorado pela atividade física?' },
    { id: 'q6', text: 'Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?' },
    { id: 'q7', text: 'Sabe de alguma outra razão pela qual você não deve praticar atividade física?' },
    { id: 'q8', text: 'Você já apresentou/protocolou no seu clube algum Atestado Médico com restrições à prática de atividade esportiva?' }
];

function renderParQModal() {
    const modal = document.createElement('div');
    modal.id = 'parq-modal';
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100] p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div class="p-6 border-b bg-gray-50 flex items-center justify-between">
                <div>
                    <h3 class="text-xl font-bold text-gray-900">Anexo I - Questionário PAR-Q</h3>
                    <p class="text-xs text-gray-500 uppercase font-semibold mt-1">Prontidão para Atividade Física</p>
                </div>
                <img src="${LOGO_PATH}" class="h-10 w-10">
            </div>
            
            <div class="p-6 overflow-y-auto flex-grow bg-white">
                <p class="text-sm text-gray-600 mb-6 leading-relaxed italic text-left">
                    Este questionário tem o objetivo de identificar a necessidade de avaliação por um médico antes do início da atividade física. Se responder "SIM" a qualquer pergunta, consulte seu médico antes de treinar.
                </p>
                
                <form id="parq-form" class="space-y-6">
                    <div class="border rounded-xl overflow-hidden shadow-sm">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Pergunta</th>
                                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase w-16">Sim</th>
                                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase w-16">Não</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                ${parQQuestions.map(q => `
                                    <tr>
                                        <td class="px-4 py-4 text-sm text-gray-700 text-left font-medium">${q.text}</td>
                                        <td class="px-2 text-center">
                                            <input type="radio" name="${q.id}" value="sim" required class="h-5 w-5 text-indigo-600 focus:ring-indigo-500">
                                        </td>
                                        <td class="px-2 text-center">
                                            <input type="radio" name="${q.id}" value="nao" required class="h-5 w-5 text-indigo-600 focus:ring-indigo-500">
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="space-y-4 pt-4 border-t text-left">
                        <p class="text-xs text-gray-500">Ao salvar, você declara a veracidade das respostas e assume responsabilidade pelas atividades físicas praticadas sob seu acesso autenticado.</p>
                        <div>
                            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Declaração (Hoje)</label>
                            <input type="text" name="parq_date" value="${new Date().toLocaleDateString('pt-BR')}" disabled class="w-full border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 font-bold p-2.5 cursor-not-allowed">
                        </div>
                    </div>
                </form>
            </div>

            <div class="p-6 border-t bg-gray-50 flex justify-end gap-3">
                <button type="button" id="cancel-parq" class="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">Depois</button>
                <!-- Botão com ID explícito e FOR referenciando o form -->
                <button type="submit" form="parq-form" id="submit-parq-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95">
                    SALVAR E DECLARAR
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    document.getElementById('cancel-parq').onclick = () => modal.remove();
    
    const form = document.getElementById('parq-form');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        // Evita o TypeError buscando pelo ID diretamente
        const btn = document.getElementById('submit-parq-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Salvando...";
        }

        const formData = new FormData(form);
        const answers = {};
        parQQuestions.forEach(q => {
            answers[q.id] = formData.get(q.id);
        });

        const data = {
            par_q_data: {
                answers: answers,
                filled_at: new Date().toLocaleDateString('pt-BR'),
                status: "completed"
            },
            par_q_filled: true
        };

        try {
            await fetchWithAuth('/api/student/par-q', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            modal.remove();
            userProfile.par_q_filled = true;
            renderAppScreen(); 
            showSuccessModal("Questionário PAR-Q salvo com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar PAR-Q:", error);
            if (btn) {
                btn.disabled = false;
                btn.innerText = "SALVAR E DECLARAR";
            }
            alert("Falha ao salvar o questionário. Verifique sua conexão e tente novamente.");
        }
    };
}

function showSuccessModal(message) {
    const modal = document.getElementById('success-modal');
    const msgEl = modal.querySelector('p');
    if (msgEl) msgEl.textContent = message;
    modal.classList.remove('hidden');
}

// --- FUNÇÕES DE RENDERIZAÇÃO E UI ---
function renderLoginScreen() {
    if (!authContainer) return;
    authContainer.innerHTML = `
        <div class="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md flex flex-col items-center">
            <img src="${LOGO_PATH}" alt="Logo JitaKyoApp" class="w-24 h-24 mb-4 object-contain">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-1">JitaKyoApp</h2>
            <p class="text-center text-gray-500 mb-8 font-medium">Área do Aluno</p>
            <form id="login-form" class="w-full">
                <div class="mb-4">
                    <label for="email" class="block text-gray-700 text-sm font-bold mb-2">Email</label>
                    <input type="email" id="email" required class="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="mb-6">
                    <label for="password" class="block text-gray-700 text-sm font-bold mb-2">Senha</label>
                    <input type="password" id="password" required class="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-300 shadow-md">
                    Entrar
                </button>
            </form>
            <p id="login-error" class="text-red-500 text-center mt-4 text-sm"></p>
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

    const parQAlertHtml = (!userProfile.par_q_filled) ? `
        <div class="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3 text-left">
                    <p class="text-sm text-amber-700 font-bold">Saúde: PAR-Q Pendente</p>
                    <p class="text-xs text-amber-600">Preencha o questionário de prontidão física para sua segurança.</p>
                </div>
            </div>
            <button id="open-parq-btn" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">PREENCHER</button>
        </div>
    ` : '';

    appContainer.innerHTML = `
        <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <header class="flex justify-between items-center py-6">
                <div class="flex items-center space-x-4">
                    <img src="${LOGO_PATH}" alt="Logo" class="h-12 w-12 rounded-lg object-contain">
                    <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Olá, <span id="user-name" class="text-blue-600"></span>!</h1>
                </div>
                <div class="flex items-center space-x-4">
                    <button id="notification-icon" class="relative text-gray-500 hover:text-gray-700 transition-colors">
                        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span id="notification-badge" class="hidden absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"></span>
                    </button>
                    <button id="logout-button" class="bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-bold py-2 px-4 rounded-lg transition-all text-sm border border-gray-200">Sair</button>
                </div>
            </header>

            ${parQAlertHtml}

            <main class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6 pb-12">
                <section class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-md border border-gray-50">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-4 border-b pb-2">Minhas Turmas</h2>
                    <div id="classes-list" class="space-y-4"></div>
                </section>
                <section class="lg:col-span-2 bg-white p-6 rounded-2xl shadow-md border border-gray-50">
                    <h2 class="text-2xl font-semibold text-gray-800 mb-4 border-b pb-2">Faturas</h2>
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
        <!-- MODAIS -->
        <div id="notifications-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
            <div class="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md mx-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Notificações</h3>
                    <button id="close-notifications-modal" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div id="notifications-list" class="space-y-3 max-h-80 overflow-y-auto"></div>
            </div>
        </div>
        <div id="payment-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
             <div id="payment-modal-content" class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-auto flex flex-col" style="max-height: 90vh;"></div>
        </div>
        <div id="success-modal" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50 p-4">
            <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm mx-auto text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 class="text-lg leading-6 font-medium text-gray-900">Sucesso!</h3>
                <div class="mt-2 px-7 py-3"><p class="text-sm text-gray-500">Operação processada com sucesso. Obrigado!</p></div>
                <div class="mt-4"><button id="close-success-modal-button" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Fechar</button></div>
            </div>
        </div>
    `;
    
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    document.getElementById('user-name').textContent = userProfile.name;
    document.getElementById('logout-button').addEventListener('click', () => signOut(auth));

    if (document.getElementById('open-parq-btn')) {
        document.getElementById('open-parq-btn').addEventListener('click', renderParQModal);
    }

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
            <p class="text-sm mr-4 text-left">Deseja receber notificações sobre novidades e avisos?</p>
            <div class="flex-shrink-0">
                <button id="allow-notifications" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg mr-2 text-sm transition-colors">Sim</button>
                <button id="deny-notifications" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">Agora não</button>
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

async function loadNotifications() {
    const modal = document.getElementById('notifications-modal');
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notification-badge');

    list.innerHTML = '<p class="text-gray-500 text-center py-4">Carregando...</p>';
    modal.classList.remove('hidden');

    try {
        const notifications = await fetchWithAuth('/api/student/notifications');
        
        if (notifications && notifications.length > 0) {
            list.innerHTML = notifications.map(notif => {
                const date = new Date(notif.created_at._seconds * 1000);
                const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `
                    <div class="p-4 ${notif.read ? 'bg-gray-50' : 'bg-blue-50'} rounded-xl border-l-4 ${notif.read ? 'border-gray-200' : 'border-blue-500'} shadow-sm">
                        <p class="font-bold text-gray-800 text-left">${notif.title}</p>
                        <p class="text-sm text-gray-600 mt-1 text-left">${notif.body}</p>
                        <p class="text-[10px] text-gray-400 text-right mt-2">${formattedDate}</p>
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
            list.innerHTML = '<p class="text-sm text-gray-500 text-center py-8 italic">Nenhuma notificação encontrada.</p>';
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error("Erro ao buscar notificações:", error);
        list.innerHTML = '<p class="text-sm text-red-500 text-center py-4">Não foi possível carregar as notificações.</p>';
    }
}

function setupTabListeners() {
    const tabPending = document.getElementById('tab-pending');
    const tabPaid = document.getElementById('tab-paid');
    const pendingContent = document.getElementById('pending-payments-content');
    const paidContent = document.getElementById('paid-payments-content');

    const activeClass = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-600 border-blue-600';
    const inactiveClass = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300';

    tabPending.addEventListener('click', () => {
        pendingContent.classList.remove('hidden');
        paidContent.classList.add('hidden');
        tabPending.className = activeClass;
        tabPaid.className = inactiveClass;
    });

    tabPaid.addEventListener('click', () => {
        paidContent.classList.remove('hidden');
        pendingContent.classList.add('hidden');
        tabPaid.className = activeClass;
        tabPending.className = inactiveClass;
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
                const scheduleHtml = (c.schedule && Array.isArray(c.schedule) && c.schedule.length > 0)
                    ? `<div class="text-sm text-gray-500 mt-2 space-y-1">
                        ${c.schedule.map(s => `<div class="flex justify-between"><span>${s.day_of_week}:</span> <span class="font-medium">${s.start_time} - ${s.end_time}</span></div>`).join('')}
                      </div>`
                    : '<p class="text-sm text-gray-400 mt-2">Horários não definidos.</p>';

                return `
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 text-left">
                    <h3 class="font-bold text-lg text-gray-800">${c.class_name || 'Turma sem nome'}</h3>
                    <p class="text-sm text-gray-600 font-medium">Prof. ${c.teacher_name || 'Não informado'}</p>
                    ${scheduleHtml}
                </div>
            `;
            }).join('');
        } else {
            classesList.innerHTML = '<p class="text-gray-500 text-center py-4 italic">Você não está matriculado em nenhuma turma.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar turmas:', error);
        classesList.innerHTML = '<p class="text-red-500 text-sm">Não foi possível carregar suas turmas.</p>';
    }
}

async function loadPayments() {
    const pendingContent = document.getElementById('pending-payments-content');
    const paidContent = document.getElementById('paid-payments-content');
    pendingContent.innerHTML = '<p class="text-gray-500 mt-4">Carregando faturas...</p>';
    paidContent.innerHTML = '<p class="text-gray-500 mt-4">Carregando histórico...</p>';

    try {
        const payments = await fetchWithAuth('/api/student/payments');
        const pendingPayments = payments.filter(p => p.status !== 'paid');
        const paidPayments = payments.filter(p => p.status === 'paid');

        renderPaymentsTable(pendingContent, pendingPayments, false);
        renderPaymentsTable(paidContent, paidPayments, true);

    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        pendingContent.innerHTML = '<p class="text-red-500 mt-4 text-sm">Falha no carregamento financeiro.</p>';
        paidContent.innerHTML = '<p class="text-red-500 mt-4 text-sm">Falha no carregamento financeiro.</p>';
    }
}

function formatDate(dateSource) {
    if (!dateSource) return '--/--/----';
    let date;
    if (typeof dateSource === 'object' && dateSource.hasOwnProperty('_seconds')) {
        date = new Date(dateSource._seconds * 1000);
    } else {
        date = new Date(dateSource);
    }
    if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function renderPaymentsTable(container, payments, isPaidTable) {
     if (!payments || payments.length === 0) {
        container.innerHTML = `<p class="text-gray-400 mt-8 text-center italic text-sm text-balance">${isPaidTable ? 'Nenhum pagamento finalizado encontrado.' : 'Nenhuma fatura pendente encontrada.'}</p>`;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto mt-4">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Descrição</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vencimento</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Valor</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                        ${isPaidTable ? '<th class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data Pag.</th>' : '<th class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ações</th>'}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${payments.map(p => {
                        const description = p.description || `${p.type || 'Fatura'} - ${p.reference_month}/${p.reference_year}`;
                        return `
                            <tr class="hover:bg-gray-50 transition-colors text-left">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">${description}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDate(p.due_date)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">R$ ${p.amount.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">${renderPaymentStatus(p)}</td>
                                ${isPaidTable ? 
                                    `<td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">${formatDate(p.payment_date)}</td>` 
                                    : 
                                    `<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button class="pay-button bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-1.5 rounded-lg font-bold transition-all text-xs" 
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
    let dueDate;
    if (payment.due_date) {
        dueDate = new Date(payment.due_date);
    } else if (payment.reference_year && payment.reference_month && payment.due_day) {
        dueDate = new Date(Date.UTC(payment.reference_year, payment.reference_month - 1, payment.due_day));
    } else {
        return '';
    }
    if (isNaN(dueDate.getTime())) return '';

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (payment.status === 'paid') {
        return `<span class="px-2 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full bg-green-100 text-green-800 uppercase">Pago</span>`;
    }
    if (dueDate < today) {
        return `<span class="px-2 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full bg-red-100 text-red-800 uppercase">Atrasado</span>`;
    }
    return `<span class="px-2 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-full bg-yellow-100 text-yellow-800 uppercase">Pendente</span>`;
}

function handlePayment(paymentId, paymentAmount) {
    const modal = document.getElementById('payment-modal');
    const modalContent = document.getElementById('payment-modal-content');

    modalContent.innerHTML = `
        <div class="flex-shrink-0 flex justify-between items-center mb-6 border-b pb-4">
            <h3 class="text-2xl font-bold text-gray-800">Pagamento</h3>
            <button id="close-modal-button" class="text-gray-400 hover:text-gray-800 text-3xl font-light">&times;</button>
        </div>
        <div id="payment-step-1">
            <p class="text-gray-600 mb-6 text-sm text-left">Para processar seu pagamento com segurança via Mercado Pago, informe seu CPF.</p>
            <form id="cpf-form" class="text-left">
                <div class="mb-6">
                    <label for="cpf" class="block text-gray-700 text-sm font-bold mb-2">CPF do Titular</label>
                    <input type="text" id="cpf" placeholder="000.000.000-00" required class="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all p-2">
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:shadow-outline transition-all duration-300 shadow-lg">
                    Continuar para Pagamento
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
        <div class="flex-shrink-0 flex justify-between items-center mb-6 border-b pb-4">
            <h3 class="text-2xl font-bold text-gray-800">Finalizar</h3>
            <button id="close-modal-button" class="text-gray-400 hover:text-gray-800 text-3xl font-light">&times;</button>
        </div>
        <div id="payment-error-container" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <strong class="font-bold">Erro!</strong>
            <span id="payment-error-message" class="block sm:inline"></span>
        </div>
        <div class="flex-grow overflow-y-auto">
             <div id="payment-brick-container"><p class="text-center text-gray-500 py-8 italic animate-pulse">Iniciando ambiente seguro...</p></div>
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
                onReady: () => { console.log("Brick pronto."); },
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
                        document.getElementById('payment-error-message').textContent = "Erro de rede. Tente novamente.";
                        document.getElementById('payment-error-container').classList.remove('hidden');
                    }
                },
                onError: (error) => {
                    console.error('Erro no brick:', error);
                    document.getElementById('payment-error-message').textContent = "Erro ao carregar formulário.";
                    document.getElementById('payment-error-container').classList.remove('hidden');
                },
            },
        };
        
        currentBrick = await mp.bricks().create("payment", "payment-brick-container", settings);
    } catch (error) {
        console.error("Erro preferência:", error);
        document.getElementById('payment-brick-container').innerHTML = '<p class="text-center text-red-500 font-bold py-8">Indisponível no momento.</p>';
    }
}

async function initializeAuthenticatedState(user) {
    loadingIndicator.classList.remove('hidden');
    try {
        const profile = await fetchWithAuth('/api/student/profile');
        userProfile = profile;
        renderAppScreen();
        
        if (!userProfile.par_q_filled) {
            setTimeout(renderParQModal, 1500);
        }
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        signOut(auth); 
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function initialize() {
    document.addEventListener('DOMContentLoaded', () => {
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
            console.error("Erro Mercado Pago:", e);
        }
    });
}

initialize();