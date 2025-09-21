import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

// --- FUNÇÃO AUXILIAR PARA CRIAR CAMPOS DE DISCIPLINA ---
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
async function openTeacherForm(targetElement, teacherId = null) {
    showLoading();
    try {
        // Busca os dados do professor (se estiver editando) e a lista de usuários disponíveis (se estiver adicionando)
        const [teacherRes, usersRes] = await Promise.all([
            teacherId ? fetchWithAuth(`/api/admin/teachers/${teacherId}`) : Promise.resolve(null),
            !teacherId ? fetchWithAuth('/api/admin/available-users') : Promise.resolve(null)
        ]);

        const teacher = teacherRes ? await teacherRes.json() : null;
        const availableUsers = usersRes ? await usersRes.json() : [];
        const title = teacherId ? `Editando ${teacher.name}` : 'Adicionar Novo Professor';

        // Lógica para exibir a seleção de usuário (apenas no modo de criação)
        const userSelectionHtml = !teacherId ? `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700">Usuário a ser promovido</label>
                <select name="user_id" class="mt-1 block w-full p-2 border rounded-md" required>
                    <option value="">Selecione um usuário</option>
                    ${availableUsers.map(user => `<option value="${user.id}" data-name="${user.name}">${user.name} (${user.email})</option>`).join('')}
                </select>
            </div>
        ` : `<p class="mb-4 text-sm text-gray-600">Editando o perfil de <strong>${teacher.name}</strong>.</p>`;

        const disciplinesHtml = (teacher?.disciplines || []).map(createDisciplineFieldHtml).join('');

        const formHtml = `
            <form id="teacher-form" data-teacher-id="${teacherId || ''}">
                ${userSelectionHtml}
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Telefone</label>
                    <input type="text" name="phone" value="${teacher?.contact_info?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea name="description" rows="3" class="mt-1 block w-full p-2 border rounded-md">${teacher?.description || ''}</textarea>
                </div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Modalidades e Graduações</h4>
                    <button type="button" data-action="add-discipline" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600">Adicionar</button>
                </div>
                <div id="disciplines-container">${disciplinesHtml}</div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Salvar</button>
                </div>
            </form>
        `;
        showModal(title, formHtml);
    } catch (error) {
        console.error("Erro ao abrir formulário do professor:", error);
        showModal('Erro', '<p>Não foi possível carregar os dados do formulário.</p>');
    } finally {
        hideLoading();
    }
}

// --- LÓGICA DE SUBMISSÃO E DELEÇÃO ---
async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    const form = e.target;
    const teacherId = form.dataset.teacherId;

    hideModal();
    showLoading();

    const disciplines = Array.from(form.querySelectorAll('.discipline-entry')).map(entry => ({
        discipline_name: entry.querySelector('[name="discipline_name"]').value,
        graduation: entry.querySelector('[name="graduation"]').value,
    }));

    let data;
    let url;
    let method;

    if (teacherId) { // MODO EDIÇÃO
        url = `/api/admin/teachers/${teacherId}`;
        method = 'PUT';
        data = {
            contact_info: { phone: form.elements.phone.value },
            description: form.elements.description.value,
            disciplines: disciplines
        };
    } else { // MODO CRIAÇÃO
        url = '/api/admin/teachers';
        method = 'POST';
        const selectedOption = form.elements.user_id.options[form.elements.user_id.selectedIndex];
        data = {
            user_id: form.elements.user_id.value,
            name: selectedOption.dataset.name,
            contact_info: { phone: form.elements.phone.value },
            description: form.elements.description.value,
            disciplines: disciplines
        };
    }

    try {
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(data) });
        if (!response.ok) throw await response.json();
    } catch (error) {
        alert(`Erro ao salvar professor: ${error.error || error.message || 'Ocorreu uma falha.'}`);
    } finally {
        await renderTeacherList(targetElement); // Re-renderiza a lista principal
        hideLoading();
    }
}

async function handleDeleteClick(teacherId, teacherName, targetElement) {
    showModal(
        `Confirmar Exclusão`,
        `<p>Tem certeza que deseja deletar o professor <strong>${teacherName}</strong>?</p>
         <div class="text-right mt-6">
            <button data-action="cancel-delete" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2 hover:bg-gray-400">Cancelar</button>
            <button data-action="confirm-delete" data-teacher-id="${teacherId}" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Confirmar</button>
         </div>`
    );
}

// --- RENDERIZAÇÃO PRINCIPAL DA PÁGINA ---
export async function renderTeacherList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Professores</h1>
            <button data-action="add" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Adicionar Professor
            </button>
        </div>
        <div id="table-container"><p>Carregando...</p></div>
    `;

    // --- GERENCIADOR DE EVENTOS CENTRAL ---
    targetElement.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const teacherId = button.dataset.teacherId;
        const teacherName = button.dataset.teacherName;

        if (action === 'add') openTeacherForm(targetElement);
        if (action === 'edit') openTeacherForm(targetElement, teacherId);
        if (action === 'delete') handleDeleteClick(teacherId, teacherName, targetElement);
    });
    
    // Listener para o modal (botões dinâmicos e de confirmação)
    document.getElementById('modal-body').addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        
        const action = button.dataset.action;
        if (action === 'add-discipline') {
            document.getElementById('disciplines-container').insertAdjacentHTML('beforeend', createDisciplineFieldHtml());
        }
        if (action === 'remove-discipline') {
            document.getElementById(button.dataset.target)?.remove();
        }
        if (action === 'cancel-delete') {
            hideModal();
        }
        if (action === 'confirm-delete') {
            const teacherId = button.dataset.teacherId;
            hideModal();
            showLoading();
            try {
                await fetchWithAuth(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
            } catch (error) {
                alert('Falha ao deletar professor.');
            } finally {
                await renderTeacherList(targetElement);
                hideLoading();
            }
        }
    });

    // Submissão do formulário do modal
    document.getElementById('modal-body').onsubmit = (e) => handleFormSubmit(e, targetElement);
    
    // Carregamento inicial da tabela
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/teachers/');
        const teachers = await response.json();
        const tableContainer = targetElement.querySelector('#table-container');
        if (teachers.length === 0) {
            tableContainer.innerHTML = '<p>Nenhum professor encontrado.</p>';
            return;
        }
        tableContainer.innerHTML = `
            <div class="bg-white rounded-md shadow overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modalidades / Graduações</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${teachers.map(teacher => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900">${teacher.name || 'N/A'}</div>
                                    <div class="text-xs text-gray-500">${teacher.contact_info?.phone || 'N/A'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${(Array.isArray(teacher.disciplines) && teacher.disciplines.length > 0)
                                        ? teacher.disciplines.map(d => `<div><strong>${d.discipline_name}:</strong> ${d.graduation}</div>`).join('')
                                        : 'Nenhuma'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div class="flex items-center justify-end space-x-2">
                                        <button data-action="edit" data-teacher-id="${teacher.id}" class="p-2 rounded-full hover:bg-gray-200" title="Editar Professor">
                                            <svg class="w-5 h-5 text-indigo-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </button>
                                        <button data-action="delete" data-teacher-id="${teacher.id}" data-teacher-name="${teacher.name}" class="p-2 rounded-full hover:bg-gray-200" title="Deletar Professor">
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
        console.error("Erro ao buscar professores:", error);
        targetElement.querySelector('#table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os professores.</p>`;
    } finally {
        hideLoading();
    }
}

