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
        // Busca o aluno (se editando) e a lista de turmas em paralelo
        const [studentResponse, classesResponse] = await Promise.all([
            studentId ? fetchWithAuth(`/api/admin/students/${studentId}`) : Promise.resolve(null),
            fetchWithAuth('/api/admin/classes/')
        ]);

        const student = studentResponse ? await studentResponse.json() : null;
        const classes = await classesResponse.json();
        
        const title = studentId ? `Editando ${student.name}` : 'Adicionar Novo Aluno';
        
        // Seção para selecionar turmas (apenas no modo de adição)
        const enrollmentSectionHtml = !studentId ? `
            <hr class="my-4">
            <h4 class="text-lg font-medium mb-2">Matricular em Turmas (Opcional)</h4>
            <div id="enrollments-container" class="space-y-2">
                ${classes.map(c => `
                    <div class="p-2 border rounded">
                        <label class="flex items-center">
                            <input type="checkbox" name="class_enroll" value="${c.id}" data-fee="${c.default_monthly_fee}" class="mr-2">
                            <span>${c.name} (${c.discipline}) - Mensalidade Base: R$ ${c.default_monthly_fee}</span>
                        </label>
                        <div class="enrollment-details hidden mt-2 pl-6 space-y-2">
                            <input type="number" step="0.01" name="discount_amount" placeholder="Desconto (R$)" class="p-2 border rounded-md w-full">
                            <input type="text" name="discount_reason" placeholder="Motivo do Desconto" class="p-2 border rounded-md w-full">
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : '';

        const formHtml = `
            <form id="student-form" data-student-id="${studentId || ''}">
                <!-- Campos de dados do aluno (nome, email, etc.) -->
                ${enrollmentSectionHtml}
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar</button>
                </div>
            </form>
        `;
        showModal(title, formHtml);

        // Adiciona lógica para mostrar/esconder detalhes da matrícula ao marcar checkbox
        document.querySelectorAll('input[name="class_enroll"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const detailsDiv = e.target.closest('.p-2').querySelector('.enrollment-details');
                detailsDiv.classList.toggle('hidden', !e.target.checked);
            });
        });

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

