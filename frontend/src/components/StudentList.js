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
            <p>Editando o perfil de <strong>${student.name}</strong> (${student.email}).</p>` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="text" name="name" placeholder="Nome Completo do Aluno" class="p-2 border rounded-md" required>
                <input type="email" name="email" placeholder="Email do Aluno" class="p-2 border rounded-md" required>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input type="password" name="password" placeholder="Senha" class="p-2 border rounded-md" ${studentId ? '' : 'required'}>
                <input type="date" name="date_of_birth" value="${student?.date_of_birth?.split('T')[0] || ''}" class="p-2 border rounded-md">
            </div>`;
        
        const guardiansHtml = (student?.guardians || []).map(createGuardianFieldHtml).join('');
        const disciplinesHtml = (student?.enrolled_disciplines || []).map(createDisciplineFieldHtml).join('');

        const formHtml = `
            <form id="student-form" data-student-id="${studentId || ''}">
                ${nameAndEmailHtml}
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

// ... (Restante do seu StudentList.js, com as funções de submit e renderização principal) ...

