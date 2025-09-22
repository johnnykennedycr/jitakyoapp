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
                 <div class="mb-4">
                     <label class="block text-sm font-medium">Mensalidade Padrão (R$)</label>
                     <input type="number" step="0.01" name="default_monthly_fee" value="${trainingClass?.default_monthly_fee || ''}" class="p-2 border rounded-md w-full" required>
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
             <div class="mb-4">
                <label class="block text-sm font-medium">Desconto (R$)</label>
                <input type="number" step="0.01" name="discount_amount" placeholder="0.00" class="p-2 border rounded-md w-full">
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
                                <p><strong>Capacidade:</strong> ${c.capacity} Alunos</p>
                                <p><strong>Mensalidade: R$</strong> ${c.default_monthly_fee}</p>
                                <div><strong>Horários:</strong><div class="pl-2">
                                    ${(c.schedule && c.schedule.length > 0) ? c.schedule.map(s => `
                                        <div>${s.day_of_week}: ${s.start_time} - ${s.end_time}</div>`).join('') : 'Nenhum'}
                                </div></div></div>
                            <div class="mt-6 pt-4 border-t flex justify-end space-x-2">
                                 <button data-action="view-students" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Ver Alunos Matriculados">
                                     <svg class="w-5 h-5 text-gray-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                 </button>
                                 <button data-action="enroll" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Matricular Aluno">
                                     <svg class="w-5 h-5 text-green-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
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
        if (form.id === 'enroll-student-form') {
            const classId = form.dataset.classId;
            const studentId = form.elements.student_id.value;
            const discount = form.elements.discount_amount.value;
            if(!studentId) {
                showModal('Atenção', '<p>Você precisa selecionar um aluno da lista.</p>');
                return;
            };
            hideModal();
            showLoading();
            try {
                const response = await fetchWithAuth('/api/admin/enrollments', {
                    method: 'POST', body: JSON.stringify({ student_id: studentId, class_id: classId, discount_amount: discount })
                });
                if (!response.ok) throw await response.json();
            } catch (error) {
                showModal('Erro', `<p>Erro ao matricular aluno: ${error.error || 'Ocorreu uma falha.'}</p>`);
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
                schedule: schedule,
            };
            const url = classId ? `/api/admin/classes/${classId}` : '/api/admin/classes';
            const method = classId ? 'PUT' : 'POST';

            hideModal();
            showLoading();
            try {
                const response = await fetchWithAuth(url, { method, body: JSON.stringify(classData) });
                if (!response.ok) throw await response.json();
            } catch (error) {
                showModal('Erro', `<p>Erro ao salvar turma: ${error.error || 'Ocorreu uma falha.'}</p>`);
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

