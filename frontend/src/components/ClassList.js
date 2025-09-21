import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

// --- FUNÇÕES AUXILIARES ---
function createScheduleSlotHtml(slot = { day_of_week: '', start_time: '', end_time: '' }) {
    const fieldId = `slot-${Date.now()}-${Math.random()}`;
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    return `
        <div class="dynamic-entry grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-2 border rounded" id="${fieldId}">
            <select name="day_of_week" class="p-2 border rounded-md" required>
                ${days.map(day => `<option value="${day}" ${slot.day_of_week === day ? 'selected' : ''}>${day}</option>`).join('')}
            </select>
            <input type="time" name="start_time" value="${slot.start_time}" class="p-2 border rounded-md" required>
            <input type="time" name="end_time" value="${slot.end_time}" class="p-2 border rounded-md" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 self-center">Remover</button>
        </div>
    `;
}

// --- LÓGICA DE MATRICULAR ALUNO EM UMA TURMA ---
async function handleEnrollStudentClick(classId, className, targetElement) {
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/students/'); // Busca todos os alunos
        const students = await response.json();

        const formHtml = `
            <form id="enroll-student-form" data-class-id="${classId}">
                <p class="mb-4">Matriculando aluno na turma <strong>${className}</strong>.</p>
                <div class="mb-4">
                    <label for="student-select" class="block text-sm font-medium text-gray-700">Selecione o Aluno</label>
                    <select id="student-select" name="student_id" class="mt-1 block w-full p-2 border rounded-md" required>
                        <option value="">-- Buscar aluno --</option>
                        ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input type="number" step="0.01" name="discount_amount" placeholder="Desconto (R$)" class="p-2 border rounded-md">
                    <input type="text" name="discount_reason" placeholder="Motivo do Desconto" class="p-2 border rounded-md">
                </div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Confirmar Matrícula</button>
                </div>
            </form>
        `;
        showModal('Matricular Aluno', formHtml);

        document.getElementById('enroll-student-form').onsubmit = async (e) => {
            e.preventDefault();
            hideModal();
            showLoading();
            const form = e.target;
            const enrollmentData = {
                student_id: form.elements.student_id.value,
                // A base_monthly_fee será definida no backend a partir da turma
                discount_amount: form.elements.discount_amount.value,
                discount_reason: form.elements.discount_reason.value,
            };
            try {
                await fetchWithAuth(`/api/admin/classes/${classId}/enroll`, {
                    method: 'POST',
                    body: JSON.stringify(enrollmentData)
                });
            } catch (error) { console.error("Erro ao matricular aluno:", error); }
            finally {
                // Apenas fecha o loading, não precisa recarregar a lista de turmas
                hideLoading();
            }
        };

    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados.</p>'); }
    finally { hideLoading(); }
}

// --- LÓGICA DE ABRIR FORMULÁRIO (ADICIONAR/EDITAR) ---
async function openClassForm(targetElement, classId = null) {
    showLoading();
    try {
        // Busca a turma (se editando) e a lista de professores disponíveis em paralelo
        const [classResponse, teachersResponse] = await Promise.all([
            classId ? fetchWithAuth(`/api/admin/classes/${classId}`) : Promise.resolve(null),
            fetchWithAuth('/api/admin/teachers/')
        ]);

        const trainingClass = classResponse ? await classResponse.json() : null;
        const teachers = await teachersResponse.json();
        
        const title = classId ? `Editando Turma: ${trainingClass.name}` : 'Adicionar Nova Turma';
        
        const scheduleHtml = (trainingClass?.schedule || []).map(createScheduleSlotHtml).join('');

        const formHtml = `
            <form id="class-form" data-class-id="${classId || ''}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label for="class-name" class="block text-sm font-medium text-gray-700">Nome da Turma</label>
                        <input id="class-name" type="text" name="name" value="${trainingClass?.name || ''}" placeholder="Ex: Judô Infantil" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                    <div>
                        <label for="class-discipline" class="block text-sm font-medium text-gray-700">Modalidade</label>
                        <input id="class-discipline" type="text" name="discipline" value="${trainingClass?.discipline || ''}" placeholder="Ex: Judô" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                </div>
                <div class="mb-4">
                    <label for="class-teacher" class="block text-sm font-medium text-gray-700">Professor Responsável</label>
                    <select id="class-teacher" name="teacher_id" class="mt-1 block w-full p-2 border rounded-md" required>
                        <option value="">Selecione um professor</option>
                        ${teachers.map(t => `<option value="${t.id}" ${trainingClass?.teacher_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label for="class-capacity" class="block text-sm font-medium text-gray-700">Capacidade (Alunos)</label>
                        <input id="class-capacity" type="number" name="capacity" value="${trainingClass?.capacity || ''}" placeholder="Ex: 20" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                    <div>
                        <label for="class-fee" class="block text-sm font-medium text-gray-700">Mensalidade (R$)</label>
                        <input id="class-fee" type="number" step="0.01" name="default_monthly_fee" value="${trainingClass?.default_monthly_fee || ''}" placeholder="Ex: 120.00" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                </div>
                 <div class="mb-4">
                    <label for="class-description" class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea id="class-description" name="description" rows="3" class="mt-1 block w-full p-2 border rounded-md">${trainingClass?.description || ''}</textarea>
                </div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Horários</h4>
                    <button type="button" data-action="add-schedule-slot" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar Horário</button>
                </div>
                <div id="schedule-container">${scheduleHtml}</div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar Turma</button>
                </div>
            </form>
        `;
        showModal(title, formHtml);
    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados.</p>'); }
    finally { hideLoading(); }
}

async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    hideModal();
    showLoading();
    const form = e.target;
    const classId = form.dataset.classId;
    const isEditing = !!classId;

    const schedule = Array.from(form.querySelectorAll('.dynamic-entry')).map(entry => ({
        day_of_week: entry.querySelector('[name="day_of_week"]').value,
        start_time: entry.querySelector('[name="start_time"]').value,
        end_time: entry.querySelector('[name="end_time"]').value,
    }));

    const classData = {
        name: form.elements.name.value,
        discipline: form.elements.discipline.value,
        teacher_id: form.elements.teacher_id.value,
        capacity: parseInt(form.elements.capacity.value, 10),
        default_monthly_fee: parseFloat(form.elements.default_monthly_fee.value),
        description: form.elements.description.value,
        schedule: schedule,
    };

    const url = isEditing ? `/api/admin/classes/${classId}` : '/api/admin/classes';
    const method = isEditing ? 'PUT' : 'POST';

    try {
        await fetchWithAuth(url, { method, body: JSON.stringify(classData) });
    } catch (error) { console.error("Erro ao salvar turma:", error); }
    finally {
        await renderClassList(targetElement);
        hideLoading();
    }
}

async function handleDeleteClassClick(classId, className, targetElement) {
    showModal(
        `Confirmar Exclusão`,
        `<p>Tem certeza que deseja deletar a turma <strong>${className}</strong>?</p>
         <div class="text-right mt-6">
            <button id="cancel-delete-btn" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button>
            <button id="confirm-delete-btn" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button>
         </div>`
    );
    document.getElementById('cancel-delete-btn').onclick = () => hideModal();
    document.getElementById('confirm-delete-btn').onclick = async () => {
        hideModal();
        showLoading();
        try {
            await fetchWithAuth(`/api/admin/classes/${classId}`, { method: 'DELETE' });
        } catch (error) { console.error('Erro ao deletar turma:', error); }
        finally {
            await renderClassList(targetElement);
            hideLoading();
        }
    };
}

export async function renderClassList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Turmas</h1>
            <button id="add-class-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Turma</button>
        </div>
        <div id="class-list-container"><p>Carregando turmas...</p></div>
    `;
    document.getElementById('add-class-btn').onclick = () => openClassForm(targetElement);

    // Listeners para os botões dinâmicos dentro do modal
    document.getElementById('modal-body').addEventListener('click', e => {
        const action = e.target.dataset.action;
        if (action === 'add-schedule-slot') document.getElementById('schedule-container').insertAdjacentHTML('beforeend', createScheduleSlotHtml());
        if (action === 'remove-dynamic-entry') document.getElementById(e.target.dataset.target)?.remove();
    });
    // Listener para o submit do formulário
    document.getElementById('modal-body').onsubmit = (e) => {
        if (e.target.id === 'class-form') handleFormSubmit(e, targetElement);
    };

    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/classes/');
        const classes = await response.json();
        const container = targetElement.querySelector('#class-list-container');
        if (classes.length === 0) { container.innerHTML = '<p>Nenhuma turma encontrada.</p>'; return; }
        
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${classes.map(c => `
                    <div class="bg-white rounded-lg shadow p-4 flex flex-col justify-between">
                        <div>
                            <h3 class="text-xl font-bold">${c.name}</h3>
                            <p class="text-gray-600">${c.discipline}</p>
                            <p class="text-sm mt-2"><strong>Capacidade:</strong> ${c.capacity} alunos</p>
                            <p class="text-sm mt-2"><strong>Mensalidade:</strong> R$${c.default_monthly_fee}</p>
                            <div class="mt-2">
                                ${c.schedule.map(s => `
                                    <p class="text-sm text-gray-800"><strong>${s.day_of_week}:</strong> ${s.start_time} - ${s.end_time}</p>
                                `).join('')}
                            </div>
                        </div>
                        <div class="mt-4 text-right">
                            <button data-action="edit" data-class-id="${c.id}" class="text-indigo-600 hover:underline mr-4">Editar</button>
                            <button data-action="delete" data-class-id="${c.id}" data-class-name="${c.name}" class="text-red-600 hover:underline">Deletar</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.addEventListener('click', (e) => {
            const button = e.target;
            if (button.dataset.action === 'enroll') handleEnrollStudentClick(button.dataset.classId, button.dataset.className, targetElement);
            if (button.dataset.action === 'edit') openClassForm(targetElement, button.dataset.classId);
            if (button.dataset.action === 'delete') handleDeleteClassClick(button.dataset.classId, button.dataset.className, targetElement);
        });
    } catch (error) {
        console.error("Erro ao buscar turmas:", error);
        targetElement.querySelector('#class-list-container').innerHTML = `<p class="text-red-500">Falha ao carregar turmas.</p>`;
    } finally {
        hideLoading();
    }
}

