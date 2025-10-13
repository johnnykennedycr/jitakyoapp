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

// --- LÓGICA DE CARREGAMENTO DE SCRIPTS EXTERNOS ---
let chartJsPromise = null;
function loadChartJs() {
    if (!chartJsPromise) {
        chartJsPromise = new Promise((resolve, reject) => {
            if (window.Chart) {
                return resolve();
            }
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/chart.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Falha ao carregar a biblioteca de gráficos."));
            document.head.appendChild(script);
        });
    }
    return chartJsPromise;
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
            <h1 class="text-white font-bold text-2xl">Dashboard</h1>
            <p class="mt-1 text-gray-300">Bem-vindo(a) de volta, ${user.name}!</p>

            <!-- Sistema de Abas -->
            <div class="mt-6">
                <div class="border-b border-gray-700">
                    <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                        <button id="tab-overview" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-gray-400 hover:text-white border-transparent">
                            Visão Geral
                        </button>
                        <button id="tab-notifications" class="whitespace-nowrap py-4 px-1 border-b-2 font-semibold text-sm text-white border-blue-500">
                            Notificações
                        </button>
                    </nav>
                </div>

                <!-- Conteúdo da Aba Visão Geral -->
                <div id="content-overview" class="hidden mt-6">
                    <p class="text-gray-300">Carregando resumo da academia...</p>
                </div>

                <!-- Conteúdo da Aba Notificações -->
                <div id="content-notifications" class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Coluna Esquerda: Formulário de Envio -->
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <h2 class="text-xl font-semibold text-gray-900 mb-4">Enviar Notificação Push</h2>
                        <form id="notification-form">
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Enviar para:</label>
                                <div class="flex space-x-4">
                                    <label class="flex items-center"><input type="radio" name="targetType" value="all" class="text-blue-600 bg-gray-100 border-gray-300" checked><span class="ml-2 text-gray-700">Todos</span></label>
                                    <label class="flex items-center"><input type="radio" name="targetType" value="class" class="text-blue-600 bg-gray-100 border-gray-300"><span class="ml-2 text-gray-700">Turma</span></label>
                                    <label class="flex items-center"><input type="radio" name="targetType" value="individual" class="text-blue-600 bg-gray-100 border-gray-300"><span class="ml-2 text-gray-700">Aluno</span></label>
                                </div>
                            </div>
                            <div id="class-selector-container" class="hidden mb-4">
                                <label for="class-select" class="block text-sm font-medium text-gray-700 mb-1">Selecione a Turma</label>
                                <select id="class-select" class="w-full bg-gray-50 border border-gray-300 rounded-md py-2 px-3 text-gray-900"></select>
                            </div>
                            <div id="student-selector-container" class="hidden mb-4 relative">
                                <label for="student-search" class="block text-sm font-medium text-gray-700 mb-1">Buscar Aluno</label>
                                <input type="text" id="student-search" placeholder="Digite o nome do aluno..." class="w-full bg-gray-50 border border-gray-300 rounded-md py-2 px-3 text-gray-900">
                                <div id="student-search-results" class="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto"></div>
                                <div id="selected-student" class="mt-2 text-sm text-gray-600"></div>
                            </div>
                            <div class="mb-4">
                                <label for="notification-title" class="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                <input type="text" id="notification-title" name="title" required class="w-full bg-gray-50 border border-gray-300 rounded-md py-2 px-3 text-gray-900">
                            </div>
                            <div class="mb-6">
                                <label for="notification-body" class="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                                <textarea id="notification-body" name="body" rows="4" required class="w-full bg-gray-50 border border-gray-300 rounded-md py-2 px-3 text-gray-900"></textarea>
                            </div>
                            <div class="flex items-center justify-end">
                                <button type="submit" id="send-notification-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">Enviar Notificação</button>
                            </div>
                        </form>
                        <div id="notification-status" class="mt-4 text-sm"></div>
                    </div>
                    <!-- Coluna Direita: Histórico de Envios -->
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <h2 class="text-xl font-semibold text-gray-900 mb-4">Histórico de Envios</h2>
                        <div id="history-list" class="space-y-4 max-h-[500px] overflow-y-auto pr-2"></div>
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
    let newStudentsChartInstance = null;
    let disciplineChartInstance = null;


    // --- FUNÇÕES DE RENDERIZAÇÃO DO DASHBOARD ---

    const renderKpiCards = (kpis) => {
        document.getElementById('kpi-active-students').innerHTML = `
            <div class="bg-blue-100 p-3 rounded-full mr-4">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <div>
                <p class="text-sm font-medium text-gray-500">Alunos Ativos</p>
                <p class="text-2xl font-bold text-gray-800">${kpis.active_students}</p>
            </div>`;
        document.getElementById('kpi-monthly-revenue').innerHTML = `
            <div class="bg-green-100 p-3 rounded-full mr-4">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v-1m0-1V4m0 2.01V8m0 0h.01M12 15.99V16m0 1v.01M12 18v-1m0-1v-1m0 0h.01M12 8.01H12m0 0H11.99M12 15.99H12m0 0H11.99"></path></svg>
            </div>
            <div>
                <p class="text-sm font-medium text-gray-500">Faturamento do Mês</p>
                <p class="text-2xl font-bold text-gray-800">R$ ${kpis.monthly_revenue.toFixed(2).replace('.', ',')}</p>
            </div>`;
        document.getElementById('kpi-total-overdue').innerHTML = `
            <div class="bg-red-100 p-3 rounded-full mr-4">
                 <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
                <p class="text-sm font-medium text-gray-500">Inadimplência</p>
                <p class="text-2xl font-bold text-gray-800">R$ ${kpis.total_overdue.toFixed(2).replace('.', ',')}</p>
            </div>`;
    };

    const renderCharts = (charts) => {
        if (newStudentsChartInstance) newStudentsChartInstance.destroy();
        const newStudentsCtx = document.getElementById('newStudentsChart').getContext('2d');
        newStudentsChartInstance = new Chart(newStudentsCtx, {
            type: 'bar',
            data: {
                labels: charts.new_students.labels,
                datasets: [{
                    label: 'Novos Alunos',
                    data: charts.new_students.data,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });

        if (disciplineChartInstance) disciplineChartInstance.destroy();
        const disciplineCtx = document.getElementById('disciplineChart').getContext('2d');
        disciplineChartInstance = new Chart(disciplineCtx, {
            type: 'doughnut',
            data: {
                labels: charts.students_by_discipline.labels,
                datasets: [{
                    label: 'Alunos',
                    data: charts.students_by_discipline.data,
                    backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'],
                    borderColor: ['#fff'],
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    const renderLists = (lists, kpis) => {
        const recentPaymentsList = document.getElementById('list-recent-payments');
        if (lists.recent_payments.length > 0) {
            recentPaymentsList.innerHTML = `
                <ul class="space-y-3">
                    ${lists.recent_payments.map(p => `
                        <li class="flex justify-between items-center text-sm">
                            <div>
                                <p class="font-medium text-gray-800">${p.student_name}</p>
                                <p class="text-gray-500">${new Date(p.payment_date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <span class="font-semibold text-green-600">R$ ${p.amount.toFixed(2).replace('.', ',')}</span>
                        </li>
                    `).join('')}
                </ul>`;
        } else {
            recentPaymentsList.innerHTML = '<p class="text-sm text-gray-500">Nenhum pagamento recente.</p>';
        }

        const birthdayList = document.getElementById('list-upcoming-birthdays');
        if (kpis.upcoming_birthdays.length > 0) {
            birthdayList.innerHTML = `
                <ul class="space-y-3">
                    ${kpis.upcoming_birthdays.map(s => `
                        <li class="flex justify-between items-center text-sm">
                            <span class="font-medium text-gray-800">${s.name}</span>
                            <span class="text-gray-600 font-semibold">${s.birth_date_formatted}</span>
                        </li>
                    `).join('')}
                </ul>`;
        } else {
            birthdayList.innerHTML = '<p class="text-sm text-gray-500">Nenhum aniversariante nos próximos 7 dias.</p>';
        }
    };

    // --- NOVA FUNÇÃO PARA CONFIGURAR OS BOTÕES DE AÇÃO RÁPIDA ---
    const setupActionButtons = () => {
        document.getElementById('quick-add-student').addEventListener('click', () => {
            // Simula o clique no item de navegação "Alunos"
            document.querySelector('a[data-nav-item="Alunos"]')?.click();
        });
        document.getElementById('quick-add-teacher').addEventListener('click', () => {
            // Simula o clique no item de navegação "Professores"
            document.querySelector('a[data-nav-item="Professores"]')?.click();
        });
        document.getElementById('quick-add-payment').addEventListener('click', () => {
            // Simula o clique no item de navegação "Financeiro"
            document.querySelector('a[data-nav-item="Financeiro"]')?.click();
        });
    };

    const loadDashboardData = async () => {
        const overviewContent = document.getElementById('content-overview');
        overviewContent.innerHTML = '<p class="text-gray-300">Carregando resumo da academia...</p>';
        
        try {
            const [response, _] = await Promise.all([
                fetchWithAuth('/api/admin/dashboard-summary'),
                loadChartJs()
            ]);
            
            const summaryData = await response.json();
            console.log("Dados recebidos do dashboard:", summaryData);

            if (!summaryData || !summaryData.kpis || !summaryData.charts || !summaryData.lists) {
                throw new Error("A resposta da API para o dashboard é inválida ou está malformada.");
            }

            overviewContent.innerHTML = `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div id="kpi-active-students" class="bg-white p-6 rounded-lg shadow-md flex items-center"></div>
                    <div id="kpi-monthly-revenue" class="bg-white p-6 rounded-lg shadow-md flex items-center"></div>
                    <div id="kpi-total-overdue" class="bg-white p-6 rounded-lg shadow-md flex items-center"></div>
                    <div class="bg-white p-6 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold text-gray-700 mb-4">Ações Rápidas</h3>
                        <div class="flex flex-col space-y-2">
                           <button id="quick-add-student" class="bg-blue-500 text-white w-full text-left px-4 py-2 rounded-md hover:bg-blue-600 text-sm">Adicionar Aluno</button>
                           <button id="quick-add-teacher" class="bg-blue-500 text-white w-full text-left px-4 py-2 rounded-md hover:bg-blue-600 text-sm">Adicionar Professor</button>
                           <button id="quick-add-payment" class="bg-blue-500 text-white w-full text-left px-4 py-2 rounded-md hover:bg-blue-600 text-sm">Registrar Pagamento</button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold text-gray-700 mb-4">Novos Alunos (Últimos 6 Meses)</h3>
                        <canvas id="newStudentsChart"></canvas>
                    </div>
                     <div class="bg-white p-6 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold text-gray-700 mb-4">Próximos Aniversariantes</h3>
                        <div id="list-upcoming-birthdays" class="space-y-2"></div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div class="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold text-gray-700 mb-4">Alunos por Modalidade</h3>
                        <div class="h-64"><canvas id="disciplineChart"></canvas></div>
                    </div>
                     <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold text-gray-700 mb-4">Últimos Pagamentos Registrados</h3>
                        <div id="list-recent-payments"></div>
                    </div>
                </div>
            `;

            renderKpiCards(summaryData.kpis);
            renderCharts(summaryData.charts);
            renderLists(summaryData.lists, summaryData.kpis);
            setupActionButtons(); // <-- CHAMA A NOVA FUNÇÃO AQUI

        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
            overviewContent.innerHTML = `<p class="text-red-500 font-semibold">Não foi possível carregar os dados do dashboard: ${error.message}</p>`;
        }
    };


    // --- FUNÇÕES DA ABA DE NOTIFICAÇÃO ---

    const switchTab = (activeTabKey) => {
        Object.keys(tabs).forEach(key => {
            const isActive = key === activeTabKey;
            tabs[key].className = `whitespace-nowrap py-4 px-1 border-b-2 text-sm ${isActive ? 'font-semibold text-white border-blue-500' : 'font-medium text-gray-400 hover:text-white border-transparent'}`;
            contents[key].classList.toggle('hidden', !isActive);
        });

        if (activeTabKey === 'overview') {
            loadDashboardData();
        } else if (activeTabKey === 'notifications') {
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
            }
        } catch (error) {
            console.error("Erro ao carregar turmas:", error);
            classSelect.innerHTML = '<option>Erro ao carregar turmas</option>';
        }
    };
    
    const loadNotificationHistory = async () => {
        historyList.innerHTML = '<p class="text-gray-600">Carregando histórico...</p>';
        try {
            const response = await fetchWithAuth('/api/admin/notifications/history');
            const history = await response.json();
            if (history && history.length > 0) {
                historyList.innerHTML = history.map(log => {
                    let formattedDate = 'Data inválida';
                    if (log.sent_at) {
                        const dateInput = log.sent_at._seconds ? log.sent_at._seconds * 1000 : log.sent_at;
                        const date = new Date(dateInput);
                        if (!isNaN(date.getTime())) {
                            formattedDate = date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'});
                        }
                    }
                    return `
                        <div class="p-3 bg-gray-100 rounded-md">
                            <p class="font-semibold text-gray-800">${log.title}</p>
                            <p class="text-sm text-gray-600">${log.body}</p>
                            <div class="text-xs text-gray-500 mt-2 flex justify-between">
                                <span>Enviado em: ${formattedDate}</span>
                                <span>Sucesso: ${log.success_count} / ${log.total_recipients}</span>
                            </div>
                        </div>`;
                }).join('');
            } else {
                historyList.innerHTML = '<p class="text-gray-500">Nenhuma notificação foi enviada ainda.</p>';
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
        try {
            const response = await fetchWithAuth(`/api/admin/students/search?name=${encodeURIComponent(searchTerm)}`);
            const students = await response.json();
            if (students.length > 0) {
                students.forEach(student => {
                    const item = document.createElement('div');
                    item.className = 'p-2 hover:bg-gray-200 cursor-pointer text-gray-800';
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
                studentSearchResults.innerHTML = '<div class="p-2 text-gray-500">Nenhum aluno encontrado.</div>';
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

        const payload = {
            title: form.title.value,
            body: form.body.value,
            target_type: document.querySelector('input[name="targetType"]:checked').value,
            target_ids: []
        };

        if (payload.target_type === 'class') {
            if (!classSelect.value) {
                statusDiv.textContent = 'Erro: Por favor, selecione uma turma.';
                statusDiv.className = 'text-red-500';
                sendButton.disabled = false;
                return;
            }
            payload.target_ids.push(classSelect.value);
        } else if (payload.target_type === 'individual') {
            if (!selectedStudentId) {
                statusDiv.textContent = 'Erro: Por favor, selecione um aluno.';
                statusDiv.className = 'text-red-500';
                sendButton.disabled = false;
                return;
            }
            payload.target_ids.push(selectedStudentId);
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
    switchTab('overview'); // Começa na aba de Visão Geral
    populateClassSelector();
    
    return () => {
        // Limpeza dos event listeners
    };
}

