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

// --- LÓGICA DE DELETAR (COM ATUALIZAÇÃO OTIMISTA DA UI) ---
function handleDeleteProfessorClick(teacherId, teacherName, targetElement) {
    showModal(
        `Confirmar Exclusão`,
        `<p>Tem certeza que deseja deletar o professor <strong>${teacherName}</strong>? A role do usuário será revertida para "student".</p>
         <div class="text-right mt-6">
            <button id="cancel-delete-btn" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2 hover:bg-gray-400">Cancelar</button>
            <button id="confirm-delete-btn" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Confirmar Exclusão</button>
         </div>`
    );
    
    document.getElementById('cancel-delete-btn').onclick = () => hideModal();
    document.getElementById('confirm-delete-btn').onclick = async () => {
        hideModal();

        // 1. Atualização Otimista: Remove o professor da UI imediatamente com uma animação.
        const rowToDelete = targetElement.querySelector(`button[data-teacher-id="${teacherId}"]`)?.closest('tr');
        if (rowToDelete) {
            rowToDelete.style.transition = 'opacity 0.5s ease';
            rowToDelete.style.opacity = '0';
            setTimeout(() => rowToDelete.remove(), 500);
        }

        // 2. Processo em Segundo Plano: Mostra o loading e faz a chamada real à API.
        showLoading();
        try {
            await fetchWithAuth(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
            // Se a exclusão for bem-sucedida, não precisamos fazer nada, a UI já está correta.
        } catch (error) {
            console.error('Erro ao deletar professor:', error);
            // Se der erro, renderiza a lista novamente para trazer o professor de volta.
            await renderTeacherList(targetElement);
        } finally {
            hideLoading();
        }
    };
}

// --- LÓGICA DE EDITAR ---
async function handleEditProfessorClick(teacherId, targetElement) {
    showLoading();
    try {
        const response = await fetchWithAuth(`/api/admin/teachers/${teacherId}`);
        const teacher = await response.json();
        const existingDisciplinesHtml = (teacher.disciplines || []).map(createDisciplineFieldHtml).join('');
        const formHtml = `
            <form id="edit-teacher-form" data-teacher-id="${teacherId}">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Telefone</label>
                    <input type="text" name="phone" value="${teacher.contact_info?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea name="description" rows="3" class="mt-1 block w-full p-2 border rounded-md">${teacher.description || ''}</textarea>
                </div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Modalidades e Graduações</h4>
                    <button type="button" id="add-discipline-btn" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600">Adicionar</button>
                </div>
                <div id="disciplines-container">${existingDisciplinesHtml}</div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Salvar Alterações</button>
                </div>
            </form>
        `;
        showModal(`Editando ${teacher.name}`, formHtml);
        document.getElementById('add-discipline-btn').onclick = () => {
            document.getElementById('disciplines-container').insertAdjacentHTML('beforeend', createDisciplineFieldHtml());
        };
        document.getElementById('disciplines-container').addEventListener('click', (e) => {
            if (e.target.dataset.action === 'remove-discipline') {
                document.getElementById(e.target.dataset.target)?.remove();
            }
        });
        document.getElementById('edit-teacher-form').onsubmit = (e) => handleFormSubmit(e, targetElement);
    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados do professor.</p>'); }
    finally { hideLoading(); }
}

// --- LÓGICA DE ADICIONAR ---
async function handleAddProfessorClick(targetElement) {
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/available-users');
        const availableUsers = await response.json();
        if (availableUsers.length === 0) {
            showModal('Adicionar Professor', '<p>Nenhum usuário disponível para ser promovido a professor.</p>');
            return;
        }
        const formHtml = `
            <form id="add-teacher-form">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Usuário a ser promovido</label>
                    <select name="user_id" class="mt-1 block w-full p-2 border rounded-md" required>
                        <option value="">Selecione um usuário</option>
                        ${availableUsers.map(user => `<option value="${user.id}" data-name="${user.name}">${user.name} (${user.email})</option>`).join('')}
                    </select>
                </div>
                 <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Telefone</label>
                    <input type="text" name="phone" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea name="description" rows="3" class="mt-1 block w-full p-2 border rounded-md"></textarea>
                </div>
                <hr class="my-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium">Modalidades e Graduações</h4>
                    <button type="button" id="add-discipline-btn" class="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600">Adicionar</button>
                </div>
                <div id="disciplines-container"></div>
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Salvar Professor</button>
                </div>
            </form>
        `;
        showModal('Adicionar Novo Professor', formHtml);
        document.getElementById('add-discipline-btn').onclick = () => {
             document.getElementById('disciplines-container').insertAdjacentHTML('beforeend', createDisciplineFieldHtml());
        };
        document.getElementById('disciplines-container').addEventListener('click', (e) => {
            if (e.target.dataset.action === 'remove-discipline') {
                document.getElementById(e.target.dataset.target)?.remove();
            }
        });
        document.getElementById('add-teacher-form').onsubmit = (e) => handleFormSubmit(e, targetElement);
    } catch (error) { showModal('Erro', '<p>Não foi possível carregar a lista de usuários.</p>'); }
    finally { hideLoading(); }
}

// --- LÓGICA DE SUBMISSÃO DOS FORMULÁRIOS ---
async function handleFormSubmit(e, targetElement) {
    e.preventDefault();
    hideModal();
    showLoading();
    const form = e.target;
    
    const disciplines = [];
    form.querySelectorAll('.discipline-entry').forEach(entry => {
        const disciplineName = entry.querySelector('[name="discipline_name"]').value;
        const graduation = entry.querySelector('[name="graduation"]').value;
        if(disciplineName && graduation) {
            disciplines.push({ discipline_name: disciplineName, graduation: graduation });
        }
    });

    try {
        if (form.id === 'add-teacher-form') {
            const selectedOption = form.elements.user_id.options[form.elements.user_id.selectedIndex];
            const teacherData = {
                user_id: form.elements.user_id.value,
                name: selectedOption.dataset.name,
                contact_info: { phone: form.elements.phone.value },
                description: form.elements.description.value,
                disciplines: disciplines
            };
            await fetchWithAuth('/api/admin/teachers', { method: 'POST', body: JSON.stringify(teacherData) });
        } else if (form.id === 'edit-teacher-form') {
            const teacherId = form.dataset.teacherId;
            const updatedData = {
                contact_info: { phone: form.elements.phone.value },
                description: form.elements.description.value,
                disciplines: disciplines
            };
            await fetchWithAuth(`/api/admin/teachers/${teacherId}`, { method: 'PUT', body: JSON.stringify(updatedData) });
        }
    } catch (error) {
        console.error("Erro ao salvar dados do professor:", error);
    } finally {
        await renderTeacherList(targetElement);
        hideLoading();
    }
}

// --- RENDERIZAÇÃO PRINCIPAL DA PÁGINA ---
export async function renderTeacherList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Professores</h1>
            <button id="add-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Adicionar Professor
            </button>
        </div>
        <div id="teacher-table-container"><p>Carregando professores...</p></div>
    `;

    document.getElementById('add-btn').onclick = () => handleAddProfessorClick(targetElement);
    
    showLoading();
    try {
        const response = await fetchWithAuth('/api/admin/teachers/');
        const teachers = await response.json();
        const tableContainer = targetElement.querySelector('#teacher-table-container');
        if (teachers.length === 0) {
            tableContainer.innerHTML = '<p>Nenhum professor encontrado.</p>';
            hideLoading();
            return;
        }
        tableContainer.innerHTML = `
            <table class="min-w-full bg-white rounded-md shadow">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-3 px-4 text-left">Nome</th>
                        <th class="py-3 px-4 text-left">Telefone</th>
                        <th class="py-3 px-4 text-left">Modalidades / Graduações</th>
                        <th class="py-3 px-4 text-left">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${teachers.map(teacher => `
                        <tr class="border-b">
                            <td class="py-3 px-4 align-top">${teacher.name || 'N/A'}</td>
                            <td class="py-3 px-4 align-top">${teacher.contact_info?.phone || 'N/A'}</td>
                            <td class="py-3 px-4 align-top">
                                ${ (Array.isArray(teacher.disciplines) && teacher.disciplines.length > 0)
                                    ? teacher.disciplines.map(d => `<div><strong>${d.discipline_name}:</strong> ${d.graduation}</div>`).join('')
                                    : 'Nenhuma' }
                            </td>
                            <td class="py-3 px-4 align-top">
                                <button data-action="edit" data-teacher-id="${teacher.id}" class="text-indigo-600 hover:underline mr-4">Editar</button>
                                <button data-action="delete" data-teacher-id="${teacher.id}" data-teacher-name="${teacher.name}" class="text-red-600 hover:underline">Deletar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        tableContainer.addEventListener('click', (e) => {
            const button = e.target;
            const action = button.dataset.action;
            const teacherId = button.dataset.teacherId;
            const teacherName = button.dataset.teacherName;
            
            if (action === 'edit' && teacherId) handleEditProfessorClick(teacherId, targetElement);
            if (action === 'delete' && teacherId) handleDeleteProfessorClick(teacherId, teacherName, targetElement);
        });
    } catch (error) {
        console.error("Erro ao buscar professores:", error);
        targetElement.querySelector('#teacher-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os professores.</p>`;
    } finally {
        hideLoading();
    }
}

