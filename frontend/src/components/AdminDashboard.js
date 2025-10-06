import { fetchWithAuth } from "../lib/api.js";

/**
 * Renderiza o dashboard do administrador com abas para Visão Geral e Notificações.
 * @param {HTMLElement} targetElement - O elemento onde o conteúdo será inserido.
 * @param {object} user - O objeto de perfil do usuário.
 * @returns {Function} Uma função de limpeza para remover os event listeners.
 */
export function renderAdminDashboard(targetElement, user) {
    if (!user) {
        targetElement.innerHTML = `<h1 class="text-red-500">Erro: Perfil de usuário não fornecido.</h1>`;
        return () => {};
    }

    targetElement.innerHTML = `
        <div class="p-4 md:p-8">
            <!-- Cabeçalho -->
            <h1 class="text-gray-50 font-bold text-2xl">Dashboard</h1>
            <p class="mt-1 text-gray-300">Bem-vindo(a) de volta, ${user.name}!</p>

            <!-- Sistema de Abas -->
            <div class="mt-6">
                <div class="border-b border-gray-700">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        <button id="tab-overview" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-400 border-blue-400">
                            Visão Geral
                        </button>
                        <button id="tab-notifications" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-400 hover:text-gray-200 hover:border-gray-500">
                            Notificações
                        </button>
                    </nav>
                </div>

                <!-- Conteúdo das Abas -->
                <div id="content-overview" class="mt-6">
                    <!-- O conteúdo original do seu dashboard pode vir aqui -->
                    <p class="text-gray-300">Aqui você pode ver um resumo das atividades da academia.</p>
                </div>

                <div id="content-notifications" class="hidden mt-6">
                    <div class="max-w-xl bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 class="text-xl font-semibold text-gray-100 mb-4">Enviar Notificação Push</h2>
                        <form id="notification-form">
                            <div class="mb-4">
                                <label for="notification-title" class="block text-sm font-medium text-gray-300 mb-1">Título</label>
                                <input type="text" id="notification-title" name="title" required 
                                       class="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            
                            <div class="mb-6">
                                <label for="notification-body" class="block text-sm font-medium text-gray-300 mb-1">Mensagem</label>
                                <textarea id="notification-body" name="body" rows="4" required 
                                          class="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                            </div>
                            
                            <div class="flex items-center justify-end">
                                <button type="submit" id="send-notification-btn"
                                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                                    Enviar para Todos os Alunos
                                </button>
                            </div>
                        </form>
                        <div id="notification-status" class="mt-4 text-sm"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Lógica para alternar entre as abas
    const tabOverview = document.getElementById('tab-overview');
    const tabNotifications = document.getElementById('tab-notifications');
    const contentOverview = document.getElementById('content-overview');
    const contentNotifications = document.getElementById('content-notifications');

    const handleTabClick = (activeTab, inactiveTab, activeContent, inactiveContent) => {
        activeTab.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-400 border-blue-400';
        inactiveTab.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-400 hover:text-gray-200 hover:border-gray-500';
        activeContent.classList.remove('hidden');
        inactiveContent.classList.add('hidden');
    };

    tabOverview.addEventListener('click', () => handleTabClick(tabOverview, tabNotifications, contentOverview, contentNotifications));
    tabNotifications.addEventListener('click', () => handleTabClick(tabNotifications, tabOverview, contentNotifications, contentOverview));

    // Lógica do formulário de notificação
    const form = document.getElementById('notification-form');
    const statusDiv = document.getElementById('notification-status');
    const sendButton = document.getElementById('send-notification-btn');

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        statusDiv.textContent = 'Enviando...';
        statusDiv.className = 'text-yellow-400';
        sendButton.disabled = true;

        const title = form.title.value;
        const body = form.body.value;

        try {
            const response = await fetchWithAuth('/api/admin/notifications', {
                method: 'POST',
                body: JSON.stringify({ title, body })
            });

            statusDiv.textContent = `Sucesso! ${response.message || 'Notificações enviadas.'}`;
            statusDiv.className = 'text-green-400';
            form.reset();

        } catch (error) {
            console.error("Erro ao enviar notificação:", error);
            statusDiv.textContent = `Erro: ${error.message || 'Não foi possível enviar a notificação.'}`;
            statusDiv.className = 'text-red-400';
        } finally {
            sendButton.disabled = false;
        }
    };

    form.addEventListener('submit', handleFormSubmit);

    // Retorna a função de limpeza
    return () => {
        tabOverview.removeEventListener('click', () => handleTabClick(tabOverview, tabNotifications, contentOverview, contentNotifications));
        tabNotifications.removeEventListener('click', () => handleTabClick(tabNotifications, tabOverview, contentNotifications, contentOverview));
        form.removeEventListener('submit', handleFormSubmit);
    };
}
