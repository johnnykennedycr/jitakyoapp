// frontend/src/components/TeacherList.js

import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';

// --- LÓGICA DE DELETAR ---
async function handleDeleteProfessorClick(teacherId, targetElement) {
    if (confirm('Tem certeza que deseja deletar este professor? Esta ação não pode ser desfeita.')) {
        try {
            await fetchWithAuth(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
            alert('Professor deletado com sucesso!');
            renderTeacherList(targetElement); // Atualiza a lista
        } catch (error) {
            console.error('Erro ao deletar professor:', error);
            alert('Falha ao deletar professor.');
        }
    }
}

// --- LÓGICA DE EDITAR ---
async function handleEditProfessorClick(teacherId, targetElement) {
    showModal('Editar Professor', '<p>Carregando dados do professor...</p>');
    try {
        const response = await fetchWithAuth(`/api/admin/teachers/${teacherId}`);
        const teacher = await response.json();

        const formHtml = `
            <form id="edit-teacher-form">
                <p class="mb-4 text-sm text-gray-600">Editando o perfil de <strong>${teacher.name}</strong>.</p>
                <input type="hidden" name="user_id" value="${teacher.user_id}">
                
                <div class="mb-4">
                    <label for="contact-phone" class="block text-sm font-medium text-gray-700">Telefone</label>
                    <input type="text" id="contact-phone" name="phone" value="${teacher.contact_info?.phone || ''}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                </div>
                <div class="mb-4">
                    <label for="description" class="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea id="description" name="description" rows="3" class="mt-1 block w-full p-2 border border-gray-300 rounded-md">${teacher.description || ''}</textarea>
                </div>
                <div class="text-right">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Salvar Alterações</button>
                </div>
            </form>
        `;
        showModal('Editar Professor', formHtml);

        document.getElementById('edit-teacher-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const updatedData = {
                contact_info: { phone: form.elements.phone.value },
                description: form.elements.description.value
                // Adicione outros campos para editar aqui
            };

            try {
                await fetchWithAuth(`/api/admin/teachers/${teacherId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedData)
                });
                hideModal();
                renderTeacherList(targetElement);
            } catch (error) {
                console.error('Erro ao atualizar professor:', error);
                alert('Falha ao atualizar professor.');
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dados do professor:', error);
        showModal('Erro', '<p>Não foi possível carregar os dados do professor.</p>');
    }
}


// --- LÓGICA DE ADICIONAR (EXISTENTE) ---
async function handleAddProfessorClick(targetElement) {
    // ... seu código da função handleAddProfessorClick permanece aqui ...
}

// --- RENDERIZAÇÃO PRINCIPAL ---
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

    // Listener para o botão de Adicionar
    targetElement.querySelector('#add-teacher-btn').addEventListener('click', () => {
        handleAddProfessorClick(targetElement);
    });
    
    // Busca e renderiza a tabela
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
                        <th class="py-3 px-4 text-left">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${teachers.map(teacher => `
                        <tr class="border-b">
                            <td class="py-3 px-4">${teacher.name || 'N/A'}</td>
                            <td class="py-3 px-4">${teacher.contact_info?.phone || 'N/A'}</td>
                            <td class="py-3 px-4">
                                <button data-action="edit" data-teacher-id="${teacher.id}" class="text-indigo-600 hover:underline mr-4">Editar</button>
                                <button data-action="delete" data-teacher-id="${teacher.id}" class="text-red-600 hover:underline">Deletar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        tableContainer.innerHTML = tableHtml;

        // Adiciona listeners para os botões de Editar e Deletar usando delegação de eventos
        tableContainer.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const teacherId = e.target.dataset.teacherId;

            if (action === 'edit' && teacherId) {
                handleEditProfessorClick(teacherId, targetElement);
            } else if (action === 'delete' && teacherId) {
                handleDeleteProfessorClick(teacherId, targetElement);
            }
        });

    } catch (error) {
        console.error("Erro ao buscar professores:", error);
        targetElement.querySelector('#teacher-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os professores.</p>`;
    }
}