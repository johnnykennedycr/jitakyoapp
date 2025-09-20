// frontend/src/components/TeacherList.js

import { fetchWithAuth } from '../lib/api.js';

export async function renderTeacherList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Gerenciamento de Professores</h1>
            <button id="add-teacher-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Adicionar Professor
            </button>
        </div>
        <div id="teacher-table-container">
            <p>Carregando professores...</p>
        </div>
    `;

    try {
        const response = await fetchWithAuth('/api/admin/teachers/');
        const teachers = await response.json();

        const tableContainer = document.getElementById('teacher-table-container');
        if (teachers.length === 0) {
            tableContainer.innerHTML = '<p>Nenhum professor encontrado.</p>';
            return;
        }

        const tableHtml = `
            <table class="min-w-full bg-white rounded-md shadow">
                <thead class="bg-gray-200">
                    <tr>
                        <th class="py-3 px-4 text-left">Nome</th>
                        <th class="py-3 px-4 text-left">Email</th>
                        <th class="py-3 px-4 text-left">Telefone</th>
                        <th class="py-3 px-4 text-left">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${teachers.map(teacher => `
                        <tr class="border-b">
                            <td class="py-3 px-4">${teacher.name || 'N/A'}</td>
                            <td class="py-3 px-4">${teacher.email || 'N/A'}</td>
                            <td class="py-3 px-4">${teacher.phone || 'N/A'}</td>
                            <td class="py-3 px-4">
                                <button class="text-indigo-600 hover:underline mr-4">Editar</button>
                                <button class="text-red-600 hover:underline">Deletar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        tableContainer.innerHTML = tableHtml;
    } catch (error) {
        console.error("Erro ao buscar professores:", error);
        document.getElementById('teacher-table-container').innerHTML = `<p class="text-red-500">Falha ao carregar os professores.</p>`;
    }
}