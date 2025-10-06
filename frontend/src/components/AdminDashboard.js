import { fetchWithAuth } from "../lib/api.js";

// Função helper para debounce (evitar muitas chamadas à API enquanto o usuário digita)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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
                    <p class="text-gray-300">Aqui você pode ver um resumo das atividades da academia.</p>
                </div>

                <div id="content-notifications" class="hidden mt-6">
                    <div class="max-w-xl bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 class="text-xl font-semibold text-gray-100 mb-4">Enviar Notificação Push</h2>
                        <form id="notification-form">
                            <!-- SELEÇÃO DE DESTINATÁRIO -->
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-300 mb-2">Enviar para:</label>
                                <div class="flex space-x-4">
                                    <label class="flex items-center">
                                        <input type="radio" name="targetType" value="all" class="text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500" checked>
                                        <span class="ml-2 text-gray-300">Todos os Alunos</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="targetType" value="class" class="text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500">
                                        <span class="ml-2 text-gray-300">Turma Específica</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="targetType" value="individual" class="text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500">
                                        <span class="ml-2 text-gray-300">Aluno Específico</span>
                                    </label>
                                </div>
                            </div>

                            <!-- SELETOR DE TURMA (oculto por padrão) -->
                            <div id="class-selector-container" class="hidden mb-4">
                                <label for="class-select" class="block text-sm font-medium text-gray-300 mb-1">Selecione a Turma</label>
                                <select id="class-select" class="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option>Carregando turmas...</option>
                                </select>
                            </div>

                            <!-- SELETOR DE ALUNO (oculto por padrão) -->
                            <div id="student-selector-container" class="hidden mb-4 relative">
                                <label for="student-search" class="block text-sm font-medium text-gray-300 mb-1">Buscar Aluno</label>
                                <input type="text" id="student-search" placeholder="Digite o nome do aluno..." class="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <div id="student-search-results" class="absolute z-10 w-full bg-gray-700 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto"></div>
                                <div id="selected-student" class="mt-2 text-sm text-gray-300"></div>
                            </div>
                            
                            <!-- CAMPOS DE MENSAGEM -->
                            <div class="mb-4">
                                <label for="notification-title" class="block text-sm font-medium text-gray-300 mb-1">Título</label>
                                <input type="text" id="notification-title" name="title" required class="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="mb-6">
                                <label for="notification-body" class="block text-sm font-medium text-gray-300 mb-1">Mensagem</label>
                                <textarea id="notification-body" name="body" rows="4" required class="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                            </div>
                            
                            <div class="flex items-center justify-end">
                                <button type="submit" id="send-notification-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                                    Enviar Notificação
                                </button>
                            </div>
                        </form>
                        <div id="notification-status" class="mt-4 text-sm"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // --- LÓGICA DO COMPONENTE ---
    
    // Elementos das abas
    const tabOverview = document.getElementById('tab-overview');
    const tabNotifications = document.getElementById('tab-notifications');
    const contentOverview = document.getElementById('content-overview');
    const contentNotifications = document.getElementById('content-notifications');

    // Elementos do formulário de notificação
    const form = document.getElementById('notification-form');
    const statusDiv = document.getElementById('notification-status');
    const sendButton = document.getElementById('send-notification-btn');
    const targetTypeRadios = document.querySelectorAll('input[name="targetType"]');
    const classSelectorContainer = document.getElementById('class-selector-container');
    const studentSelectorContainer = document.getElementById('student-selector-container');
    const classSelect = document.getElementById('class-select');
    const studentSearchInput = document.getElementById('student-search');
    const studentSearchResults = document.getElementById('student-search-results');
    const selectedStudentDiv = document.getElementById('selected-student');

    let selectedStudentId = null;

    // --- FUNÇÕES ---

    // Popula o seletor de turmas
    const populateClassSelector = async () => {
        try {
            const classes = await fetchWithAuth('/api/admin/classes/');
            classSelect.innerHTML = '<option value="">Selecione uma turma</option>'; // Placeholder
            classes.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = c.name;
                classSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar turmas:", error);
            classSelect.innerHTML = '<option>Erro ao carregar turmas</option>';
        }
    };

    // Busca e exibe alunos
    const handleStudentSearch = debounce(async (event) => {
        const searchTerm = event.target.value.trim();
        studentSearchResults.innerHTML = '';
        if (searchTerm.length < 3) return;

        try {
            const students = await fetchWithAuth(`/api/admin/students/search?name=${searchTerm}`);
            if (students.length > 0) {
                students.forEach(student => {
                    const item = document.createElement('div');
                    item.className = 'p-2 hover:bg-gray-600 cursor-pointer text-white';
                    item.textContent = student.name;
                    item.dataset.id = student.id;
                    item.addEventListener('click', () => {
                        selectedStudentId = student.id;
                        selectedStudentDiv.textContent = `Aluno selecionado: ${student.name}`;
                        studentSearchResults.innerHTML = '';
                        studentSearchInput.value = '';
                    });
                    studentSearchResults.appendChild(item);
                });
            } else {
                studentSearchResults.innerHTML = '<div class="p-2 text-gray-400">Nenhum aluno encontrado.</div>';
            }
        } catch (error) {
            console.error("Erro ao buscar alunos:", error);
            studentSearchResults.innerHTML = '<div class="p-2 text-red-400">Erro ao buscar.</div>';
        }
    }, 500);

    // Envio do formulário
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        statusDiv.textContent = 'Enviando...';
        statusDiv.className = 'text-yellow-400';
        sendButton.disabled = true;

        const title = form.title.value;
        const body = form.body.value;
        const targetType = document.querySelector('input[name="targetType"]:checked').value;
        
        let payload = { title, body, target_type: targetType, target_ids: [] };

        if (targetType === 'class') {
            if (classSelect.value) {
                payload.target_ids.push(classSelect.value);
            } else {
                statusDiv.textContent = 'Erro: Por favor, selecione uma turma.';
                statusDiv.className = 'text-red-400';
                sendButton.disabled = false;
                return;
            }
        } else if (targetType === 'individual') {
            if (selectedStudentId) {
                payload.target_ids.push(selectedStudentId);
            } else {
                statusDiv.textContent = 'Erro: Por favor, selecione um aluno.';
                statusDiv.className = 'text-red-400';
                sendButton.disabled = false;
                return;
            }
        }

        try {
            const response = await fetchWithAuth('/api/admin/notifications', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            statusDiv.textContent = `Sucesso! ${response.message || 'Notificações enviadas.'}`;
            statusDiv.className = 'text-green-400';
            form.reset();
            // Reseta a UI de seleção
            classSelectorContainer.classList.add('hidden');
            studentSelectorContainer.classList.add('hidden');
            selectedStudentId = null;
            selectedStudentDiv.textContent = '';
            document.querySelector('input[name="targetType"][value="all"]').checked = true;

        } catch (error) {
            console.error("Erro ao enviar notificação:", error);
            statusDiv.textContent = `Erro: ${error.message || 'Não foi possível enviar a notificação.'}`;
            statusDiv.className = 'text-red-400';
        } finally {
            sendButton.disabled = false;
        }
    };

    // Lógica para alternar abas
    const handleTabClick = (activeTab, inactiveTab, activeContent, inactiveContent) => {
        activeTab.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-400 border-blue-400';
        inactiveTab.className = 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-400 hover:text-gray-200 hover:border-gray-500';
        activeContent.classList.remove('hidden');
        inactiveContent.classList.add('hidden');
    };
    
    // --- EVENT LISTENERS ---
    tabOverview.addEventListener('click', () => handleTabClick(tabOverview, tabNotifications, contentOverview, contentNotifications));
    tabNotifications.addEventListener('click', () => handleTabClick(tabNotifications, tabOverview, contentNotifications, contentOverview));
    form.addEventListener('submit', handleFormSubmit);
    studentSearchInput.addEventListener('input', handleStudentSearch);
    
    targetTypeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            const target = event.target.value;
            classSelectorContainer.classList.toggle('hidden', target !== 'class');
            studentSelectorContainer.classList.toggle('hidden', target !== 'individual');
        });
    });

    // --- INICIALIZAÇÃO ---
    populateClassSelector(); // Carrega as turmas ao renderizar o componente
    
    // Retorna a função de limpeza
    return () => {
        tabOverview.removeEventListener('click', () => {});
        tabNotifications.removeEventListener('click', () => {});
        form.removeEventListener('submit', handleFormSubmit);
        studentSearchInput.removeEventListener('input', handleStudentSearch);
        targetTypeRadios.forEach(radio => radio.removeEventListener('change', () => {}));
    };
}

