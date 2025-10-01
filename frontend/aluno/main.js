import { auth } from "./firebase.js"; // Importa a configuração do Firebase
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";

// --- CONFIGURAÇÃO DA API ---
const API_BASE_URL = 'https://jitakyoapp-r7fl5wa5ea-rj.a.run.app'; // Substitua pela URL da sua API

// --- GERENCIAMENTO DE ESTADO ---
const state = {
    user: null,
    profile: null,
    classes: [],
    payments: [],
    idToken: null,
};

// --- CAMADA DA API ---
async function fetchWithAuth(endpoint, options = {}) {
    if (!state.idToken) {
        throw new Error("Usuário não autenticado.");
    }
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${state.idToken}`,
        'Content-Type': 'application/json'
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na API: ${response.statusText}`);
    }
    return response.json();
}

// --- RENDERIZAÇÃO ---
const appContainer = document.getElementById('app');

function renderLogin() {
    appContainer.innerHTML = `
        <div class="flex items-center justify-center min-h-screen bg-gray-50">
            <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <div class="text-center">
                    <h1 class="text-3xl font-bold text-gray-800">JitaKyoApp</h1>
                    <p class="text-gray-500">Área do Aluno</p>
                </div>
                <form id="login-form" class="space-y-6">
                    <div>
                        <label for="email" class="text-sm font-medium text-gray-700">Email</label>
                        <input id="email" name="email" type="email" required class="w-full px-4 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    <div>
                        <label for="password" class="text-sm font-medium text-gray-700">Senha</label>
                        <input id="password" name="password" type="password" required class="w-full px-4 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                     <p id="error-message" class="text-sm text-red-500 text-center hidden"></p>
                    <button type="submit" class="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300">Entrar</button>
                </form>
            </div>
        </div>
    `;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function renderDashboard() {
    const profile = state.profile;
    appContainer.innerHTML = `
        <div class="flex h-screen bg-gray-100">
            <!-- Sidebar -->
            <aside class="w-64 bg-white shadow-md hidden md:flex flex-col">
                <div class="p-6 text-2xl font-bold text-gray-800 border-b">
                    JitaKyoApp
                </div>
                <nav id="nav-menu" class="flex-1 p-4 space-y-2">
                     <a href="#" data-page="classes" class="flex items-center px-4 py-2 text-gray-700 bg-blue-100 text-blue-700 rounded-lg">Minhas Turmas</a>
                     <a href="#" data-page="payments" class="flex items-center px-4 py-2 text-gray-700 rounded-lg hover:bg-blue-100 hover:text-blue-700">Meu Financeiro</a>
                </nav>
                <div class="p-4 border-t">
                    <button id="logout-btn" class="w-full px-4 py-2 font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600">Sair</button>
                </div>
            </aside>
            <!-- Main Content -->
            <main class="flex-1 flex flex-col">
                <header class="bg-white shadow-sm p-4 flex justify-between items-center">
                    <h1 id="page-title" class="text-xl font-semibold text-gray-800">Bem-vindo(a), ${profile.name.split(' ')[0]}!</h1>
                    <div class="md:hidden">
                        <!-- Botão de menu mobile -->
                    </div>
                </header>
                <div id="content-area" class="flex-1 p-6 overflow-y-auto">
                   <!-- Conteúdo da página será inserido aqui -->
                </div>
            </main>
        </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('nav-menu').addEventListener('click', handleNavigation);

    // Renderiza a página inicial
    renderClassesPage();
}

function renderClassesPage() {
    document.getElementById('page-title').textContent = 'Minhas Turmas';
    const contentArea = document.getElementById('content-area');
    if (!state.classes || state.classes.length === 0) {
         contentArea.innerHTML = '<p class="text-gray-500">Você ainda não está matriculado em nenhuma turma.</p>';
         return;
    }
     contentArea.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${state.classes.map(enrollment => `
                <div class="bg-white p-6 rounded-lg shadow-md">
                    <h3 class="text-xl font-bold text-gray-800">${enrollment.training_class.name}</h3>
                    <p class="text-gray-600">Professor: ${enrollment.training_class.teacher_name}</p>
                    <div class="mt-2 text-sm text-gray-500">
                        ${enrollment.training_class.schedule.map(s => `<span>${s.day}: ${s.start_time} - ${s.end_time}</span>`).join('<br>')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPaymentsPage() {
    document.getElementById('page-title').textContent = 'Meu Financeiro';
    const contentArea = document.getElementById('content-area');
    if (!state.payments || state.payments.length === 0) {
         contentArea.innerHTML = '<p class="text-gray-500">Nenhuma cobrança encontrada.</p>';
         return;
    }
     contentArea.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h3 class="text-xl font-bold mb-4">Minhas Cobranças</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${state.payments.map(charge => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">${new Date(charge.due_date).toLocaleDateString()}</td>
                                <td class="px-6 py-4 whitespace-nowrap">R$ ${charge.amount.toFixed(2)}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        charge.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                        charge.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                    }">
                                        ${charge.status === 'paid' ? 'Pago' : charge.status === 'pending' ? 'Pendente' : 'Atrasado'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


// --- CONTROLE DE LÓGICA ---
async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const errorMessage = document.getElementById('error-message');
    errorMessage.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // O onAuthStateChanged vai cuidar do resto
    } catch (error) {
        console.error("Erro no login:", error);
        errorMessage.textContent = 'Email ou senha inválidos.';
        errorMessage.classList.remove('hidden');
    }
}

async function handleLogout() {
    await signOut(auth);
    // O onAuthStateChanged vai cuidar da renderização da tela de login
}

function handleNavigation(e) {
    if (e.target.tagName === 'A') {
        e.preventDefault();

        // Remove a classe de 'ativo' de todos os links
        document.querySelectorAll('#nav-menu a').forEach(link => {
            link.classList.remove('bg-blue-100', 'text-blue-700');
        });
        // Adiciona a classe de 'ativo' ao link clicado
        e.target.classList.add('bg-blue-100', 'text-blue-700');

        const page = e.target.dataset.page;
        if (page === 'classes') renderClassesPage();
        if (page === 'payments') renderPaymentsPage();
    }
}

async function initializeAuthenticatedState(user) {
    state.user = user;
    state.idToken = await user.getIdToken();
    
    // Busca os dados em paralelo para agilizar
    try {
        const [profile, classes, payments] = await Promise.all([
            fetchWithAuth('/api/student/profile'),
            fetchWithAuth('/api/student/classes'),
            fetchWithAuth('/api/student/payments')
        ]);

        state.profile = profile;
        state.classes = classes;
        state.payments = payments;
        
        renderDashboard();
    } catch (error) {
        console.error("Erro ao buscar dados do aluno:", error);
        // Se a API falhar (ex: usuário não é aluno), desloga
        alert("Falha ao carregar seus dados. Verifique se você tem permissão de aluno.");
        await handleLogout();
    }
}

// --- PONTO DE ENTRADA ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeAuthenticatedState(user);
    } else {
        state.user = null;
        state.profile = null;
        state.idToken = null;
        state.classes = [];
        state.payments = [];
        renderLogin();
    }
});
