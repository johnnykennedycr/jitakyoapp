import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';
import { getUserProfile } from '../auth/userState.js';

function createScheduleFieldHtml(slot = { day_of_week: '', start_time: '', end_time: '' }) {
    const fieldId = `schedule-${Date.now()}-${Math.random()}`;
    return `
        <div class="dynamic-entry grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-2 border rounded" id="${fieldId}">
            <select name="day_of_week" class="p-2 border rounded-md" required>
                <option value="" ${slot.day_of_week === '' ? 'selected' : ''}>Selecione o Dia</option>
                <option value="Segunda" ${slot.day_of_week === 'Segunda' ? 'selected' : ''}>Segunda-feira</option>
                <option value="Terça" ${slot.day_of_week === 'Terça' ? 'selected' : ''}>Terça-feira</option>
                <option value="Quarta" ${slot.day_of_week === 'Quarta' ? 'selected' : ''}>Quarta-feira</option>
                <option value="Quinta" ${slot.day_of_week === 'Quinta' ? 'selected' : ''}>Quinta-feira</option>
                <option value="Sexta" ${slot.day_of_week === 'Sexta' ? 'selected' : ''}>Sexta-feira</option>
                <option value="Sábado" ${slot.day_of_week === 'Sábado' ? 'selected' : ''}>Sábado</option>
                <option value="Domingo" ${slot.day_of_week === 'Domingo' ? 'selected' : ''}>Domingo</option>
            </select>
            <input type="time" name="start_time" value="${slot.start_time}" class="p-2 border rounded-md" required>
            <input type="time" name="end_time" value="${slot.end_time}" class="p-2 border rounded-md" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 self-center">Remover</button>
        </div>
    `;
}

async function openClassForm(targetElement, classId = null) {
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

async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    const form = e.target;
    const classId = form.dataset.classId;
    hideModal();
    showLoading();
    try {
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
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(classData) });
        if (!response.ok) throw await response.json();
    } catch (error) {
        alert(`Erro ao salvar turma: ${error.error || 'Ocorreu uma falha.'}`);
    } finally {
        await renderClassList(targetElement);
        hideLoading();
    }
}

async function handleDeleteClick(classId, className, targetElement) {
    showModal(`Confirmar Exclusão`, `<p>Tem certeza que deseja deletar a turma <strong>${className}</strong>?</p>
         <div class="text-right mt-6">
            <button data-action="cancel-delete" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button>
            <button data-action="confirm-delete" data-class-id="${classId}" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button></div>`);
}

async function openEnrollStudentModal(targetElement, classId, className) {
    showLoading();
    try {
        const response = await fetchWithAuth(`/api/admin/classes/${classId}/un-enrolled-students`);
        const students = await response.json();
        
        const modalBodyHtml = students.length > 0 ? `
            <form id="enroll-student-form" data-class-id="${classId}">
                <div class="mb-4">
                    <label class="block text-sm font-medium">Selecione o Aluno</label>
                    <select name="student_id" class="p-2 border rounded-md w-full" required>
                        <option value="">Selecione um aluno</option>
                        ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                 <div class="mb-4">
                    <label class="block text-sm font-medium">Desconto (R$)</label>
                    <input type="number" step="0.01" name="discount_amount" placeholder="0.00" class="p-2 border rounded-md w-full">
                </div>
                <div class="text-right mt-6"><button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Matricular Aluno</button></div>
            </form>
        ` : `<p>Todos os alunos já estão matriculados nesta turma.</p>`;
        
        showModal(`Matricular Aluno em ${className}`, modalBodyHtml);

    } catch(error) { showModal('Erro', '<p>Não foi possível carregar os alunos.</p>'); }
    finally { hideLoading(); }
}

export async function renderClassList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Turmas</h1>
            <button data-action="add" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Turma</button>
        </div>
        <div id="table-container"><p>Carregando...</p></div>`;

    // --- GERENCIADOR DE EVENTOS CENTRAL ---
    targetElement.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const classId = button.dataset.classId;
        const className = button.dataset.className;
        if (action === 'add') openClassForm(targetElement);
        if (action === 'enroll') openEnrollStudentModal(targetElement, classId, className);
        if (action === 'edit') openClassForm(targetElement, classId);
        if (action === 'delete') handleDeleteClick(classId, className, targetElement);
    });

    document.getElementById('modal-body').addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'add-schedule') document.getElementById('schedule-container').insertAdjacentHTML('beforeend', createScheduleFieldHtml());
        if (action === 'remove-dynamic-entry') document.getElementById(button.dataset.target)?.remove();
        if (action === 'cancel-delete') hideModal();
        if (action === 'confirm-delete') {
            const classId = button.dataset.classId;
            hideModal(); showLoading();
            try { await fetchWithAuth(`/api/admin/classes/${classId}`, { method: 'DELETE' });
            } catch (error) { alert('Falha ao deletar turma.');
            } finally { await renderClassList(targetElement); hideLoading(); }
        }
    });

    document.getElementById('modal-body').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        if (form.id === 'enroll-student-form') {
            const classId = form.dataset.classId;
            const studentId = form.elements.student_id.value;
            const discount = form.elements.discount_amount.value;
            if(!studentId) return alert('Selecione um aluno.');
            hideModal(); showLoading();
            try {
                const response = await fetchWithAuth('/api/admin/enrollments', {
                    method: 'POST', body: JSON.stringify({ student_id: studentId, class_id: classId, discount_amount: discount })
                });
                if (!response.ok) throw await response.json();
            } catch (error) {
                alert(`Erro ao matricular aluno: ${error.error || 'Ocorreu uma falha.'}`);
            } finally {
                hideLoading();
            }
        } else {
            handleFormSubmit(e, targetElement);
        }
    };
    
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/classes/');
        const classes = await response.json();
        const tableContainer = targetElement.querySelector('#table-container');
        if (classes.length === 0) {
            tableContainer.innerHTML = '<p>Nenhuma turma encontrada.</p>';
            return;
        }
        tableContainer.innerHTML = `
            <div class="bg-white rounded-md shadow overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turma</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Professor</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horários</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${classes.map(c => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900">${c.name}</div>
                                    <div class="text-xs text-gray-500">${c.discipline} | Cap: ${c.capacity}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.teacher_name || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${(c.schedule || []).map(s => `<div><strong>${s.day_of_week}:</strong> ${s.start_time} - ${s.end_time}</div>`).join('')}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div class="flex items-center justify-end space-x-2">
                                        <button data-action="enroll" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Matricular Aluno">
                                            <svg class="w-5 h-5 text-green-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                                        </button>
                                        <button data-action="edit" data-class-id="${c.id}" class="p-2 rounded-full hover:bg-gray-200" title="Editar Turma">
                                            <svg class="w-5 h-5 text-indigo-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </button>
                                        <button data-action="delete" data-class-id="${c.id}" data-class-name="${c.name}" class="p-2 rounded-full hover:bg-gray-200" title="Deletar Turma">
                                            <svg class="w-5 h-5 text-red-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error("Erro ao buscar turmas:", error);
        targetElement.querySelector('#table-container').innerHTML = `<p class="text-red-500">Falha ao carregar as turmas.</p>`;
    } finally {
        hideLoading();
    }
}

