import { db } from '../firebaseConfig.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showToast } from '../utils/toast.js';
import { showSpinner, hideSpinner } from '../utils/spinner.js';
import { showModal, closeModal } from '../utils/modal.js';

let students = [];
let currentPage = 1;
const rowsPerPage = 10;

// Função principal que renderiza o componente de lista de alunos
async function renderStudentList(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-800">Alunos</h2>
                <button id="add-student-btn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50">
                    <i class="fas fa-plus mr-2"></i>Adicionar Aluno
                </button>
            </div>
            <div class="mb-4">
                <input type="text" id="student-search" placeholder="Buscar aluno por nome..." class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </div>
            <div id="students-table-container" class="overflow-x-auto">
                <!-- A tabela de alunos será renderizada aqui -->
            </div>
            <div id="pagination-controls" class="mt-4 flex justify-end">
                <!-- Os controles de paginação serão renderizados aqui -->
            </div>
        </div>
    `;

    document.getElementById('add-student-btn').addEventListener('click', renderAddStudentForm);
    document.getElementById('student-search').addEventListener('input', handleSearch);

    await fetchStudents();
}

// Busca os alunos do Firestore e armazena em cache
async function fetchStudents() {
    showSpinner();
    try {
        const querySnapshot = await getDocs(collection(db, 'students'));
        students = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordena os alunos por nome
        students.sort((a, b) => a.name.localeCompare(b.name));
        currentPage = 1; // Reseta para a primeira página após buscar os dados
        renderTable();
    } catch (error) {
        console.error("Erro ao buscar alunos: ", error);
        showToast('Erro ao carregar os alunos. Tente novamente mais tarde.', 'error');
    } finally {
        hideSpinner();
    }
}

// Renderiza a tabela de alunos com base nos dados em cache e na paginação
function renderTable(filteredStudents = students) {
    const tableContainer = document.getElementById('students-table-container');
    if (!tableContainer) return;

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedStudents = filteredStudents.slice(start, end);

    if (paginatedStudents.length === 0 && currentPage > 1) {
        currentPage--;
        renderTable(filteredStudents);
        return;
    }

    tableContainer.innerHTML = `
        <table class="min-w-full bg-white">
            <thead class="bg-gray-100">
                <tr>
                    <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
                    <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Telefone</th>
                    <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody id="students-tbody" class="text-gray-700">
                ${paginatedStudents.map(student => `
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="py-3 px-4">${student.name}</td>
                        <td class="py-3 px-4">
                            <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                ${student.status === 'active' ? 'Ativo' : 'Inativo'}
                            </span>
                        </td>
                        <td class="py-3 px-4">${student.contact?.phone || 'N/A'}</td>
                        <td class="py-3 px-4">
                            <button class="view-student-btn text-indigo-600 hover:text-indigo-900 mr-2" data-id="${student.id}" title="Visualizar"><i class="fas fa-eye"></i></button>
                            <button class="edit-student-btn text-yellow-600 hover:text-yellow-900 mr-2" data-id="${student.id}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                            <button class="delete-student-btn text-red-600 hover:text-red-900" data-id="${student.id}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${paginatedStudents.length === 0 ? '<p class="text-center py-4">Nenhum aluno encontrado.</p>' : ''}
    `;
    renderPaginationControls(filteredStudents.length);
    attachTableEventListeners();
}

// Adiciona os event listeners aos botões da tabela
function attachTableEventListeners() {
    document.querySelectorAll('.view-student-btn').forEach(button => {
        button.addEventListener('click', (e) => handleViewStudent(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.edit-student-btn').forEach(button => {
        button.addEventListener('click', (e) => renderEditStudentForm(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.delete-student-btn').forEach(button => {
        button.addEventListener('click', (e) => handleDeleteStudent(e.currentTarget.dataset.id));
    });
}

// Renderiza os controles de paginação
function renderPaginationControls(totalItems) {
    const paginationContainer = document.getElementById('pagination-controls');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let buttons = '';
    for (let i = 1; i <= totalPages; i++) {
        buttons += `<button class="page-btn px-4 py-2 mx-1 rounded-lg ${currentPage === i ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" data-page="${i}">${i}</button>`;
    }

    paginationContainer.innerHTML = `
        <button id="prev-page-btn" class="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        ${buttons}
        <button id="next-page-btn" class="px-4 py-2 mx-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300" ${currentPage === totalPages ? 'disabled' : ''}>Próximo</button>
    `;

    document.querySelectorAll('.page-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            currentPage = parseInt(e.target.dataset.page);
            handleSearch(); // Re-renderiza a tabela com o filtro atual
        });
    });

    const prevBtn = document.getElementById('prev-page-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                handleSearch();
            }
        });
    }

    const nextBtn = document.getElementById('next-page-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                handleSearch();
            }
        });
    }
}

// Lida com a busca de alunos
function handleSearch() {
    const searchTerm = document.getElementById('student-search').value.toLowerCase();
    const filtered = students.filter(student => student.name.toLowerCase().includes(searchTerm));
    if(document.getElementById('student-search').value !== "" && currentPage !==1){
        //Não faz nada para não bugar a paginação
    }else{
        currentPage = 1;
    }
    renderTable(filtered);
}

// Renderiza o formulário para adicionar um novo aluno em um modal
function renderAddStudentForm() {
    const formHtml = `
        <form id="add-student-form" class="space-y-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-4">Novo Aluno</h3>
            
            <!-- Informações Pessoais -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Informações Pessoais</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="name" class="block text-sm font-medium text-gray-700">Nome Completo</label>
                        <input type="text" id="name" name="name" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="birthDate" class="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                        <input type="date" id="birthDate" name="birthDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="gender" class="block text-sm font-medium text-gray-700">Gênero</label>
                        <select id="gender" name="gender" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                            <option value="male">Masculino</option>
                            <option value="female">Feminino</option>
                            <option value="other">Outro</option>
                        </select>
                    </div>
                     <div>
                        <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
                        <select id="status" name="status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Contato -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Contato</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="phone" class="block text-sm font-medium text-gray-700">Telefone</label>
                        <input type="tel" id="phone" name="phone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" id="email" name="email" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

            <!-- Endereço -->
             <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Endereço</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div class="md:col-span-2">
                        <label for="street" class="block text-sm font-medium text-gray-700">Rua</label>
                        <input type="text" id="street" name="street" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="number" class="block text-sm font-medium text-gray-700">Número</label>
                        <input type="text" id="number" name="number" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div class="md:col-span-1">
                         <label for="complement" class="block text-sm font-medium text-gray-700">Complemento</label>
                        <input type="text" id="complement" name="complement" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div class="md:col-span-2">
                         <label for="neighborhood" class="block text-sm font-medium text-gray-700">Bairro</label>
                        <input type="text" id="neighborhood" name="neighborhood" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div>
                         <label for="city" class="block text-sm font-medium text-gray-700">Cidade</label>
                        <input type="text" id="city" name="city" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div>
                         <label for="state" class="block text-sm font-medium text-gray-700">Estado</label>
                        <input type="text" id="state" name="state" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div>
                         <label for="zip" class="block text-sm font-medium text-gray-700">CEP</label>
                        <input type="text" id="zip" name="zip" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

            <!-- Contato de Emergência -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Contato de Emergência</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="emergencyName" class="block text-sm font-medium text-gray-700">Nome</label>
                        <input type="text" id="emergencyName" name="emergencyName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="emergencyPhone" class="block text-sm font-medium text-gray-700">Telefone</label>
                        <input type="tel" id="emergencyPhone" name="emergencyPhone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

             <!-- Documentos -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Documentos</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="cpf" class="block text-sm font-medium text-gray-700">CPF</label>
                        <input type="text" id="cpf" name="cpf" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="rg" class="block text-sm font-medium text-gray-700">RG</label>
                        <input type="text" id="rg" name="rg" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

             <!-- Informações da Arte Marcial -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Informações da Arte Marcial</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div>
                        <label for="rank" class="block text-sm font-medium text-gray-700">Faixa</label>
                        <input type="text" id="rank" name="rank" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="startDate" class="block text-sm font-medium text-gray-700">Data de Início</label>
                        <input type="date" id="startDate" name="startDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="lastGraduation" class="block text-sm font-medium text-gray-700">Última Graduação</label>
                        <input type="date" id="lastGraduation" name="lastGraduation" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>
            
            <!-- Observações -->
            <div>
                <h4 class="text-lg font-medium text-gray-800">Observações</h4>
                <textarea id="notes" name="notes" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"></textarea>
            </div>


            <div class="flex justify-end pt-4">
                <button type="button" id="cancel-add-btn" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 mr-2">Cancelar</button>
                <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Salvar</button>
            </div>
        </form>
    `;
    showModal(formHtml);
    document.getElementById('add-student-form').addEventListener('submit', handleAddStudentSubmit);
    document.getElementById('cancel-add-btn').addEventListener('click', closeModal);
}

// Lida com o envio do formulário de adição
async function handleAddStudentSubmit(event) {
    event.preventDefault();
    const form = event.target;
    showSpinner();

    try {
        const studentData = {
            name: form.name.value,
            status: form.status.value,
            contact: {
                phone: form.phone.value,
                email: form.email.value,
                emergencyName: form.emergencyName.value,
                emergencyPhone: form.emergencyPhone.value,
            },
            address: {
                street: form.street.value,
                number: form.number.value,
                complement: form.complement.value,
                neighborhood: form.neighborhood.value,
                city: form.city.value,
                state: form.state.value,
                zip: form.zip.value,
            },
            details: {
                gender: form.gender.value,
                cpf: form.cpf.value,
                rg: form.rg.value,
                notes: form.notes.value,
            },
            martialArtInfo: {
                rank: form.rank.value,
                startDate: form.startDate.value,
                lastGraduation: form.lastGraduation.value,
            },
            birthDate: form.birthDate.value,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // DEBUG: Log para verificar os dados antes de enviar
        console.log('Dados do novo aluno para salvar:', studentData);
        
        await addDoc(collection(db, 'students'), studentData);
        
        hideSpinner();
        showToast('Aluno adicionado com sucesso!');
        closeModal();
        await fetchStudents();
    } catch (error) {
        console.error("Erro ao adicionar aluno: ", error);
        showToast('Erro ao adicionar aluno.', 'error');
        hideSpinner();
    }
}


// Renderiza o formulário de edição de um aluno em um modal
function renderEditStudentForm(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) {
        showToast('Aluno não encontrado.', 'error');
        return;
    }

    const formHtml = `
        <form id="edit-student-form" class="space-y-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-4">Editar Aluno</h3>
            
             <!-- Informações Pessoais -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Informações Pessoais</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="name" class="block text-sm font-medium text-gray-700">Nome Completo</label>
                        <input type="text" id="name" name="name" value="${student.name || ''}" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="birthDate" class="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                        <input type="date" id="birthDate" name="birthDate" value="${student.birthDate || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="gender" class="block text-sm font-medium text-gray-700">Gênero</label>
                        <select id="gender" name="gender" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                            <option value="male" ${student.details?.gender === 'male' ? 'selected' : ''}>Masculino</option>
                            <option value="female" ${student.details?.gender === 'female' ? 'selected' : ''}>Feminino</option>
                            <option value="other" ${student.details?.gender === 'other' ? 'selected' : ''}>Outro</option>
                        </select>
                    </div>
                     <div>
                        <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
                        <select id="status" name="status" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                            <option value="active" ${student.status === 'active' ? 'selected' : ''}>Ativo</option>
                            <option value="inactive" ${student.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Contato -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Contato</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="phone" class="block text-sm font-medium text-gray-700">Telefone</label>
                        <input type="tel" id="phone" name="phone" value="${student.contact?.phone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" id="email" name="email" value="${student.contact?.email || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

            <!-- Endereço -->
             <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Endereço</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div class="md:col-span-2">
                        <label for="street" class="block text-sm font-medium text-gray-700">Rua</label>
                        <input type="text" id="street" name="street" value="${student.address?.street || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="number" class="block text-sm font-medium text-gray-700">Número</label>
                        <input type="text" id="number" name="number" value="${student.address?.number || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div class="md:col-span-1">
                         <label for="complement" class="block text-sm font-medium text-gray-700">Complemento</label>
                        <input type="text" id="complement" name="complement" value="${student.address?.complement || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div class="md:col-span-2">
                         <label for="neighborhood" class="block text-sm font-medium text-gray-700">Bairro</label>
                        <input type="text" id="neighborhood" name="neighborhood" value="${student.address?.neighborhood || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div>
                         <label for="city" class="block text-sm font-medium text-gray-700">Cidade</label>
                        <input type="text" id="city" name="city" value="${student.address?.city || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div>
                         <label for="state" class="block text-sm font-medium text-gray-700">Estado</label>
                        <input type="text" id="state" name="state" value="${student.address?.state || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                     <div>
                         <label for="zip" class="block text-sm font-medium text-gray-700">CEP</label>
                        <input type="text" id="zip" name="zip" value="${student.address?.zip || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

            <!-- Contato de Emergência -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Contato de Emergência</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="emergencyName" class="block text-sm font-medium text-gray-700">Nome</label>
                        <input type="text" id="emergencyName" name="emergencyName" value="${student.contact?.emergencyName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="emergencyPhone" class="block text-sm font-medium text-gray-700">Telefone</label>
                        <input type="tel" id="emergencyPhone" name="emergencyPhone" value="${student.contact?.emergencyPhone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

             <!-- Documentos -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Documentos</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label for="cpf" class="block text-sm font-medium text-gray-700">CPF</label>
                        <input type="text" id="cpf" name="cpf" value="${student.details?.cpf || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="rg" class="block text-sm font-medium text-gray-700">RG</label>
                        <input type="text" id="rg" name="rg" value="${student.details?.rg || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>

             <!-- Informações da Arte Marcial -->
            <div class="border-b border-gray-200 pb-4">
                <h4 class="text-lg font-medium text-gray-800">Informações da Arte Marcial</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div>
                        <label for="rank" class="block text-sm font-medium text-gray-700">Faixa</label>
                        <input type="text" id="rank" name="rank" value="${student.martialArtInfo?.rank || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="startDate" class="block text-sm font-medium text-gray-700">Data de Início</label>
                        <input type="date" id="startDate" name="startDate" value="${student.martialArtInfo?.startDate || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label for="lastGraduation" class="block text-sm font-medium text-gray-700">Última Graduação</label>
                        <input type="date" id="lastGraduation" name="lastGraduation" value="${student.martialArtInfo?.lastGraduation || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                </div>
            </div>
            
            <!-- Observações -->
            <div>
                <h4 class="text-lg font-medium text-gray-800">Observações</h4>
                <textarea id="notes" name="notes" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">${student.details?.notes || ''}</textarea>
            </div>

            <div class="flex justify-end pt-4">
                <button type="button" id="cancel-edit-btn" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 mr-2">Cancelar</button>
                <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Salvar Alterações</button>
            </div>
        </form>
    `;
    showModal(formHtml);
    const form = document.getElementById('edit-student-form');
    form.addEventListener('submit', (e) => handleEditStudentSubmit(e, studentId));
    document.getElementById('cancel-edit-btn').addEventListener('click', closeModal);
}

// Lida com o envio do formulário de edição
async function handleEditStudentSubmit(event, studentId) {
    event.preventDefault();
    const form = event.target;
    showSpinner();
    try {
        // Correção: Usar notação de ponto para atualizar campos aninhados de forma segura
        const updatedData = {
            name: form.name.value,
            status: form.status.value,
            birthDate: form.birthDate.value,
            'contact.phone': form.phone.value,
            'contact.email': form.email.value,
            'contact.emergencyName': form.emergencyName.value,
            'contact.emergencyPhone': form.emergencyPhone.value,
            'address.street': form.street.value,
            'address.number': form.number.value,
            'address.complement': form.complement.value,
            'address.neighborhood': form.neighborhood.value,
            'address.city': form.city.value,
            'address.state': form.state.value,
            'address.zip': form.zip.value,
            'details.gender': form.gender.value,
            'details.cpf': form.cpf.value,
            'details.rg': form.rg.value,
            'details.notes': form.notes.value,
            'martialArtInfo.rank': form.rank.value,
            'martialArtInfo.startDate': form.startDate.value,
            'martialArtInfo.lastGraduation': form.lastGraduation.value,
            updatedAt: new Date()
        };

        // DEBUG: Log para verificar os dados antes de enviar
        console.log('Dados formatados para atualização (dot notation):', updatedData);

        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, updatedData);

        hideSpinner();
        showToast('Aluno atualizado com sucesso!');
        closeModal();
        await fetchStudents();
    } catch (error) {
        console.error("Erro ao atualizar aluno: ", error);
        showToast('Erro ao atualizar aluno.', 'error');
        hideSpinner();
    }
}

// Lida com a exclusão de um aluno
function handleDeleteStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    const confirmationHtml = `
        <div class="text-center">
            <h3 class="text-xl font-semibold text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p class="text-gray-600 mb-6">Você tem certeza que deseja excluir o aluno <strong>${student.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div class="flex justify-center">
                <button id="cancel-delete-btn" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 mr-2">Cancelar</button>
                <button id="confirm-delete-btn" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Excluir</button>
            </div>
        </div>
    `;
    showModal(confirmationHtml);
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        showSpinner();
        try {
            await deleteDoc(doc(db, 'students', studentId));
            showToast('Aluno excluído com sucesso!');
            await fetchStudents();
        } catch (error) {
            console.error("Erro ao excluir aluno: ", error);
            showToast('Erro ao excluir aluno.', 'error');
        } finally {
            hideSpinner();
            closeModal();
        }
    });
    document.getElementById('cancel-delete-btn').addEventListener('click', closeModal);
}

// Exibe os detalhes de um aluno em um modal
function handleViewStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const detailsHtml = `
        <div class="space-y-4">
            <h3 class="text-2xl font-bold text-gray-800 border-b pb-2">${student.name}</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div><strong>Status:</strong> <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${student.status === 'active' ? 'Ativo' : 'Inativo'}</span></div>
                <div><strong>Data de Nasc.:</strong> ${student.birthDate ? new Date(student.birthDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A'}</div>
                <div><strong>Gênero:</strong> ${student.details?.gender || 'N/A'}</div>
                <div><strong>Telefone:</strong> ${student.contact?.phone || 'N/A'}</div>
                <div><strong>Email:</strong> ${student.contact?.email || 'N/A'}</div>
                <div><strong>CPF:</strong> ${student.details?.cpf || 'N/A'}</div>
                <div><strong>RG:</strong> ${student.details?.rg || 'N/A'}</div>
            </div>

            <div class="pt-2">
                <h4 class="text-lg font-semibold text-gray-700 border-b pb-1 mb-2">Endereço</h4>
                <p>${student.address?.street || ''}, ${student.address?.number || ''} - ${student.address?.neighborhood || ''}</p>
                <p>${student.address?.city || ''} - ${student.address?.state || ''}, ${student.address?.zip || ''}</p>
            </div>

            <div class="pt-2">
                <h4 class="text-lg font-semibold text-gray-700 border-b pb-1 mb-2">Contato de Emergência</h4>
                <p><strong>Nome:</strong> ${student.contact?.emergencyName || 'N/A'}</p>
                <p><strong>Telefone:</strong> ${student.contact?.emergencyPhone || 'N/A'}</p>
            </div>

             <div class="pt-2">
                <h4 class="text-lg font-semibold text-gray-700 border-b pb-1 mb-2">Informações Marciais</h4>
                <p><strong>Faixa:</strong> ${student.martialArtInfo?.rank || 'N/A'}</p>
                <p><strong>Início:</strong> ${student.martialArtInfo?.startDate ? new Date(student.martialArtInfo.startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A'}</p>
                <p><strong>Última Graduação:</strong> ${student.martialArtInfo?.lastGraduation ? new Date(student.martialArtInfo.lastGraduation).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A'}</p>
            </div>
            
            <div class="pt-2">
                <h4 class="text-lg font-semibold text-gray-700 border-b pb-1 mb-2">Observações</h4>
                <p class="whitespace-pre-wrap">${student.details?.notes || 'Nenhuma observação.'}</p>
            </div>

            <div class="flex justify-end pt-4">
                 <button type="button" id="close-view-btn" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Fechar</button>
            </div>
        </div>
    `;
    showModal(detailsHtml);
    document.getElementById('close-view-btn').addEventListener('click', closeModal);
}


export { renderStudentList };
