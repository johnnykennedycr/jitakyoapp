import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

let allTeachers = []; // Cache para a lista de professores

// --- FUNÇÃO AUXILIAR PARA CRIAR CAMPOS DE HORÁRIO ---
function createScheduleFieldHtml(slot = { day_of_week: 'Segunda', start_time: '', end_time: '' }) {
    const fieldId = `schedule-${Date.now()}-${Math.random()}`;
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    return `
        <div class="dynamic-entry grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-2 border rounded" id="${fieldId}">
            <select name="day_of_week" class="p-2 border rounded-md">
                ${days.map(day => `<option value="${day}" ${slot.day_of_week === day ? 'selected' : ''}>${day}</option>`).join('')}
            </select>
            <input type="time" name="start_time" value="${slot.start_time}" class="p-2 border rounded-md" required>
            <input type="time" name="end_time" value="${slot.end_time}" class="p-2 border rounded-md" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 self-center">Remover</button>
        </div>
    `;
}

// --- LÓGICA DE ABRIR FORMULÁRIO (ADICIONAR/EDITAR) ---
async function openClassForm(targetElement, classId = null) {
    showLoading();
    try {
        // Busca a turma específica (se for edição) e a lista de professores
        const [trainingClass, teachersResponse] = await Promise.all([
            classId ? (await fetchWithAuth(`/api/admin/classes/${classId}`)).json() : null,
            fetchWithAuth('/api/admin/teachers/')
        ]);
        allTeachers = await teachersResponse.json();

        const title = classId ? `Editando ${trainingClass.name}` : 'Adicionar Nova Turma';
        const scheduleHtml = (trainingClass?.schedule || []).map(createScheduleFieldHtml).join('');

        const formHtml = `
            <form id="class-form" data-class-id="${classId || ''}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input type="text" name="name" placeholder="Nome da Turma" value="${trainingClass?.name || ''}" class="p-2 border rounded-md" required>
                    <input type="text" name="discipline" placeholder="Modalidade" value="${trainingClass?.discipline || ''}" class="p-2 border rounded-md" required>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input type="number" name="capacity" placeholder="Capacidade de Alunos" value="${trainingClass?.capacity || ''}" class="p-2 border rounded-md" required>
                    <input type="number" step="0.01" name="default_monthly_fee" placeholder="Mensalidade Padrão (R$)" value="${trainingClass?.default_monthly_fee || ''}" class="p-2 border rounded-md" required>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Professor</label>
                    <select name="teacher_id" class="mt-1 block w-full p-2 border rounded-md" required>
                        <option value="">Selecione um professor</option>
                        ${allTeachers.map(t => `<option value="${t.id}" ${trainingClass?.teacher_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea name="description" rows="2" class="mt-1 block w-full p-2 border rounded-md">${trainingClass?.description || ''}</textarea>
                </div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Horários da Turma</h4>
                    <button type="button" data-action="add-schedule" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar Horário</button>
                </div>
                <div id="schedule-container">${scheduleHtml}</div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar</button>
                </div>
            </form>
        `;
        showModal(title, formHtml);
    } catch (error) {
        showModal('Erro', '<p>Não foi possível carregar os dados necessários.</p>');
    } finally {
        hideLoading();
    }
}

// --- LÓGICA DE DELETAR ---
function handleDeleteClassClick(classId, className, targetElement) {
    showModal(
        'Confirmar Exclusão',
        `<p>Tem certeza que deseja deletar a turma <strong>${className}</strong>?</p>
         <div class="text-right mt-6">
            <button id="cancel-delete-btn" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button>
            <button id="confirm-delete-btn" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button>
         </div>`
    );
    document.getElementById('cancel-delete-btn').onclick = hideModal;
    document.getElementById('confirm-delete-btn').onclick = async () => {
        hideModal();
        showLoading();
        try {
            await fetchWithAuth(`/api/admin/classes/${classId}`, { method: 'DELETE' });
            await renderClassList(targetElement);
        } catch (error) {
            console.error('Erro ao deletar turma:', error);
        } finally {
            hideLoading();
        }
    };
}

// --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    hideModal();
    showLoading();
    const form = e.target;
    const classId = form.dataset.classId;

    const schedule = [];
    form.querySelectorAll('.dynamic-entry').forEach(entry => {
        schedule.push({
            day_of_week: entry.querySelector('[name="day_of_week"]').value,
            start_time: entry.querySelector('[name="start_time"]').value,
            end_time: entry.querySelector('[name="end_time"]').value,
        });
    });

    const classData = {
        name: form.elements.name.value,
        discipline: form.elements.discipline.value,
        teacher_id: form.elements.teacher_id.value,
        capacity: form.elements.capacity.value,
        description: form.elements.description.value,
        default_monthly_fee: form.elements.default_monthly_fee.value,
        schedule: schedule,
    };

    const url = classId ? `/api/admin/classes/${classId}` : '/api/admin/classes';
    const method = classId ? 'PUT' : 'POST';

    try {
        await fetchWithAuth(url, { method: method, body: JSON.stringify(classData) });
    } catch (error) {
        console.error("Erro ao salvar turma:", error);
    } finally {
        await renderClassList(targetElement);
        hideLoading();
    }
}

// --- RENDERIZAÇÃO PRINCIPAL DA PÁGINA ---
export async function renderClassList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Turmas</h1>
            <button id="add-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Adicionar Turma</button>
        </div>
        <div id="class-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <p>Carregando turmas...</p>
        </div>
    `;

    document.getElementById('add-btn').onclick = () => openClassForm(targetElement);
    document.getElementById('modal-body').onsubmit = (e) => handleFormSubmit(e, targetElement);
    document.getElementById('modal-body').addEventListener('click', (e) => {
        if (e.target.dataset.action === 'add-schedule') {
            document.getElementById('schedule-container').insertAdjacentHTML('beforeend', createScheduleFieldHtml());
        }
        if (e.target.dataset.action === 'remove-dynamic-entry') {
            document.getElementById(e.target.dataset.target)?.remove();
        }
    });

    showLoading();
    try {
        const [classesResponse, teachersResponse] = await Promise.all([
            fetchWithAuth('/api/admin/classes/'),
            fetchWithAuth('/api/admin/teachers/')
        ]);
        const classes = await classesResponse.json();
        allTeachers = await teachersResponse.json();
        const teacherMap = allTeachers.reduce((map, teacher) => {
            map[teacher.id] = teacher.name;
            return map;
        }, {});

        const cardsContainer = targetElement.querySelector('#class-cards-container');
        if (classes.length === 0) {
            cardsContainer.innerHTML = '<p>Nenhuma turma encontrada.</p>';
            return;
        }

        cardsContainer.innerHTML = classes.map(c => `
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-xl font-bold mb-2">${c.name}</h3>
                <p class="text-gray-600"><strong>Modalidade:</strong> ${c.discipline}</p>
                <p class="text-gray-600"><strong>Professor:</strong> ${teacherMap[c.teacher_id] || 'Não definido'}</p>
                <p class="text-gray-600"><strong>Capacidade:</strong> ${c.capacity} alunos</p>
                <div class="mt-4">
                    <h4 class="font-semibold">Horários:</h4>
                    ${c.schedule.length > 0 ? c.schedule.map(s => `
                        <p class="text-sm text-gray-500">${s.day_of_week}: ${s.start_time} - ${s.end_time}</p>
                    `).join('') : '<p class="text-sm text-gray-500">Nenhum horário definido.</p>'}
                </div>
                <div class="flex justify-end mt-4 gap-2">
                    <button data-action="edit" data-class-id="${c.id}" class="text-sm bg-blue-500 text-white px-3 py-1 rounded">Editar</button>
                    <button data-action="delete" data-class-id="${c.id}" data-class-name="${c.name}" class="text-sm bg-red-500 text-white px-3 py-1 rounded">Deletar</button>
                </div>
            </div>
        `).join('');

        cardsContainer.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const classId = e.target.dataset.classId;
            if (action === 'edit') openClassForm(targetElement, classId);
            if (action === 'delete') handleDeleteClassClick(classId, e.target.dataset.className, targetElement);
        });
    } catch (error) {
        console.error("Erro ao buscar turmas:", error);
        targetElement.querySelector('#class-cards-container').innerHTML = `<p class="text-red-500">Falha ao carregar as turmas.</p>`;
    } finally {
        hideLoading();
    }
}

