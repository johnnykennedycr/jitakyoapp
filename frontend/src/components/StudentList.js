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
        <div class="discipline-entry flex items-center gap-2 mb-2" id="${fieldId}">
            <input type="text" name="discipline_name" placeholder="Modalidade (ex: Judô)" value="${discipline.discipline_name}" class="flex-grow p-2 border rounded-md" required>
            <input type="text" name="graduation" placeholder="Graduação (ex: Faixa Preta)" value="${discipline.graduation}" class="flex-grow p-2 border rounded-md" required>
            <button type="button" data-action="remove-discipline" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600">&times;</button>
        </div>
    `;
}

// --- LÓGICA DE ABRIR FORMULÁRIO (ADICIONAR/EDITAR) ---
async function openStudentForm(targetElement, studentId = null) {
    showLoading();
    try {
        const student = studentId ? await (await fetchWithAuth(`/api/admin/students/${studentId}`)).json() : null;
        const title = studentId ? `Editando ${student.name}` : 'Adicionar Novo Aluno';
        
        const nameAndEmailHtml = studentId ? `
            <p class="mb-4">Editando o perfil de <strong>${student.name}</strong> (${student.email}).</p>` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label for="student-name" class="block text-sm font-medium text-gray-700">Nome Completo do Aluno</label>
                    <input id="student-name" type="text" name="name" placeholder="Nome do Aluno" class="mt-1 block w-full p-2 border rounded-md" required>
                </div>
                <div>
                    <label for="student-email" class="block text-sm font-medium text-gray-700">Email do Aluno</label>
                    <input id="student-email" type="email" name="email" placeholder="email@exemplo.com" class="mt-1 block w-full p-2 border rounded-md" required>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label for="student-password" class="block text-sm font-medium text-gray-700">Senha</label>
                    <input id="student-password" type="password" name="password" placeholder="Senha de acesso" class="mt-1 block w-full p-2 border rounded-md" ${studentId ? '' : 'required'}>
                </div>
                <div>
                    <label for="student-dob" class="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                    <input id="student-dob" type="date" name="date_of_birth" value="${student?.date_of_birth?.split('T')[0] || ''}" class="mt-1 block w-full p-2 border rounded-md">
                </div>
            </div>`;
        
        const guardiansHtml = (student?.guardians || []).map(createGuardianFieldHtml).join('');
        const disciplinesHtml = (student?.enrolled_disciplines || []).map(createDisciplineFieldHtml).join('');

        const formHtml = `
            <form id="student-form" data-student-id="${studentId || ''}">
                ${nameAndEmailHtml}
                <div class="mb-4">
                    <label for="student-phone" class="block text-sm font-medium text-gray-700">Telefone do Aluno</label>
                    <input id="student-phone" type="text" name="phone" value="${student?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md">
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

async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    hideModal();
    showLoading();
    const form = e.target;
    const studentId = form.dataset.studentId;
    const isEditing = !!studentId;

    const guardians = Array.from(form.querySelectorAll('.dynamic-entry')).map(entry => ({
        name: entry.querySelector('[name="guardian_name"]').value,
        kinship: entry.querySelector('[name="guardian_kinship"]').value,
        contact: entry.querySelector('[name="guardian_contact"]').value,
    }));

    const enrolled_disciplines = Array.from(form.querySelectorAll('.discipline-entry')).map(entry => ({
        discipline_name: entry.querySelector('[name="discipline_name"]').value,
        graduation: entry.querySelector('[name="graduation"]').value,
    }));

    const studentData = {
        phone: form.elements.phone.value,
        date_of_birth: form.elements.date_of_birth.value,
        guardians: guardians,
        enrolled_disciplines: enrolled_disciplines,
    };

    if (!isEditing) {
        studentData.name = form.elements.name.value;
        studentData.email = form.elements.email.value;
        studentData.password = form.elements.password.value;
    }

    const url = isEditing ? `/api/admin/students/${studentId}` : '/api/admin/students';
    const method = isEditing ? 'PUT' : 'POST';

    try {
        await fetchWithAuth(url, { method, body: JSON.stringify(studentData) });
    } catch (error) { console.error("Erro ao salvar aluno:", error); }
    finally {
        await renderStudentList(targetElement);
        hideLoading();
    }
}

async function handleDeleteStudentClick(studentId, studentName, targetElement) {
    showModal(
        `Confirmar Exclusão`,
        `<p>Tem certeza que deseja deletar o aluno <strong>${studentName}</strong>?</p>
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
            await fetchWithAuth(`/api/admin/students/${studentId}`, { method: 'DELETE' });
        } catch (error) { console.error('Erro ao deletar aluno:', error); }
        finally {
            await renderStudentList(targetElement);
            hideLoading();
        }
    };
}

export async function renderStudentList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Alunos</h1>
            <button id="add-student-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Aluno</button>
        </div>
        <div id="student-table-container"><p>Carregando alunos...</p></div>
    `;

    document.getElementById('add-student-btn').onclick = () => openStudentForm(targetElement);
    
    // Listeners para os botões dinâmicos dentro do modal
    document.getElementById('modal-body').addEventListener('click', e => {
        const action = e.target.dataset.action;
        if (action === 'add-guardian') document.getElementById('guardians-container').insertAdjacentHTML('beforeend', createGuardianFieldHtml());
        if (action === 'add-discipline') document.getElementById('disciplines-container').insertAdjacentHTML('beforeend', createDisciplineFieldHtml());
        if (action === 'remove-dynamic-entry' || action === 'remove-discipline') document.getElementById(e.target.dataset.target)?.remove();
    });

    // Listener para o submit do formulário
    document.getElementById('modal-body').onsubmit = (e) => {
        if (e.target.id === 'student-form') handleFormSubmit(e, targetElement);
    };
    
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/students/');
        const students = await response.json();
        const tableContainer = targetElement.querySelector('#student-table-container');
        if (students.length === 0) { tableContainer.innerHTML = '<p>Nenhum aluno encontrado.</p>'; return; }
        
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
                                ${ (student.enrolled_disciplines || []).map(d => `<div>${d.discipline_name} (${d.graduation})</div>`).join('') || 'Nenhuma' }
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
            if (button.dataset.action === 'edit') openStudentForm(targetElement, button.dataset.studentId);
            if (button.dataset.action === 'delete') handleDeleteStudentClick(button.dataset.studentId, button.dataset.studentName, targetElement);
        });
    } catch (error) {
        console.error("Erro ao buscar alunos:", error);
        targetElement.querySelector('#student-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar alunos.</p>`;
    } finally {
        hideLoading();
    }
}

