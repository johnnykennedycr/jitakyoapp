import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

// --- FUNÇÕES AUXILIARES ---
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

// --- LÓGICA DE ABRIR FORMULÁRIO ---
async function openStudentForm(targetElement, studentId = null) {
    showLoading();
    try {
        const [studentRes, classesRes, enrollmentsRes] = await Promise.all([
            studentId ? fetchWithAuth(`/api/admin/students/${studentId}`) : Promise.resolve(null),
            fetchWithAuth('/api/admin/classes/'),
            studentId ? fetchWithAuth(`/api/admin/students/${studentId}/enrollments`) : Promise.resolve(null)
        ]);

        const student = studentRes ? await studentRes.json() : null;
        const allClasses = await classesRes.json();
        const currentEnrollments = enrollmentsRes ? await enrollmentsRes.json() : [];
        
        const title = studentId ? `Editando ${student.name}` : 'Adicionar Novo Aluno';
        const classMap = Object.fromEntries(allClasses.map(c => [c.id, c]));
        const enrolledClassIds = new Set(currentEnrollments.map(e => e.class_id));
        const availableClasses = allClasses.filter(c => !enrolledClassIds.has(c.id));

        const nameAndEmailHtml = studentId ? `<p class="mb-2">Editando <strong>${student.name}</strong> (${student.email}).</p>` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div><label class="block text-sm font-medium text-gray-700">Nome Completo</label><input type="text" name="name" class="p-2 border rounded-md w-full" required></div>
                <div><label class="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" class="p-2 border rounded-md w-full" required></div>
            </div>`;

        const passwordFieldHtml = studentId ? `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700">Nova Senha (deixe em branco para não alterar)</label>
                <input type="password" name="password" class="p-2 border rounded-md w-full">
            </div>` : '';

        const enrollmentsHtml = studentId ? `
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Turmas Matriculadas</h4>
            <div id="current-enrollments-container" class="space-y-2">
                ${currentEnrollments.length > 0 ? currentEnrollments.map(e => `
                    <div class="p-2 border rounded flex justify-between items-center">
                        <span>${classMap[e.class_id]?.name || 'N/A'} (Desconto: R$ ${e.discount_amount || 0})</span>
                        <button type="button" data-action="remove-enrollment" data-enrollment-id="${e.id}" class="bg-red-500 text-white px-2 py-1 text-xs rounded">Remover</button>
                    </div>`).join('') : '<p class="text-sm text-gray-500">Nenhuma matrícula ativa.</p>'}
            </div>
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Matricular em Nova Turma</h4>
            <div class="flex gap-2 items-center">
                <select name="new_class_id" class="p-2 border rounded-md flex-grow"><option value="">Selecione uma turma</option>${availableClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
                <input type="number" step="0.01" name="new_discount" placeholder="Desconto (R$)" class="p-2 border rounded-md w-32">
                <button type="button" data-action="add-enrollment" data-student-id="${studentId}" class="bg-blue-500 text-white px-3 py-2 rounded-md">Adicionar</button>
            </div>` : `
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Matricular em Turmas (Opcional)</h4>
            <div class="space-y-2">
                ${allClasses.map(c => `
                    <div class="p-2 border rounded">
                        <label class="flex items-center"><input type="checkbox" name="class_enroll" value="${c.id}" data-fee="${c.default_monthly_fee}" class="mr-2">
                            <span>${c.name} - Base: R$ ${c.default_monthly_fee}</span></label>
                        <div class="enrollment-details hidden mt-2 pl-6 space-y-2">
                            <input type="number" step="0.01" name="discount_amount" placeholder="Desconto (R$)" class="p-2 border rounded-md w-full">
                            <input type="text" name="discount_reason" placeholder="Motivo do Desconto" class="p-2 border rounded-md w-full">
                        </div></div>`).join('')}</div>`;
        
        const guardiansHtml = (student?.guardians || []).map(createGuardianFieldHtml).join('');
        const formHtml = `<form id="student-form" data-student-id="${studentId || ''}">
                ${nameAndEmailHtml}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                     <div><label class="block text-sm font-medium text-gray-700">Data de Nascimento</label><input type="date" name="date_of_birth" value="${student?.date_of_birth?.split('T')[0] || ''}" class="p-2 border rounded-md w-full"></div>
                     <div><label class="block text-sm font-medium text-gray-700">Telefone</label><input type="text" name="phone" value="${student?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md"></div></div>
                ${passwordFieldHtml}
                <hr class="my-4"><div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Responsáveis</h4><button type="button" data-action="add-guardian" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar</button></div>
                <div id="guardians-container">${guardiansHtml}</div>
                ${enrollmentsHtml}
                <div class="text-right mt-6"><button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar</button></div></form>`;
        showModal(title, formHtml);
    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados.</p>'); }
    finally { hideLoading(); }
}

async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    const form = e.target;
    const studentId = form.dataset.studentId;
    hideModal();
    showLoading();
    try {
        const guardians = Array.from(form.querySelectorAll('.dynamic-entry')).map(entry => ({
            name: entry.querySelector('[name="guardian_name"]').value,
            kinship: entry.querySelector('[name="guardian_kinship"]').value,
            contact: entry.querySelector('[name="guardian_contact"]').value,
        }));
        
        const userData = {
            phone: form.elements.phone.value,
            date_of_birth: form.elements.date_of_birth.value,
            guardians: guardians,
        };
        let url = '/api/admin/students';
        let method = 'POST';

        if (studentId) {
            url = `/api/admin/students/${studentId}`;
            method = 'PUT';
            const password = form.elements.password.value;
            if (password) userData.password = password;
            const response = await fetchWithAuth(url, { method, body: JSON.stringify(userData) });
            if (!response.ok) throw await response.json();
        } else {
            userData.name = form.elements.name.value;
            userData.email = form.elements.email.value;
            const enrollmentsData = [];
            form.querySelectorAll('input[name="class_enroll"]:checked').forEach(checkbox => {
                const detailsDiv = checkbox.closest('.p-2');
                enrollmentsData.push({
                    class_id: checkbox.value,
                    base_monthly_fee: checkbox.dataset.fee,
                    discount_amount: detailsDiv.querySelector('[name="discount_amount"]').value || 0,
                    discount_reason: detailsDiv.querySelector('[name="discount_reason"]').value || "",
                });
            });
            const payload = { user_data: userData, enrollments_data: enrollmentsData };
            const response = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
            if (!response.ok) throw await response.json();
        }
    } catch (error) {
        alert(`Erro ao salvar aluno: ${error.error || 'Ocorreu uma falha.'}`);
    } finally {
        await renderStudentList(targetElement);
        hideLoading();
    }
}

async function handleDeleteClick(studentId, studentName, targetElement) {
    showModal(`Confirmar Exclusão`, `<p>Tem certeza que deseja deletar <strong>${studentName}</strong>?</p>
         <div class="text-right mt-6">
            <button data-action="cancel-delete" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button>
            <button data-action="confirm-delete" data-student-id="${studentId}" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button></div>`);
}

// --- RENDERIZAÇÃO PRINCIPAL DA PÁGINA ---
export async function renderStudentList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Alunos</h1>
            <button data-action="add" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Aluno</button>
        </div>
        <div id="table-container"><p>Carregando...</p></div>`;

    // --- GERENCIADOR DE EVENTOS DA PÁGINA ---
    const handlePageClick = (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const studentId = button.dataset.studentId;
        const studentName = button.dataset.studentName;
        if (action === 'add') openStudentForm(targetElement);
        if (action === 'edit') openStudentForm(targetElement, studentId);
        if (action === 'delete') handleDeleteClick(studentId, studentName, targetElement);
    };
    targetElement.addEventListener('click', handlePageClick);

    // --- GERENCIADOR DE EVENTOS DO MODAL ---
    const modalBody = document.getElementById('modal-body');
    const handleModalClick = async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const studentId = document.querySelector('#student-form')?.dataset.studentId;
        
        if (action === 'add-guardian') document.getElementById('guardians-container').insertAdjacentHTML('beforeend', createGuardianFieldHtml());
        if (action === 'remove-dynamic-entry') document.getElementById(button.dataset.target)?.remove();
        if (action === 'cancel-delete') hideModal();

        if (action === 'confirm-delete') {
            const studentIdToDelete = button.dataset.studentId;
            hideModal(); showLoading();
            try { await fetchWithAuth(`/api/admin/students/${studentIdToDelete}`, { method: 'DELETE' });
            } catch (error) { alert('Falha ao deletar aluno.');
            } finally { await renderStudentList(targetElement); hideLoading(); }
        }

        if (action === 'add-enrollment' || action === 'remove-enrollment') {
            e.stopPropagation(); // Impede que o evento se propague para outros listeners
            const isAdding = action === 'add-enrollment';
            const url = isAdding ? '/api/admin/enrollments' : `/api/admin/enrollments/${button.dataset.enrollmentId}`;
            const method = isAdding ? 'POST' : 'DELETE';
            const body = isAdding ? {
                student_id: studentId,
                class_id: document.querySelector('[name="new_class_id"]').value,
                discount_amount: document.querySelector('[name="new_discount"]').value
            } : null;
            if (isAdding && !body.class_id) return alert('Selecione uma turma.');
            showLoading();
            try { const response = await fetchWithAuth(url, { method, body: body ? JSON.stringify(body) : null });
                if (!response.ok) throw await response.json();
            } catch (error) { alert(`Erro: ${error.error || 'Falha na operação.'}`);
            } finally { openStudentForm(targetElement, studentId); }
        }
    };
    modalBody.addEventListener('click', handleModalClick);

    const handleModalSubmit = (e) => handleFormSubmit(e, targetElement);
    modalBody.addEventListener('submit', handleModalSubmit);
    
    // Carregamento inicial da tabela
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/students/');
        const students = await response.json();
        const tableContainer = targetElement.querySelector('#table-container');
        if (students.length === 0) {
            tableContainer.innerHTML = '<p>Nenhum aluno encontrado.</p>';
            return;
        }
        tableContainer.innerHTML = `
            <div class="bg-white rounded-md shadow overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turmas Matriculadas</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsáveis</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${students.map(student => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900">${student.name || 'N/A'}</div>
                                    <div class="text-xs text-gray-500">Idade: ${student.age !== null ? student.age : 'N/A'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${(student.enrollments && student.enrollments.length > 0) ? student.enrollments.map(e => `<div>${e.class_name}</div>`).join('') : 'Nenhuma'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                     ${(student.guardians && student.guardians.length > 0) ? student.guardians.map(g => `<div><strong>${g.name}</strong> (${g.kinship}): ${g.contact}</div>`).join('') : 'Nenhum'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div class="flex items-center justify-end space-x-2">
                                        <button data-action="edit" data-student-id="${student.id}" class="p-2 rounded-full hover:bg-gray-200" title="Editar Aluno">
                                            <svg class="w-5 h-5 text-indigo-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </button>
                                        <button data-action="delete" data-student-id="${student.id}" data-student-name="${student.name}" class="p-2 rounded-full hover:bg-gray-200" title="Deletar Aluno">
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
        console.error("Erro ao buscar alunos:", error);
        targetElement.querySelector('#table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os alunos.</p>`;
    } finally {
        hideLoading();
    }

    // A função de limpeza que remove os listeners específicos desta página
    return () => {
        targetElement.removeEventListener('click', handlePageClick);
        modalBody.removeEventListener('click', handleModalClick);
        modalBody.removeEventListener('submit', handleModalSubmit);
    };
}

