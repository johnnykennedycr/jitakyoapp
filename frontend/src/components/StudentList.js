import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

// --- FUNÇÃO AUXILIAR PARA CRIAR CAMPOS DE RESPONSÁVEL ---
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

// --- LÓGICA DE ABRIR FORMULÁRIO (ADICIONAR/EDITAR) ---
async function openStudentForm(targetElement, studentId = null) {
    showLoading();
    try {
        const [studentRes, classesRes, enrollmentsRes] = await Promise.all([
            studentId ? fetchWithAuth(`/api/admin/students/${studentId}`) : Promise.resolve(null),
            fetchWithAuth('/api/admin/classes/'),
            studentId ? fetchWithAuth(`/api/admin/students/${studentId}/enrollments`) : Promise.resolve(null)
        ]);

        if (!classesRes.ok) throw new Error('Falha ao carregar lista de turmas.');
        
        const student = studentRes ? await studentRes.json() : null;
        const allClasses = await classesRes.json();
        const currentEnrollments = enrollmentsRes ? await enrollmentsRes.json() : [];
        
        const title = studentId ? `Editando ${student.name}` : 'Adicionar Novo Aluno';

        const classMap = Object.fromEntries(allClasses.map(c => [c.id, c]));
        const enrolledClassIds = new Set(currentEnrollments.map(e => e.class_id));
        const availableClassesForEnrollment = allClasses.filter(c => !enrolledClassIds.has(c.id));

        const nameAndEmailHtml = studentId ? `
            <p class="mb-2">Editando o perfil de <strong>${student.name}</strong> (${student.email}).</p>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700">Nova Senha</label>
                <input type="password" name="password" placeholder="Deixe em branco para não alterar" class="p-2 border rounded-md w-full">
            </div>` 
            : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div><label class="block text-sm font-medium text-gray-700">Nome Completo</label><input type="text" name="name" placeholder="Nome Completo do Aluno" class="p-2 border rounded-md w-full" required></div>
                <div><label class="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" placeholder="Email do Aluno" class="p-2 border rounded-md w-full" required></div>
            </div>
        `;

        const enrollmentSectionHtml = studentId ? `
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Turmas Matriculadas</h4>
            <div id="current-enrollments-container" class="space-y-2">
                ${currentEnrollments.length > 0 ? currentEnrollments.map(e => `
                    <div class="p-2 border rounded flex justify-between items-center">
                        <span>${classMap[e.class_id]?.name || 'Turma desconhecida'} (Desconto: R$ ${e.discount_amount || 0})</span>
                        <button type="button" data-action="remove-enrollment" data-enrollment-id="${e.id}" class="bg-red-500 text-white px-2 py-1 text-xs rounded">Remover</button>
                    </div>`).join('') : '<p class="text-sm text-gray-500">Nenhuma matrícula ativa.</p>'}
            </div>
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Matricular em Nova Turma</h4>
            <div class="flex gap-2 items-center">
                <select name="new_class_id" class="p-2 border rounded-md flex-grow">
                    <option value="">Selecione uma turma</option>
                    ${availableClassesForEnrollment.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
                <input type="number" step="0.01" name="new_discount_amount" placeholder="Desconto (R$)" class="p-2 border rounded-md w-32">
                <button type="button" data-action="add-enrollment" class="bg-blue-500 text-white px-3 py-2 rounded-md">Adicionar</button>
            </div>
        ` : `
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Matricular em Turmas (Opcional)</h4>
            <div id="enrollments-container" class="space-y-2">
                ${allClasses.map(c => `
                    <div class="p-2 border rounded">
                        <label class="flex items-center">
                            <input type="checkbox" name="class_enroll" value="${c.id}" data-fee="${c.default_monthly_fee}" class="mr-2">
                            <span>${c.name} (${c.discipline}) - Mensalidade Base: R$ ${c.default_monthly_fee}</span>
                        </label>
                        <div class="enrollment-details hidden mt-2 pl-6 space-y-2">
                            <input type="number" step="0.01" name="discount_amount" placeholder="Desconto (R$)" class="p-2 border rounded-md w-full">
                            <input type="text" name="discount_reason" placeholder="Motivo do Desconto" class="p-2 border rounded-md w-full">
                        </div>
                    </div>`).join('')}
            </div>
        `;
        
        const guardiansHtml = (student?.guardians || []).map(createGuardianFieldHtml).join('');
        const formHtml = `
            <form id="student-form" data-student-id="${studentId || ''}">
                ${nameAndEmailHtml}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                     <div><label class="block text-sm font-medium text-gray-700">Data de Nascimento</label><input type="date" name="date_of_birth" value="${student?.date_of_birth?.split('T')[0] || ''}" class="p-2 border rounded-md w-full"></div>
                     <div><label class="block text-sm font-medium text-gray-700">Telefone do Aluno</label><input type="text" name="phone" value="${student?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md"></div>
                </div>
                <hr class="my-4"><div class="flex justify-between items-center mb-2"><h4 class="text-lg font-medium">Responsáveis</h4><button type="button" data-action="add-guardian" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm">Adicionar</button></div>
                <div id="guardians-container">${guardiansHtml}</div>
                ${enrollmentSectionHtml}
                <div class="text-right mt-6"><button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar Dados Pessoais</button></div>
            </form>
        `;
        showModal(title, formHtml);
        
        // ... (código dos event listeners, sem alterações)
        const modalBody = document.getElementById('modal-body');
        modalBody.onclick = async (e) => {
            const button = e.target;
            const action = button.dataset.action;
            if (!action) return;

            if (action === 'add-guardian') { document.getElementById('guardians-container').insertAdjacentHTML('beforeend', createGuardianFieldHtml()); }
            if (action === 'remove-dynamic-entry') { document.getElementById(button.dataset.target)?.remove(); }
            
            if (action === 'add-enrollment' || action === 'remove-enrollment') {
                showLoading();
                try {
                    let response;
                    if (action === 'add-enrollment') {
                        const classId = modalBody.querySelector('[name="new_class_id"]').value;
                        const discount = modalBody.querySelector('[name="new_discount_amount"]').value;
                        if (!classId) { throw new Error('Por favor, selecione uma turma.'); }
                        response = await fetchWithAuth('/api/admin/enrollments', {
                            method: 'POST', body: JSON.stringify({ student_id: studentId, class_id: classId, discount_amount: discount })
                        });
                    } else { // remove-enrollment
                        const enrollmentId = button.dataset.enrollmentId;
                        response = await fetchWithAuth(`/api/admin/enrollments/${enrollmentId}`, { method: 'DELETE' });
                    }
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'A operação falhou.');
                    }
                } catch (error) {
                    alert(`Erro: ${error.message}`);
                } finally {
                    openStudentForm(targetElement, studentId);
                }
            }
        };

        modalBody.querySelectorAll('input[name="class_enroll"]').forEach(checkbox => {
            checkbox.onchange = (e) => {
                const detailsDiv = e.target.closest('.p-2').querySelector('.enrollment-details');
                detailsDiv.classList.toggle('hidden', !e.target.checked);
            };
        });
        modalBody.querySelector('#student-form').onsubmit = (e) => handleFormSubmit(e, targetElement);

    } catch (error) { 
        console.error("Erro ao abrir formulário do aluno:", error);
        showModal('Erro', '<p>Não foi possível carregar os dados do formulário.</p>'); 
    }
    finally { hideLoading(); }
}

async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    hideModal();
    showLoading();
    const form = e.target;
    
    try {
        const studentId = form.dataset.studentId;
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

        let response;
        if (studentId) { // MODO DE EDIÇÃO
            // Pega o valor da nova senha
            const newPassword = form.elements.password.value;
            if (newPassword && newPassword.trim() !== '') {
                userData.password = newPassword;
            }

            response = await fetchWithAuth(`/api/admin/students/${studentId}`, {
                method: 'PUT', body: JSON.stringify(userData)
            });
        } else { // MODO DE CRIAÇÃO
            userData.name = form.elements.name.value;
            userData.email = form.elements.email.value;

            const enrollmentsData = [];
            form.querySelectorAll('input[name="class_enroll"]:checked').forEach(checkbox => {
                const detailsDiv = checkbox.closest('.p-2');
                enrollmentsData.push({
                    class_id: checkbox.value,
                    discount_amount: detailsDiv.querySelector('[name="discount_amount"]').value || 0,
                    discount_reason: detailsDiv.querySelector('[name="discount_reason"]').value || "",
                });
            });
            
            response = await fetchWithAuth('/api/admin/students', {
                method: 'POST', body: JSON.stringify({ user_data: userData, enrollments_data: enrollmentsData })
            });
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao salvar aluno.');
        }
    } catch (error) {
        console.error("Erro ao salvar aluno:", error);
        alert(`Erro: ${error.message}`);
    } finally {
        await renderStudentList(targetElement);
        hideLoading();
    }
}

async function handleDeleteStudentClick(studentId, studentName, targetElement) {
    // ... (código existente, sem alterações)
    showModal(
        `Confirmar Exclusão`,
        `<p>Tem certeza que deseja deletar o aluno <strong>${studentName}</strong>? Esta ação é irreversível.</p>
         <div class="text-right mt-6"><button id="cancel-delete-btn" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button><button id="confirm-delete-btn" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button></div>`
    );
    document.getElementById('cancel-delete-btn').onclick = hideModal;
    document.getElementById('confirm-delete-btn').onclick = async () => {
        hideModal();
        showLoading();
        try {
            await fetchWithAuth(`/api/admin/students/${studentId}`, { method: 'DELETE' });
        } catch (error) { console.error('Erro ao deletar aluno:', error); }
        finally { await renderStudentList(targetElement); hideLoading(); }
    };
}

export async function renderStudentList(targetElement) {
    // ... (código existente, sem alterações)
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Alunos</h1>
            <button data-action="add" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Aluno</button>
        </div>
        <div id="student-table-container"><p>Carregando alunos...</p></div>
    `;

    targetElement.onclick = (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        
        const action = button.dataset.action;
        const studentId = button.dataset.studentId;
        const studentName = button.dataset.studentName;

        if (action === 'add') openStudentForm(targetElement);
        if (action === 'edit' && studentId) openStudentForm(targetElement, studentId);
        if (action === 'delete' && studentId) handleDeleteStudentClick(studentId, studentName, targetElement);
    };
    
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
                        <th class="py-3 px-4 text-left">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(student => `
                        <tr class="border-b">
                            <td class="py-3 px-4">${student.name || 'N/A'}</td>
                            <td class="py-3 px-4">${student.age !== null ? student.age : 'N/A'}</td>
                            <td class="py-3 px-4">
                                <button data-action="edit" data-student-id="${student.id}" class="text-indigo-600 hover:underline mr-4">Editar</button>
                                <button data-action="delete" data-student-id="${student.id}" data-student-name="${student.name}" class="text-red-600 hover:underline">Deletar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error("Erro ao buscar alunos:", error);
        targetElement.querySelector('#student-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os alunos.</p>`;
    } finally {
        hideLoading();
    }
}

