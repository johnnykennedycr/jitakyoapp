import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';

// --- FUNÇÃO AUXILIAR PARA CRIAR CAMPOS DE DISCIPLINA ---
function createDisciplineFieldHtml(discipline = { discipline_name: '', graduation: '' }) {
    // Cria um ID único para cada par de campos para o 'remover' funcionar
    const fieldId = `discipline-${Date.now()}-${Math.random()}`;
    return `
        <div class="discipline-entry flex items-center gap-2 mb-2" id="${fieldId}">
            <input type="text" name="discipline_name" placeholder="Modalidade (ex: Judô)" value="${discipline.discipline_name}" class="flex-grow p-2 border rounded-md" required>
            <input type="text" name="graduation" placeholder="Graduação (ex: Faixa Preta)" value="${discipline.graduation}" class="flex-grow p-2 border rounded-md" required>
            <button type="button" data-action="remove-discipline" data-target="${fieldId}" class="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600">&times;</button>
        </div>
    `;
}

// --- LÓGICA DE EDITAR (AGORA COM DISCIPLINAS) ---
async function handleEditProfessorClick(teacherId, targetElement) {
    showModal('Editar Professor', '<p>Carregando dados...</p>');
    try {
        const response = await fetchWithAuth(`/api/admin/teachers/${teacherId}`);
        const teacher = await response.json();

        // Gera os campos para as disciplinas existentes
        const existingDisciplinesHtml = teacher.disciplines.map(createDisciplineFieldHtml).join('');

        const formHtml = `
            <form id="edit-teacher-form">
                <p class="mb-4 text-sm text-gray-600">Editando o perfil de <strong>${teacher.name}</strong>.</p>
                <div class="mb-4">
                    <label for="contact-phone" class="block text-sm font-medium text-gray-700">Telefone</label>
                    <input type="text" id="contact-phone" name="phone" value="${teacher.contact_info?.phone || ''}" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="mb-4">
                    <label for="description" class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea id="description" name="description" rows="3" class="mt-1 block w-full p-2 border rounded-md">${teacher.description || ''}</textarea>
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
        showModal('Editar Professor', formHtml);
        
        // Listener para o botão 'Adicionar Modalidade'
        document.getElementById('add-discipline-btn').addEventListener('click', () => {
            document.getElementById('disciplines-container').insertAdjacentHTML('beforeend', createDisciplineFieldHtml());
        });

        // Listener para submeter o formulário de edição
        document.getElementById('edit-teacher-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            
            // Coleta os dados das disciplinas dinâmicas
            const disciplines = [];
            document.querySelectorAll('.discipline-entry').forEach(entry => {
                disciplines.push({
                    discipline_name: entry.querySelector('[name="discipline_name"]').value,
                    graduation: entry.querySelector('[name="graduation"]').value,
                });
            });

            const updatedData = {
                contact_info: { phone: form.elements.phone.value },
                description: form.elements.description.value,
                disciplines: disciplines
            };

            // Lógica de envio PUT
            try {
                await fetchWithAuth(`/api/admin/teachers/${teacherId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedData)
                });
                hideModal();
                renderTeacherList(targetElement);
            } catch (error) { alert('Falha ao atualizar professor.'); }
        });

    } catch (error) { showModal('Erro', '<p>Não foi possível carregar os dados.</p>'); }
}


// --- LÓGICA DE ADICIONAR (AGORA COM DISCIPLINAS) ---
async function handleAddProfessorClick(targetElement) {
    // ... (código para buscar availableUsers e criar o formHtml principal) ...
    // ... A lógica de submissão do formulário de ADIÇÃO também precisará ser
    // atualizada para coletar as disciplinas, similar à função de EDIÇÃO acima.
}


// --- RENDERIZAÇÃO PRINCIPAL (COM A COLUNA DE VOLTA) ---
export async function renderTeacherList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Professores</h1>
            <button id="add-teacher-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Adicionar Professor
            </button>
        </div>
        <div id="teacher-table-container"><p>Carregando professores...</p></div>
    `;

    try {
        const response = await fetchWithAuth('/api/admin/teachers/');
        const teachers = await response.json();
        const tableContainer = targetElement.querySelector('#teacher-table-container');
        
        if (teachers.length === 0) {
            tableContainer.innerHTML = '<p>Nenhum professor encontrado.</p>';
            return;
        }

        const tableHtml = `
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
                                ${ Array.isArray(teacher.disciplines) && teacher.disciplines.length > 0
                                    ? teacher.disciplines.map(d => `<div><strong>${d.discipline_name}:</strong> ${d.graduation}</div>`).join('')
                                    : 'Nenhuma' }
                            </td>
                            <td class="py-3 px-4 align-top">
                                <button data-action="edit" data-teacher-id="${teacher.id}" class="text-indigo-600 hover:underline mr-4">Editar</button>
                                <button data-action="delete" data-teacher-id="${teacher.id}" class="text-red-600 hover:underline">Deletar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        tableContainer.innerHTML = tableHtml;

        // --- LISTENERS DE EVENTOS (AGORA COM REMOVER) ---
        targetElement.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const targetId = e.target.dataset.target;
            const teacherId = e.target.dataset.teacherId;

            if (action === 'add-professor') handleAddProfessorClick(targetElement);
            if (action === 'edit' && teacherId) handleEditProfessorClick(teacherId, targetElement);
            if (action === 'delete' && teacherId) handleDeleteProfessorClick(teacherId, targetElement); // Necessita da função handleDelete
            if (action === 'remove-discipline' && targetId) document.getElementById(targetId)?.remove();
        });
        
        // Substituindo o listener antigo por delegação
        targetElement.querySelector('#add-teacher-btn').setAttribute('data-action', 'add-professor');

    } catch (error) {
        console.error("Erro ao buscar professores:", error);
        targetElement.querySelector('#teacher-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os professores.</p>`;
    }
}