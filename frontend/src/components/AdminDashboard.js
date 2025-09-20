import { auth } from '../lib/firebase.js';
import { fetchWithAuth } from '../lib/api.js';

/**
 * Renderiza o dashboard com base nos dados do usuário fornecidos.
 * @param {HTMLElement} targetElement - O elemento onde o conteúdo será inserido.
 * @param {object} user - O objeto de perfil do usuário.
 */
export function renderAdminDashboard(targetElement, user) {
    if (!user) {
        targetElement.innerHTML = `<h1 class="text-red-500">Erro: Perfil de usuário não fornecido.</h1>`;
        return;
    }

    targetElement.innerHTML = `
        <h1 class="text-3xl font-bold">Dashboard</h1>
        <p class="mt-2 text-gray-600">Bem-vindo(a) de volta, ${user.name}!</p>
    `;
    // 1. Renderiza a "casca" do dashboard imediatamente
    container.innerHTML = `
        <div class="bg-gray-800 text-white min-h-screen">
            <header class="bg-gray-900 shadow-md p-4 flex justify-between items-center">
                <h1 class="text-xl font-bold">Painel do Administrador - Bem-vindo, ${userData.name}!</h1>
                <button id="logout-button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
                    Sair
                </button>
            </header>

            <main class="container mx-auto p-6 md:p-10">
                <h2 class="text-3xl font-bold text-gray-100 mb-8">Agenda da Semana</h2>
                <div id="loading" class="text-center py-10">Carregando agenda...</div>
                <div id="calendar-container" class="bg-white rounded-xl shadow-lg overflow-x-auto hidden">
                    </div>
            </main>
        </div>
    `;

    // 2. Adiciona o evento de logout ao botão
    container.querySelector('#logout-button').addEventListener('click', () => {
        auth.signOut(); // O onAuthStateChanged no main.js irá redirecionar para a tela de login
    });

    // 3. Busca os dados da agenda da nossa API Flask
    try {
        const calendarContainer = container.querySelector('#calendar-container');
        const loadingDiv = container.querySelector('#loading');

        const response = await fetchWithAuth('/api/admin/dashboard-data');
        if (!response.ok) {
            throw new Error(`A requisição da API falhou com status ${response.status}`);
        }
        const data = await response.json();
        console.log("Dados do calendário recebidos:", data);

        // 4. Constrói o HTML do calendário dinamicamente com os dados recebidos
        let calendarHTML = `
            <div class="relative grid" style="grid-template-columns: auto repeat(${data.days_order.length}, minmax(150px, 1fr)); grid-template-rows: auto repeat(${data.time_slots.length}, minmax(60px, auto));">
                <div class="sticky top-0 left-0 z-30 bg-white border-b border-r border-gray-200"></div>
                ${data.days_order.map(day => `<div class="sticky top-0 z-20 p-2 text-center font-bold text-gray-700 bg-gray-50 border-b border-gray-200">${day}</div>`).join('')}
                ${data.time_slots.map(slot => `
                    <div class="sticky left-0 z-20 px-2 text-right text-xs font-mono text-gray-500 bg-gray-50 border-r border-b border-gray-200 flex items-center justify-end"><span>${slot}</span></div>
                    ${data.days_order.map(() => `<div class="border-r border-b border-gray-200"></div>`).join('')}
                `).join('')}
                ${data.scheduled_events.map(event => `
                    <div class="absolute p-px z-10" style="${event.style}">
                        <a href="/admin/classes/edit/${event.id}" class="block h-full bg-indigo-100 border border-indigo-300 text-indigo-800 rounded-lg p-2 overflow-hidden flex flex-col justify-center transform transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-lg hover:z-20">
                            <p class="font-bold text-sm leading-tight truncate">${event.name}</p>
                            <p class="text-xs">${event.time}</p>
                            <p class="text-xs text-indigo-600 truncate">Prof. ${event.teacher}</p>
                        </a>
                    </div>
                `).join('')}
            </div>
        `;
        
        // 5. Insere o HTML gerado no contêiner e exibe
        calendarContainer.innerHTML = calendarHTML;
        loadingDiv.classList.add('hidden');
        calendarContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        container.querySelector('#loading').textContent = 'Falha ao carregar os dados do dashboard.';
    }
}