import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

// --- FUNÇÕES AUXILIARES E DE FORMULÁRIO ---
function createScheduleFieldHtml(slot = { day_of_week: '', start_time: '', end_time: '' }) {
    const fieldId = `schedule-${Date.now()}-${Math.random()}`;
    return `
        <div class="dynamic-entry grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-2 border rounded" id="${fieldId}">
            <select name="day_of_week" class="p-2 border rounded-md" required>
                <option value="" ${!slot.day_of_week ? 'selected' : ''}>Selecione o Dia</option>
                <option value="Segunda" ${slot.day_of_week === 'Segunda' ? 'selected' : ''}>Segunda</option>
                <option value="Terça" ${slot.day_of_week === 'Terça' ? 'selected' : ''}>Terça</option>
                <option value="Quarta" ${slot.day_of_week === 'Quarta' ? 'selected' : ''}>Quarta</option>
                <option value="Quinta" ${slot.day_of_week === 'Quinta' ? 'selected' : ''}>Quinta</option>
                <option value="Sexta" ${slot.day_of_week === 'Sexta' ? 'selected' : ''}>Sexta</option>
                <option value="Sábado" ${slot.day_of_week === 'Sábado' ? 'selected' : ''}>Sábado</option>
            </select>
            <input type="time" name="start_time" value="${slot.start_time}" class="p-2 border rounded-md" required>
            <input type="time" name="end_time" value="${slot.end_time}" class="p-2 border rounded-md" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 self-center">Remover</button>
        </div>
    `;
}

async function openClassForm(classId = null) {
    showLoading();
    try {
        const [classRes, teachersRes] = await Promise.all([
            classId ? fetchWithAuth(`/api/admin/classes/${classId}`) : Promise.resolve(null),
            fetchWithAuth('/api/admin/teachers/')
        ]);
        const trainingClass = classRes ? await classRes.json() : null;
        const teachers = await teachersRes.json();
        const title = classId ? `Editando ${trainingClass.name}` : 'Adicionar Nova Turma';
        const scheduleHtml = (trainingClass?.schedule || []).map(createScheduleFieldHtml).join('');
        const formHtml = `
            <form id="class-form" data-class-id="${classId || ''}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label class="block text-sm font-medium">Nome da Turma</label><input type="text" name="name" value="${trainingClass?.name || ''}" class="p-2 border rounded-md w-full" required></div>
                    <div><label class="block text-sm font-medium">Modalidade</label><input type="text" name="discipline" value="${trainingClass?.discipline || ''}" class="p-2 border rounded-md w-full" required></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label class="block text-sm font-medium">Professor</label>
                        <select name="teacher_id" class="p-2 border rounded-md w-full" required>
                            <option value="">Selecione um professor</option>
                            ${teachers.map(t => `<option value="${t.id}" ${trainingClass?.teacher_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select></div>
                    <div><label class="block text-sm font-medium">Capacidade</label><input type="number" name="capacity" value="${trainingClass?.capacity || ''}" class="p-2 border rounded-md w-full" required></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label class="block text-sm font-medium">Mensalidade Padrão (R$)</label>
                        <input type="number" step="0.01" name="default_monthly_fee" value="${trainingClass?.default_monthly_fee || ''}" class="p-2 border rounded-md w-full" required>
                    </div>
                    <div><label class="block text-sm font-medium">Vencimento Padrão (Dia)</label>
                        <input type="number" name="default_due_day" value="${trainingClass?.default_due_day || 15}" min="1" max="31" class="p-2 border rounded-md w-full" required>
                    </div>
                </div>
                <hr class="my-4"><div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Horários</h4>
                    <button type="button" data-action="add-schedule" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar</button></div>
                <div id="schedule-container">${scheduleHtml}</div>
                <div class="text-right mt-6"><button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar</button></div>
            </form>
        `;
        showModal(title, formHtml);
    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados.</p>'); }
    finally { hideLoading(); }
}

async function openEnrollStudentModal(classId, className) {
    const modalBodyHtml = `
        <form id="enroll-student-form" data-class-id="${classId}">
            <div class="mb-4">
                <label class="block text-sm font-medium">Buscar Aluno por Nome</label>
                <input type="text" id="student-search-input" placeholder="Digite para buscar..." class="p-2 border rounded-md w-full">
                <div id="student-search-results" class="mt-2 border rounded-md max-h-40 overflow-y-auto"></div>
                <input type="hidden" name="student_id">
            </div>
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium">Desconto (R$)</label>
                    <input type="number" step="0.01" name="discount_amount" placeholder="0.00" class="p-2 border rounded-md w-full">
                </div>
                <div>
                    <label class="block text-sm font-medium">Dia do Vencimento</label>
                    <input type="number" name="due_day" min="1" max="31" placeholder="Padrão da turma" class="p-2 border rounded-md w-full">
                </div>
            </div>
            <div class="text-right mt-6"><button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Matricular Aluno</button></div>
        </form>
    `;
    showModal(`Matricular Aluno em ${className}`, modalBodyHtml);

    const searchInput = document.getElementById('student-search-input');
    const searchResults = document.getElementById('student-search-results');
    const studentIdInput = document.querySelector('[name="student_id"]');
    let debounceTimer;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const searchTerm = searchInput.value;
            if (searchTerm.length < 2) {
                searchResults.innerHTML = '';
                return;
            }
            const response = await fetchWithAuth(`/api/admin/students/search?name=${encodeURIComponent(searchTerm)}`);
            const students = await response.json();
            searchResults.innerHTML = students.length > 0 ?
                students.map(s => `<div class="p-2 hover:bg-gray-100 cursor-pointer" data-student-id="${s.id}" data-student-name="${s.name}">${s.name}</div>`).join('') :
                `<div class="p-2 text-gray-500">Nenhum aluno encontrado.</div>`;
        }, 300);
    });

    searchResults.addEventListener('click', (e) => {
        const target = e.target;
        if (target.dataset.studentId) {
            studentIdInput.value = target.dataset.studentId;
            searchInput.value = target.dataset.studentName;
            searchResults.innerHTML = '';
        }
    });
}

async function openEnrolledStudentsModal(classId, className) {
    showLoading();
    try {
        const response = await fetchWithAuth(`/api/admin/classes/${classId}/enrolled-students`);
        if (!response.ok) {
            throw new Error('Falha ao buscar alunos matriculados.');
        }
        const students = await response.json();
        const studentsHtml = students.length > 0
            ? `<ul class="list-disc pl-5 space-y-1">${students.map(s => `<li>${s.name}</li>`).join('')}</ul>`
            : '<p>Nenhum aluno matriculado nesta turma.</p>';
        showModal(`Alunos em ${className}`, studentsHtml);
    } catch (error) {
        console.error("Erro ao buscar alunos matriculados:", error);
        showModal('Erro', '<p>Não foi possível carregar a lista de alunos.</p>');
    } finally {
        hideLoading();
    }
}

async function handleDeleteClick(classId, className) {
    showModal(`Confirmar Exclusão`, `<p>Tem certeza que deseja deletar a turma <strong>${className}</strong>?</p>
             <div class="text-right mt-6">
                   <button data-action="cancel-delete" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button>
                   <button data-action="confirm-delete" data-class-id="${classId}" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button></div>`);
}


async function openTakeAttendanceModal(classId, className) {
    showLoading();
    try {
        const response = await fetchWithAuth(`/api/admin/classes/${classId}/enrolled-students`);
        if (!response.ok) throw new Error('Falha ao buscar alunos matriculados.');
        const students = await response.json();
        const today = new Date().toISOString().split('T')[0];

        const studentsHtml = students.length > 0
            ? students.map(s => `
                <div class="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                    <span class="text-sm font-medium text-gray-800">${s.name}</span>
                    <label class="inline-flex relative items-center cursor-pointer">
                        <input type="checkbox" value="${s.id}" name="present_students" class="sr-only peer" checked>
                        <div class="w-11 h-6 bg-red-400 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                </div>`).join('')
            : '<p class="p-4 text-sm text-gray-500">Nenhum aluno matriculado para registrar presença.</p>';

        const formHtml = `
            <form id="take-attendance-form" data-class-id="${classId}">
                <div class="mb-4">
                    <label for="attendance-date" class="block text-sm font-medium text-gray-700">Data da Chamada</label>
                    <input type="date" id="attendance-date" name="attendance_date" value="${today}" class="mt-1 block w-full p-2 border rounded-md" required>
                </div>
                <h4 class="text-lg font-medium text-gray-800 mb-2">Alunos Matriculados</h4>
                <div class="max-h-60 overflow-y-auto border rounded-md bg-white">
                    ${studentsHtml}
                </div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md" ${students.length === 0 ? 'disabled' : ''}>Salvar Chamada</button>
                </div>
            </form>
        `;
        showModal(`Chamada para ${className}`, formHtml);
    } catch (error) {
        showModal('Erro', `<p>${error.message}</p>`);
    } finally {
        hideLoading();
    }
}

async function openAttendanceHistoryModal(classId, className) {
    showLoading();
    try {
        const semestersRes = await fetchWithAuth(`/api/admin/classes/${classId}/attendance-semesters`);
        if (!semestersRes.ok) throw new Error('Falha ao buscar semestres.');
        const availableSemesters = await semestersRes.json();

        if (availableSemesters.length === 0) {
            showModal(`Histórico de ${className}`, '<p>Nenhum registro de chamada encontrado para esta turma.</p>');
            return;
        }

        const semesterOptions = availableSemesters
            .map(s => `<option value="${s.year}-${s.semester}">${s.year}/${s.semester}</option>`)
            .join('');

        const modalHtml = `
            <div class="mb-4">
                <label for="semester-filter" class="block text-sm font-medium text-gray-700">Selecionar Semestre</label>
                <select id="semester-filter" class="mt-1 block w-full p-2 border rounded-md">
                    ${semesterOptions}
                </select>
            </div>
            <div id="attendance-history-content">
                <p>Carregando dados do semestre...</p>
            </div>
        `;
        showModal(`Histórico de Presença - ${className}`, modalHtml);

        const filterElement = document.getElementById('semester-filter');
        const contentElement = document.getElementById('attendance-history-content');

        const fetchAndRenderHistory = async () => {
            contentElement.innerHTML = `<p>Buscando dados...</p>`;
            const [year, semester] = filterElement.value.split('-');
            try {
                const response = await fetchWithAuth(`/api/admin/classes/${classId}/attendance-history?year=${year}&semester=${semester}`);
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Falha ao buscar histórico de chamadas.');
                }
                const historyData = await response.json();
                
                if (!historyData.students || historyData.students.length === 0) {
                     contentElement.innerHTML = '<p>Nenhum aluno matriculado ou registro de presença encontrado para este semestre.</p>';
                     return;
                }
                
                const totalDays = historyData.total_possible_days;
                const tableHtml = `
                    <p class="text-sm text-gray-600 mb-2">Total de aulas no semestre: <strong>${totalDays}</strong></p>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aluno</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Presenças</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">%</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${historyData.students.map(student => {
                                    const percentage = student.percentage.toFixed(1);
                                    let bgColor = 'bg-red-100';
                                    if (percentage >= 75) bgColor = 'bg-green-100';
                                    else if (percentage >= 50) bgColor = 'bg-yellow-100';

                                    return `
                                    <tr class="${bgColor}">
                                        <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-center">${student.presence_count} / ${totalDays}</td>
                                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-center font-semibold">${percentage}%</td>
                                    </tr>
                                    `
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                contentElement.innerHTML = tableHtml;

            } catch (error) {
                contentElement.innerHTML = `<p class="text-red-500">${error.message}</p>`;
            }
        };

        filterElement.addEventListener('change', fetchAndRenderHistory);
        fetchAndRenderHistory();
    } catch(error) {
        showModal('Erro', `<p>${error.message}</p>`);
    } finally {
        hideLoading();
    }
}


// --- RENDERIZAÇÃO PRINCIPAL E EVENTOS ---
export async function renderClassList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-white">Gerenciamento de Turmas</h1>
            <button data-action="add" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Turma</button>
        </div>
        <div id="class-cards-container"><p>Carregando...</p></div>`;
    
    const cardsContainer = targetElement.querySelector('#class-cards-container');

    const renderCards = async () => {
        showLoading();
        try {
            const response = await fetchWithAuth('/api/admin/classes/');
            const classes = await response.json();
            if (classes.length === 0) {
                cardsContainer.innerHTML = '<p>Nenhuma turma encontrada.</p>';
                return;
            }
            cardsContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${classes.map(c => `
                        <div class="bg-white rounded-lg shadow-md p-6 flex flex-col">
                            <h3 class="text-xl font-bold text-gray-800">${c.name}</h3>
                            <p class="text-sm text-gray-500 mb-4">${c.discipline}</p>
                            <div class="space-y-2 text-sm text-gray-700 flex-grow">
                                <p><strong>Professor:</strong> ${c.teacher_name || 'N/A'}</p>
                                <p><strong>Capacidade:</strong> ${c.capacity}</p>
                                <p><strong>Mensalidade:</strong> R$ ${c.default_monthly_fee != null ? c.default_monthly_fee.toFixed(2) : 'N/A'}</p>
                                <p><strong>Venc. Padrão:</strong> Dia ${c.default_due_day || 'N/A'}</p>
                                <div><strong>Horários:</strong><div class="pl-2">
                                    ${(c.schedule && c.schedule.length > 0) ? c.schedule.map(s => `
                                        <div>${s.day_of_week}: ${s.start_time} - ${s.end_time}</div>`).join('') : 'Nenhum'}
                                </div></div></div>
                            <div class="mt-6 pt-4 border-t flex justify-end flex-wrap gap-1">
                                 <button data-action="view-students" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Ver Alunos Matriculados">
                                     <svg class="w-5 h-5 text-gray-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                 </button>
                                 <button data-action="enroll" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Matricular Aluno">
                                     <svg class="w-5 h-5 text-green-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                                 </button>
                                <button data-action="take-attendance" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Fazer Chamada">
                                    <svg class="w-5 h-5 text-blue-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM9 16l2 2 4-4"></path></svg>
                                </button>
                                <button data-action="view-attendance" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Ver Histórico de Chamadas">
                                    <svg class="w-5 h-5 text-purple-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </button>
                                <button data-action="edit" data-class-id="${c.id}" class="p-2 rounded-full hover:bg-gray-200" title="Editar Turma">
                                    <svg class="w-5 h-5 text-indigo-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                <button data-action="delete" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Deletar Turma">
                                    <svg class="w-5 h-5 text-red-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div></div>`).join('')}</div>`;
        } catch (error) {
            console.error("Erro ao buscar turmas:", error);
            cardsContainer.innerHTML = `<p class="text-red-500">Falha ao carregar as turmas.</p>`;
        } finally {
            hideLoading();
        }
    };

    const handlePageClick = (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const classId = button.dataset.classId;
        const className = button.dataset.className;
        if (action === 'add') openClassForm();
        if (action === 'enroll') openEnrollStudentModal(classId, className);
        if (action === 'view-students') openEnrolledStudentsModal(classId, className);
        if (action === 'take-attendance') openTakeAttendanceModal(classId, className);
        if (action === 'view-attendance') openAttendanceHistoryModal(classId, className);
        if (action === 'edit') openClassForm(classId);
        if (action === 'delete') handleDeleteClick(classId, className);
    };
    
    const modalBody = document.getElementById('modal-body');
    const handleModalClick = async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'add-schedule') document.getElementById('schedule-container').insertAdjacentHTML('beforeend', createScheduleFieldHtml());
        if (action === 'remove-dynamic-entry') document.getElementById(button.dataset.target)?.remove();
        if (action === 'cancel-delete') hideModal();
        if (action === 'confirm-delete') {
            const classId = button.dataset.classId;
            hideModal();
            showLoading();
            try {
                const response = await fetchWithAuth(`/api/admin/classes/${classId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Falha ao deletar');
            } catch (error) {
                showModal('Erro', '<p>Falha ao deletar turma.</p>');
            } finally {
                await renderCards();
                hideLoading();
            }
        }
    };
    
    const handleModalSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;

        if (form.id === 'take-attendance-form') {
            const classId = form.dataset.classId;
            const attendanceDate = form.elements.attendance_date.value;
            const presentStudentIds = Array.from(form.querySelectorAll('input[name="present_students"]:checked')).map(cb => cb.value);
    
			if (!attendanceDate) {
				showModal('Atenção', '<p>Por favor, selecione uma data para a chamada.</p>');
				return;
			}
    
			hideModal();
			showLoading();
			try {
				const payload = {
					class_id: classId,
					date: attendanceDate,
					present_student_ids: presentStudentIds
				};
				const response = await fetchWithAuth('/api/admin/attendance', {
					method: 'POST',
					body: JSON.stringify(payload)
				});

				if (!response.ok) {
                    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        if (errorData && errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) {
                        // Ignora o erro se o corpo não for JSON, mantém a mensagem de status.
                    }
                    throw new Error(errorMessage);
                }

			} catch (error) {
                showModal('Erro ao Salvar Chamada', `<p>${error.message}</p>`);
			} finally {
				hideLoading();
			}

        } else if (form.id === 'enroll-student-form') {
            const classId = form.dataset.classId;
            const studentId = form.elements.student_id.value;
            const discount = form.elements.discount_amount.value || '0';
            const due_day = form.elements.due_day.value || null;
            if(!studentId) {
                showModal('Atenção', '<p>Você precisa selecionar um aluno da lista.</p>');
                return;
            };
            hideModal();
            showLoading();
            try {
                const response = await fetchWithAuth('/api/admin/enrollments', {
                    method: 'POST', body: JSON.stringify({ student_id: studentId, class_id: classId, discount_amount: discount, due_day: due_day })
                });
                if (!response.ok) {
                    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        if (errorData && errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) { /* Mantém a mensagem de status */ }
                    throw new Error(errorMessage);
                }
            } catch (error) {
                showModal('Erro na Matrícula', `<p>${error.message}</p>`);
            } finally {
                hideLoading();
            }
        } else if (form.id === 'class-form') {
            const classId = form.dataset.classId;
            const schedule = Array.from(form.querySelectorAll('.dynamic-entry')).map(entry => ({
                day_of_week: entry.querySelector('[name="day_of_week"]').value,
                start_time: entry.querySelector('[name="start_time"]').value,
                end_time: entry.querySelector('[name="end_time"]').value,
            }));
            const classData = {
                name: form.elements.name.value,
                discipline: form.elements.discipline.value,
                teacher_id: form.elements.teacher_id.value,
                capacity: parseInt(form.elements.capacity.value),
                default_monthly_fee: parseFloat(form.elements.default_monthly_fee.value),
                default_due_day: parseInt(form.elements.default_due_day.value),
                schedule: schedule,
            };
            const url = classId ? `/api/admin/classes/${classId}` : '/api/admin/classes';
            const method = classId ? 'PUT' : 'POST';

            hideModal();
            showLoading();
            try {
                const response = await fetchWithAuth(url, { method, body: JSON.stringify(classData) });
                if (!response.ok) {
                    let errorMessage = `Erro ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        if (errorData && errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (e) { /* Mantém a mensagem de status */ }
                    throw new Error(errorMessage);
                }
            } catch (error) {
                showModal('Erro ao Salvar Turma', `<p>${error.message}</p>`);
            } finally {
                await renderCards();
                hideLoading();
            }
        }
    };
    
    targetElement.addEventListener('click', handlePageClick);
    modalBody.addEventListener('click', handleModalClick);
    modalBody.addEventListener('submit', handleModalSubmit);
    
    await renderCards();
    
    return () => {
        targetElement.removeEventListener('click', handlePageClick);
        modalBody.removeEventListener('click', handleModalClick);
        modalBody.removeEventListener('submit', handleModalSubmit);
    };
}

