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
            <h1 class="text-gray-800 dark:text-gray-50 font-bold text-2xl">Dashboard</h1>
            <p class="mt-1 text-gray-600 dark:text-gray-300">Bem-vindo(a) de volta, ${user.name}!</p>

            <!-- Sistema de Abas -->
            <div class="mt-6">
                <div class="border-b border-gray-200 dark:border-gray-700">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        <button id="tab-overview" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent">
                            Visão Geral
                        </button>
                        <button id="tab-notifications" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-blue-600 border-blue-500">
                            Notificações
                        </button>
                    </nav>
                </div>

                <!-- Conteúdo das Abas -->
                <div id="content-overview" class="hidden mt-6">
                    <p class="text-gray-600 dark:text-gray-300">Aqui você pode ver um resumo das atividades da academia.</p>
                </div>

                <div id="content-notifications" class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Coluna Esquerda: Formulário de Envio -->
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Enviar Notificação Push</h2>
                        <form id="notification-form">
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enviar para:</label>
                                <div class="flex space-x-4">
                                    <label class="flex items-center"><input type="radio" name="targetType" value="all" class="text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600" checked><span class="ml-2 text-gray-700 dark:text-gray-300">Todos</span></label>
                                    <label class="flex items-center"><input type="radio" name="targetType" value="class" class="text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"><span class="ml-2 text-gray-700 dark:text-gray-300">Turma</span></label>
                                    <label class="flex items-center"><input type="radio" name="targetType" value="individual" class="text-blue-600 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"><span class="ml-2 text-gray-700 dark:text-gray-300">Aluno</span></label>
                                </div>
                            </div>
                            <div id="class-selector-container" class="hidden mb-4">
                                <label for="class-select" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selecione a Turma</label>
                                <select id="class-select" class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white"></select>
                            </div>
                            <div id="student-selector-container" class="hidden mb-4 relative">
                                <label for="student-search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar Aluno</label>
                                <input type="text" id="student-search" placeholder="Digite o nome do aluno..." class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white">
                                <div id="student-search-results" class="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto"></div>
                                <div id="selected-student" class="mt-2 text-sm text-gray-600 dark:text-gray-300"></div>
                            </div>
                            <div class="mb-4">
                                <label for="notification-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
                                <input type="text" id="notification-title" name="title" required class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white">
                            </div>
                            <div class="mb-6">
                                <label for="notification-body" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
                                <textarea id="notification-body" name="body" rows="4" required class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white"></textarea>
                            </div>
                            <div class="flex items-center justify-end">
                                <button type="submit" id="send-notification-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Enviar Notificação</button>
                            </div>
                        </form>
                        <div id="notification-status" class="mt-4 text-sm"></div>
                    </div>
                    <!-- Coluna Direita: Histórico de Envios -->
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Histórico de Envios</h2>
                        <div id="history-list" class="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            <!-- O histórico será inserido aqui -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // --- LÓGICA DO COMPONENTE ---
    
    const tabs = {
        overview: document.getElementById('tab-overview'),
        notifications: document.getElementById('tab-notifications'),
    };
    const contents = {
        overview: document.getElementById('content-overview'),
        notifications: document.getElementById('content-notifications'),
    };

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
    const historyList = document.getElementById('history-list');

    let selectedStudentId = null;

    // --- FUNÇÕES ---

    const switchTab = (activeTabKey) => {
        Object.keys(tabs).forEach(key => {
            const isActive = key === activeTabKey;
            tabs[key].className = `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${isActive ? 'text-blue-600 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-transparent'}`;
            contents[key].classList.toggle('hidden', !isActive);
        });
         if (activeTabKey === 'notifications') {
            loadNotificationHistory();
        }
    };

    const populateClassSelector = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/classes/');
            const classes = await response.json();
            classSelect.innerHTML = '<option value="">Selecione uma turma</option>';
            if (Array.isArray(classes)) {
                classes.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = c.name;
                    classSelect.appendChild(option);
                });
            } else {
                 classSelect.innerHTML = '<option>Erro: Formato de dados inválido</option>';
            }
        } catch (error) {
            console.error("Erro ao carregar turmas:", error);
            classSelect.innerHTML = '<option>Erro ao carregar turmas</option>';
        }
    };
    
    const loadNotificationHistory = async () => {
        historyList.innerHTML = '<p class="text-gray-600 dark:text-gray-300">Carregando histórico...</p>';
        try {
            const response = await fetchWithAuth('/api/admin/notifications/history');
            const history = await response.json();
            if (history && history.length > 0) {
                 historyList.innerHTML = history.map(log => {
                    let formattedDate = 'Data inválida';
                    if (log.sent_at && typeof log.sent_at._seconds === 'number') {
                        const date = new Date(log.sent_at._seconds * 1000);
                        if (!isNaN(date)) {
                            formattedDate = date.toLocaleString('pt-BR');
                        }
                    }
                    return `
                        <div class="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                            <p class="font-semibold text-gray-800 dark:text-white">${log.title}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-300">${log.body}</p>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 flex justify-between">
                                <span>Enviado em: ${formattedDate}</span>
                                <span>Sucesso: ${log.success_count} / ${log.total_recipients}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                historyList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Nenhuma notificação foi enviada ainda.</p>';
            }
        } catch (error) {
            console.error("Erro ao carregar histórico de notificações:", error);
            historyList.innerHTML = '<p class="text-red-500">Não foi possível carregar o histórico.</p>';
        }
    };


    const handleStudentSearch = debounce(async (event) => {
        const searchTerm = event.target.value.trim();
        studentSearchResults.innerHTML = '';
        if (searchTerm.length < 2) return;
        const capitalizedSearchTerm = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
        try {
            const response = await fetchWithAuth(`/api/admin/students/search?name=${capitalizedSearchTerm}`);
            const students = await response.json();
            if (students.length > 0) {
                students.forEach(student => {
                    const item = document.createElement('div');
                    item.className = 'p-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-white';
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
                studentSearchResults.innerHTML = '<div class="p-2 text-gray-500 dark:text-gray-400">Nenhum aluno encontrado.</div>';
            }
        } catch (error) {
            console.error("Erro ao buscar alunos:", error);
            studentSearchResults.innerHTML = '<div class="p-2 text-red-500">Erro ao buscar.</div>';
        }
    }, 500);

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        statusDiv.textContent = 'Enviando...';
        statusDiv.className = 'text-yellow-500';
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
                statusDiv.className = 'text-red-500';
                sendButton.disabled = false;
                return;
            }
        } else if (targetType === 'individual') {
            if (selectedStudentId) {
                payload.target_ids.push(selectedStudentId);
            } else {
                statusDiv.textContent = 'Erro: Por favor, selecione um aluno.';
                statusDiv.className = 'text-red-500';
                sendButton.disabled = false;
                return;
            }
        }

        try {
            const response = await fetchWithAuth('/api/admin/notifications', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            statusDiv.textContent = `Sucesso! ${result.message || 'Notificações enviadas.'}`;
            statusDiv.className = 'text-green-500';
            form.reset();
            classSelectorContainer.classList.add('hidden');
            studentSelectorContainer.classList.add('hidden');
            selectedStudentId = null;
            selectedStudentDiv.textContent = '';
            document.querySelector('input[name="targetType"][value="all"]').checked = true;
            // Recarrega o histórico após o envio
            loadNotificationHistory();

        } catch (error) {
            console.error("Erro ao enviar notificação:", error);
            statusDiv.textContent = `Erro: ${error.message || 'Não foi possível enviar a notificação.'}`;
            statusDiv.className = 'text-red-500';
        } finally {
            sendButton.disabled = false;
        }
    };
    
    // --- EVENT LISTENERS ---
    tabs.overview.addEventListener('click', () => switchTab('overview'));
    tabs.notifications.addEventListener('click', () => switchTab('notifications'));
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
    switchTab('notifications'); // Começa na aba de notificações
    populateClassSelector();
    
    return () => {
        tabs.overview.removeEventListener('click', () => {});
        tabs.notifications.removeEventListener('click', () => {});
        form.removeEventListener('submit', handleFormSubmit);
        studentSearchInput.removeEventListener('input', handleStudentSearch);
        targetTypeRadios.forEach(radio => radio.removeEventListener('change', () => {}));
    };
}

