import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "./firebase.js";

// --- STATE MANAGEMENT ---
let currentUser = null;
let idToken = null;

// --- DOM ELEMENTS ---
let authContainer = null;
let appContainer = null;
let loadingIndicator = null;
let loginForm = null;

const API_BASE_URL = 'https://jitakyoapp-217073545024.southamerica-east1.run.app'; // Use the correct URL

// --- API HELPER ---
async function fetchWithAuth(endpoint, options = {}) {
    if (!currentUser) {
        await new Promise(resolve => {
            const unsubscribe = onAuthStateChanged(auth, user => {
                if (user) {
                    currentUser = user;
                    resolve();
                }
                unsubscribe();
            });
        });
    }

    // Force refresh the token to ensure it's valid
    idToken = await currentUser.getIdToken(true);

    const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Falha ao decodificar erro da API.' }));
            throw new Error(`Erro na API [${response.status}]: ${errorData.error || response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`Erro em fetchWithAuth para ${endpoint}:`, error);
        throw error;
    }
}

// --- RENDER FUNCTIONS ---
function renderLoginScreen() {
    console.log("main.js: Chamando renderLoginScreen.");
    if (authContainer && appContainer) {
        authContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        loadingIndicator.style.display = 'none';
    } else {
        console.error("main.js: Elementos 'authContainer' ou 'appContainer' não encontrados para renderizar o login.");
    }
}

async function renderDashboard(userProfile) {
    if (authContainer && appContainer) {
        appContainer.innerHTML = `
            <div class="p-6 md:p-8">
                <header class="flex justify-between items-center mb-8">
                    <h1 class="text-2xl md:text-3xl font-bold text-gray-800">Olá, ${userProfile.name}!</h1>
                    <button id="logout-button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Sair</button>
                </header>
                <main class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <section id="classes-section" class="bg-white p-6 rounded-xl shadow-md">
                        <h2 class="text-xl font-semibold mb-4 text-gray-700">Minhas Turmas</h2>
                        <div id="classes-list" class="space-y-4">
                           <p class="text-gray-500">Carregando turmas...</p>
                        </div>
                    </section>
                    <section id="payments-section" class="bg-white p-6 rounded-xl shadow-md">
                        <h2 class="text-xl font-semibold mb-4 text-gray-700">Meu Financeiro</h2>
                        <div id="payments-list">
                            <p class="text-gray-500">Carregando histórico financeiro...</p>
                        </div>
                    </section>
                </main>
            </div>
        `;
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        loadingIndicator.style.display = 'none';

        document.getElementById('logout-button').addEventListener('click', () => signOut(auth));
        
        // Load dynamic data
        loadClasses(appContainer);
        loadPayments(appContainer);
    }
}

// --- DATA LOADING FUNCTIONS ---
async function loadClasses(container) {
    const classesList = container.querySelector('#classes-list');
    if (!classesList) return;

    try {
        const enrollments = await fetchWithAuth('/api/student/classes');
        
        if (enrollments && enrollments.length > 0) {
            // CORREÇÃO APLICADA AQUI
            // Garante que o código acede a 'class_name' e 'teacher_name', que são as
            // propriedades corretas enviadas pelo backend.
            classesList.innerHTML = enrollments.map(enrollment => {
                const className = enrollment.class_name || 'Nome da Turma Indisponível';
                const teacherName = enrollment.teacher_name || 'Professor não atribuído';

                return `
                <div class="bg-gray-50 p-4 rounded-lg shadow-sm">
                    <h3 class="font-bold text-lg text-gray-800">${className}</h3>
                    <p class="text-sm text-gray-600">Professor: ${teacherName}</p>
                </div>
                `;
            }).join('');
        } else {
            classesList.innerHTML = '<p class="text-gray-500">Você não está matriculado em nenhuma turma.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar turmas:', error);
        classesList.innerHTML = '<p class="text-red-500 font-semibold">Não foi possível carregar suas turmas.</p>';
    }
}

async function loadPayments(container) {
    const paymentsList = container.querySelector('#payments-list');
    if (!paymentsList) return;

    try {
        const payments = await fetchWithAuth('/api/student/payments');
        if (payments && payments.length > 0) {
            paymentsList.innerHTML = `
                <ul class="space-y-3">
                    ${payments.map(p => `
                        <li class="flex justify-between items-center p-3 rounded-lg ${p.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'}">
                            <div>
                                <p class="font-semibold text-gray-800">${p.description}</p>
                                <p class="text-sm text-gray-600">Vencimento: ${new Date(p.due_date).toLocaleDateString()}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-lg ${p.status === 'paid' ? 'text-green-700' : 'text-yellow-800'}">R$ ${p.amount.toFixed(2)}</p>
                                <span class="text-xs font-medium px-2 py-1 rounded-full ${p.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}">
                                    ${p.status === 'paid' ? 'Pago' : 'Pendente'}
                                </span>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `;
        } else {
            paymentsList.innerHTML = '<p class="text-gray-500">Nenhum registro financeiro encontrado.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        paymentsList.innerHTML = '<p class="text-red-500 font-semibold">Não foi possível carregar seu histórico financeiro.</p>';
    }
}

// --- AUTH STATE LOGIC ---
async function initializeAuthenticatedState(user) {
    loadingIndicator.style.display = 'flex';
    try {
        currentUser = user;
        const userProfile = await fetchWithAuth('/api/student/profile');
        renderDashboard(userProfile);
    } catch (error) {
        console.error("Erro ao buscar dados do aluno:", error);
        signOut(auth); // Desloga se não conseguir buscar o perfil
    }
}

// --- INITIALIZATION ---
function main() {
    console.log("main.js: Script carregado e executado.");
    
    document.addEventListener('DOMContentLoaded', () => {
        console.log("main.js: Evento DOMContentLoaded disparado.");
        
        // Get DOM elements after they are loaded
        authContainer = document.getElementById('auth-container');
        appContainer = document.getElementById('app-container');
        loadingIndicator = document.getElementById('loading-indicator');
        loginForm = document.getElementById('login-form');

        console.log("main.js: Elementos do DOM obtidos:", { authContainer, appContainer, loadingIndicator });

        onAuthStateChanged(auth, (user) => {
            console.log("main.js: onAuthStateChanged callback executado. Usuário:", user);
            if (user) {
                initializeAuthenticatedState(user);
            } else {
                currentUser = null;
                idToken = null;
                renderLoginScreen();
            }
        });

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = loginForm.email.value;
                const password = loginForm.password.value;
                const errorDiv = document.getElementById('login-error');
                errorDiv.textContent = '';
                
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    // O onAuthStateChanged vai lidar com a renderização
                } catch (error) {
                    console.error("Erro no login:", error);
                    errorDiv.textContent = 'Email ou senha inválidos.';
                }
            });
        }
    });
}

main();

