import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

// --- FUNÇÕES AUXILIARES PARA CAMPOS DINÂMICOS ---
function createGuardianFieldHtml(guardian = { name: '', kinship: '', contact: '' }) {
    const fieldId = `guardian-${Date.now()}-${Math.random()}`;
    return `
        <div class="dynamic-entry grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-2 border rounded" id="${fieldId}">
            <input type="text" name="guardian_name" placeholder="Nome do Responsável" value="${guardian.name}" class="p-2 border rounded-md" required>
            <input type="text" name="guardian_kinship" placeholder="Parentesco" value="${guardian.kinship}" class="p-2 border rounded-md" required>
            <input type="text" name="guardian_contact" placeholder="Contato (Telefone)" value="${guardian.contact}" class="p-2 border rounded-md" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 self-center">Remover</button>
        </div>
    `;
}

function createDisciplineFieldHtml(discipline = { discipline_name: '', graduation: '' }) {
    const fieldId = `discipline-${Date.now()}-${Math.random()}`;
    return `
        <div class="dynamic-entry flex items-center gap-2 mb-2" id="${fieldId}">
            <input type="text" name="discipline_name" placeholder="Modalidade (ex: Judô)" value="${discipline.discipline_name}" class="flex-grow p-2 border rounded-md" required>
            <input type="text" name="graduation" placeholder="Graduação (ex: Faixa Preta)" value="${discipline.graduation}" class="flex-grow p-2 border rounded-md" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600">&times;</button>
        </div>
    `;
}

// --- LÓGICA DE ABRIR FORMULÁRIO (ADICIONAR/EDITAR) ---
async function openStudentForm(targetElement, studentId = null) {
    showLoading();
    try {
        const student = studentId ? await (await fetchWithAuth(`/api/admin/students/${studentId}`)).json() : null;
        const title = studentId ? `Editando ${student.name}` : 'Adicionar Novo Aluno';
        
        const credentialsHtml = !studentId ? `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="text" name="name" placeholder="Nome Completo do Aluno" class="p-2 border rounded-md" required>
                <input type="email" name="email" placeholder="Email do Aluno" class="p-2 border rounded-md" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="password" name="password" placeholder="Senha" class="p-2 border rounded-md" required>
                <input type="date" name="date_of_birth" class="p-2 border rounded-md">
            </div>` : `<p class="mb-4">Editando o perfil de <strong>${student.name}</strong> (${student.email}).</p>
            <input type="date" name="date_of_birth" value="${student?.date_of_birth?.split('T')[0] || ''}" class="p-2 border rounded-md mb-4 w-full">`;
        
        const guardiansHtml = (student?.guardians || []).map(createGuardianFieldHtml).join('');
        const disciplinesHtml = (student?.enrolled_disciplines || []).map(createDisciplineFieldHtml).join('');

        const formHtml = `
            <form id="student-form" data-student-id="${studentId || ''}">
                ${credentialsHtml}
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Telefone do Aluno</label>
                    <input type="text" name="phone" value="${student?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Responsáveis</h4>
                    <button type="button" data-action="add-guardian" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar</button>
                </div>
                <div id="guardians-container">${guardiansHtml}</div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Modalidades e Graduações</h4>
                    <button type="button" data-action="add-discipline" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar</button>
                </div>
                <div id="disciplines-container">${disciplinesHtml}</div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar</button>
                </div>
            </form>
        `;
        showModal(title, formHtml);
    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados.</p>'); }
    finally { hideLoading(); }
}

// --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    hideModal();
    showLoading();
    const form = e.target;
    const studentId = form.dataset.studentId;

    // Coleta dinâmica dos responsáveis
    const guardians = [];
    form.querySelectorAll('#guardians-container .dynamic-entry').forEach(entry => {
        guardians.push({
            name: entry.querySelector('[name="guardian_name"]').value,
            kinship: entry.querySelector('[name="guardian_kinship"]').value,
            contact: entry.querySelector('[name="guardian_contact"]').value,
        });
    });

    // Coleta dinâmica das disciplinas
    const enrolled_disciplines = [];
    form.querySelectorAll('#disciplines-container .dynamic-entry').forEach(entry => {
        enrolled_disciplines.push({
            discipline_name: entry.querySelector('[name="discipline_name"]').value,
            graduation: entry.querySelector('[name="graduation"]').value,
        });
    });
    
    let payload = {
        phone: form.elements.phone.value,
        date_of_birth: form.elements.date_of_birth.value,
        guardians,
        enrolled_disciplines,
    };

    let url = '/api/admin/students';
    let method = 'POST';

    if (studentId) { // Se for edição
        url = `/api/admin/students/${studentId}`;
        method = 'PUT';
    } else { // Se for criação
        payload.name = form.elements.name.value;
        payload.email = form.elements.email.value;
        payload.password = form.elements.password.value;
    }

    try {
        await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
        await renderStudentList(targetElement); // Atualiza a lista
    } catch (error) {
        console.error("Erro ao salvar aluno:", error);
    } finally {
        hideLoading();
    }
}

// --- LÓGICA DE EXCLUSÃO ---
async function handleDeleteStudentClick(studentId, studentName, targetElement) {
    showModal('Confirmar Exclusão', `
        <p>Tem certeza que deseja deletar o aluno <strong>${studentName}</strong>? Esta ação é irreversível.</p>
        <div class="text-right mt-6">
            <button id="cancel-delete-btn" class="bg-gray-300 px-4 py-2 rounded-md">Cancelar</button>
            <button id="confirm-delete-btn" class="bg-red-600 text-white px-4 py-2 rounded-md ml-2">Deletar</button>
        </div>
    `);

    document.getElementById('cancel-delete-btn').onclick = hideModal;
    document.getElementById('confirm-delete-btn').onclick = async () => {
        hideModal();
        showLoading();
        try {
            await fetchWithAuth(`/api/admin/students/${studentId}`, { method: 'DELETE' });
            await renderStudentList(targetElement);
        } catch (error) {
            console.error("Erro ao deletar aluno:", error);
        } finally {
            hideLoading();
        }
    };
}


// --- RENDERIZAÇÃO PRINCIPAL DA PÁGINA ---
export async function renderStudentList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Alunos</h1>
            <button id="add-student-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Adicionar Aluno
            </button>
        </div>
        <div id="student-table-container"><p>Carregando alunos...</p></div>
    `;

    targetElement.querySelector('#add-student-btn').onclick = () => openStudentForm(targetElement);

    // Gerenciamento de eventos no modal para os botões dinâmicos
    document.getElementById('modal-body').onclick = (e) => {
        const action = e.target.dataset.action;
        if (action === 'add-guardian') {
            document.getElementById('guardians-container').insertAdjacentHTML('beforeend', createGuardianFieldHtml());
        }
        if (action === 'add-discipline') {
            document.getElementById('disciplines-container').insertAdjacentHTML('beforeend', createDisciplineFieldHtml());
        }
        if (action === 'remove-dynamic-entry') {
            document.getElementById(e.target.dataset.target)?.remove();
        }
    };
    document.getElementById('modal-body').onsubmit = (e) => handleFormSubmit(e, targetElement);
    
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/students/');
        const students = await response.json();
        const tableContainer = targetElement.querySelector('#student-table-container');
        
        if (students.length === 0) {
            tableContainer.innerHTML = '<p>Nenhum aluno encontrado.</p>';
            return;
        }

        tableContainer.innerHTML = `
            <table class="min-w-full bg-white rounded-md shadow">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-3 px-4 text-left">Nome</th>
                        <th class="py-3 px-4 text-left">Idade</th>
                        <th class="py-3 px-4 text-left">Modalidades</th>
                        <th class="py-3 px-4 text-left">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(student => `
                        <tr class="border-b">
                            <td class="py-3 px-4 align-top">${student.name || 'N/A'}</td>
                            <td class="py-3 px-4 align-top">${student.age !== null ? student.age : 'N/A'}</td>
                            <td class="py-3 px-4 align-top">
                                ${ (Array.isArray(student.enrolled_disciplines) && student.enrolled_disciplines.length > 0)
                                    ? student.enrolled_disciplines.map(d => `<div>${d.discipline_name}</div>`).join('')
                                    : 'Nenhuma' }
                            </td>
                            <td class="py-3 px-4 align-top">
                                <button data-action="edit" data-student-id="${student.id}" class="text-indigo-600 hover:underline mr-4">Editar</button>
                                <button data-action="delete" data-student-id="${student.id}" data-student-name="${student.name}" class="text-red-600 hover:underline">Deletar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        tableContainer.addEventListener('click', (e) => {
            const button = e.target;
            const action = button.dataset.action;
            const studentId = button.dataset.studentId;
            const studentName = button.dataset.studentName;
            if (action === 'edit' && studentId) openStudentForm(targetElement, studentId);
            if (action === 'delete' && studentId) handleDeleteStudentClick(studentId, studentName, targetElement);
        });
    } catch (error) {
        console.error("Erro ao buscar alunos:", error);
        targetElement.querySelector('#student-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os alunos.</p>`;
    } finally {
        hideLoading();
    }
}

