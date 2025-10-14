import { createStudent, getStudents, updateStudent, deleteStudent } from '../services/studentService.js';
import { getClasses } from '../services/classService.js';
import { showToast } from '../utils/toast.js';
import { showLoading, hideLoading } from '../utils/loading.js';
import { format } from 'date-fns';

const StudentList = {
  async render() {
    return `
      <div class="container mx-auto px-4 sm:px-8">
        <div class="py-8">
          <div>
            <h2 class="text-2xl font-semibold leading-tight text-gray-200">Alunos</h2>
          </div>
          <div class="my-2 flex sm:flex-row flex-col">
            <div class="flex flex-row mb-1 sm:mb-0">
              </div>
              <div class="block relative">
                <span class="h-full absolute inset-y-0 left-0 flex items-center pl-2">
                  <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current text-gray-500">
                    <path
                      d="M10 4a6 6 0 100 12 6 6 0 000-12zm-8 6a8 8 0 1114.32 4.906l5.387 5.387a1 1 0 01-1.414 1.414l-5.387-5.387A8 8 0 012 10z">
                    </path>
                  </svg>
                </span>
                <input placeholder="Buscar alunos" id="search-input"
                  class="appearance-none rounded-r rounded-l sm:rounded-l-none border border-gray-400 border-b block pl-8 pr-6 py-2 w-full bg-white text-sm placeholder-gray-400 text-gray-700 focus:bg-white focus:placeholder-gray-600 focus:text-gray-700 focus:outline-none" />
              </div>
              <button id="add-student-btn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2">
                Adicionar Aluno
              </button>
            </div>
          </div>
          <div class="-mx-4 sm:-mx-8 px-4 sm:px-8 py-4 overflow-x-auto">
            <div class="inline-block min-w-full shadow rounded-lg overflow-hidden">
              <table class="min-w-full leading-normal">
                <thead>
                  <tr>
                    <th
                      class="px-5 py-3 border-b-2 border-gray-200 bg-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Nome
                    </th>
                    <th
                      class="px-5 py-3 border-b-2 border-gray-200 bg-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th
                      class="px-5 py-3 border-b-2 border-gray-200 bg-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Turmas
                    </th>
                    <th
                      class="px-5 py-3 border-b-2 border-gray-200 bg-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th
                      class="px-5 py-3 border-b-2 border-gray-200 bg-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody id="students-tbody">
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div id="student-modal" class="fixed z-10 inset-0 overflow-y-auto hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <form id="student-form">
              <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">Adicionar Aluno</h3>
                <div class="mt-2">
                  <div class="mb-4">
                    <label for="student-name" class="block text-gray-700 text-sm font-bold mb-2">Nome Completo</label>
                    <input type="text" id="student-name" name="name" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                  </div>
                  <div class="mb-4">
                    <label for="student-email" class="block text-gray-700 text-sm font-bold mb-2">Email</label>
                    <input type="email" id="student-email" name="email" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                  </div>
                  <div class="mb-4">
                    <label for="student-phone" class="block text-gray-700 text-sm font-bold mb-2">Telefone</label>
                    <input type="tel" id="student-phone" name="phone" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                  </div>
                  <div class="mb-4">
                    <label for="student-dob" class="block text-gray-700 text-sm font-bold mb-2">Data de Nascimento</label>
                    <input type="date" id="student-dob" name="dob" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                  </div>
                  <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Aluno é menor de idade?</label>
                    <input type="checkbox" id="student-is-minor" name="is_minor" class="mr-2 leading-tight">
                    <span class="text-sm">Sim</span>
                  </div>
                  <div id="responsible-fields" class="hidden">
                    <div class="mb-4">
                      <label for="responsible-name" class="block text-gray-700 text-sm font-bold mb-2">Nome do Responsável</label>
                      <input type="text" id="responsible-name" name="responsibleName" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                    </div>
                    <div class="mb-4">
                      <label for="responsible-cpf" class="block text-gray-700 text-sm font-bold mb-2">CPF do Responsável</label>
                      <input type="text" id="responsible-cpf" name="responsibleCpf" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                    </div>
                     <div class="mb-4">
                        <label for="responsible-kinship" class="block text-gray-700 text-sm font-bold mb-2">Parentesco</label>
                        <input type="text" id="responsible-kinship" name="responsibleKinship" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                    </div>
                  </div>
                  <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">
                        Ativo
                    </label>
                    <label class="inline-flex items-center">
                        <input type="checkbox" id="student-active" name="active" class="form-checkbox h-5 w-5 text-blue-600">
                        <span class="ml-2 text-gray-700">Sim</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="submit" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                  Salvar
                </button>
                <button type="button" id="cancel-btn" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    let allStudents = [];
    let allClass = [];

    const loadStudents = async () => {
      showLoading();
      try {
        allStudents = await getStudents();
        allClass = await getClasses();
        renderTable(allStudents, allClass);
      } catch (error) {
        showToast('Erro ao carregar alunos.', 'error');
      } finally {
        hideLoading();
      }
    };

    const renderTable = (students, classes) => {
      const tbody = document.getElementById('students-tbody');
      tbody.innerHTML = '';
      if (!students) {
        showToast('Nenhum aluno encontrado ou erro ao buscar dados.', 'error');
        return;
      }

      const getTurmaNames = (turmaIds) => {
        if (!turmaIds || turmaIds.length === 0) return 'Sem turma';

        return turmaIds.map(turmaId => {
          const turma = classes.find(t => t.id === turmaId);
          return turma ? turma.name : 'Turma desconhecida';
        }).join(', ');
      };
      
      students.forEach(student => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="px-5 py-5 border-b border-gray-200 bg-gray-800 text-sm">
            <div class="flex items-center">
              <div class="ml-3">
                <p class="text-gray-200 whitespace-no-wrap">${student.name}</p>
              </div>
            </div>
          </td>
          <td class="px-5 py-5 border-b border-gray-200 bg-gray-800 text-sm">
            <p class="text-gray-200 whitespace-no-wrap">${student.email}</p>
          </td>
          <td class="px-5 py-5 border-b border-gray-200 bg-gray-800 text-sm">
              <p class="text-gray-200 whitespace-no-wrap">${getTurmaNames(student.turmas)}</p>
          </td>
          <td class="px-5 py-5 border-b border-gray-200 bg-gray-800 text-sm">
            <span class="relative inline-block px-3 py-1 font-semibold ${student.active ? 'text-green-900' : 'text-red-900'} leading-tight">
              <span aria-hidden class="absolute inset-0 ${student.active ? 'bg-green-200' : 'bg-red-200'} opacity-50 rounded-full"></span>
              <span class="relative">${student.active ? 'Ativo' : 'Inativo'}</span>
            </span>
          </td>
          <td class="px-5 py-5 border-b border-gray-200 bg-gray-800 text-sm">
            <button class="edit-btn text-indigo-600 hover:text-indigo-900" data-id="${student.id}">Editar</button>
            <button class="delete-btn text-red-600 hover:text-red-900 ml-4" data-id="${student.id}">Excluir</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      addEventListenersToButtons();
    };

    const addEventListenersToButtons = () => {
      document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const studentId = e.target.getAttribute('data-id');
          const student = allStudents.find(s => s.id === studentId);
          openStudentModal(student);
        });
      });

      document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
          const studentId = e.target.getAttribute('data-id');
          if (confirm('Tem certeza que deseja excluir este aluno?')) {
            showLoading();
            try {
              await deleteStudent(studentId);
              showToast('Aluno excluído com sucesso!', 'success');
              loadStudents();
            } catch (error) {
              showToast('Erro ao excluir aluno.', 'error');
            } finally {
              hideLoading();
            }
          }
        });
      });
    };

    const openStudentModal = (student) => {
      const modal = document.getElementById('student-modal');
      const form = document.getElementById('student-form');
      const modalTitle = document.getElementById('modal-title');
      form.reset();
      const responsibleFields = document.getElementById('responsible-fields');

      if (student) {
        modalTitle.innerText = 'Editar Aluno';
        form.dataset.studentId = student.id;
        document.getElementById('student-name').value = student.name;
        document.getElementById('student-email').value = student.email;
        document.getElementById('student-phone').value = student.telefone || '';
        document.getElementById('student-dob').value = student.dataNascimento ? format(new Date(student.dataNascimento), 'yyyy-MM-dd') : '';
        document.getElementById('student-active').checked = student.active;
        document.getElementById('student-is-minor').checked = student.isMinor;

        if (student.isMinor) {
          responsibleFields.classList.remove('hidden');
          document.getElementById('responsible-name').value = student.responsibleForContact?.name || '';
          document.getElementById('responsible-cpf').value = student.responsibleForContact?.cpf || '';
          document.getElementById('responsible-kinship').value = student.responsibleForContact?.kinship || '';
        } else {
          responsibleFields.classList.add('hidden');
        }

      } else {
        modalTitle.innerText = 'Adicionar Aluno';
        delete form.dataset.studentId;
        document.getElementById('student-active').checked = true;
      }
      modal.classList.remove('hidden');
    };

    const handleFormSubmit = async (event) => {
      event.preventDefault();
      const studentId = event.target.dataset.studentId;
      const formData = new FormData(event.target);
      const studentData = Object.fromEntries(formData.entries());

      // --- INÍCIO DA CORREÇÃO ---
      // O formulário usa 'phone' e 'dob', mas o Firestore espera 'telefone' e 'dataNascimento'.
      // Aqui, nós ajustamos o objeto de dados antes de enviá-lo.
      studentData.telefone = studentData.phone;
      studentData.dataNascimento = studentData.dob;
      delete studentData.phone; // Remove a chave antiga para não enviar dados desnecessários
      delete studentData.dob;   // Remove a chave antiga
      // --- FIM DA CORREÇÃO ---

      studentData.active = document.getElementById('student-active').checked;
      const isMinor = document.getElementById('student-is-minor').checked;
      studentData.isMinor = isMinor;

      if (isMinor) {
        studentData.responsibleForContact = {
          name: studentData.responsibleName,
          cpf: studentData.responsibleCpf,
          kinship: studentData.responsibleKinship,
        };
      }

      delete studentData.responsibleName;
      delete studentData.responsibleCpf;
      delete studentData.responsibleKinship;

      showLoading();
      try {
        if (studentId) {
          await updateStudent(studentId, studentData);
          showToast('Aluno atualizado com sucesso!', 'success');
        } else {
          await createStudent(studentData);
          showToast('Aluno adicionado com sucesso!', 'success');
        }
        document.getElementById('student-modal').classList.add('hidden');
        loadStudents();
      } catch (error) {
        console.error("Erro ao salvar aluno:", error);
        const errorMessage = error.response?.data?.error || 'Erro ao salvar aluno.';
        showToast(errorMessage, 'error');
      } finally {
        hideLoading();
      }
    };

    document.getElementById('add-student-btn').addEventListener('click', () => openStudentModal(null));
    document.getElementById('cancel-btn').addEventListener('click', () => document.getElementById('student-modal').classList.add('hidden'));
    document.getElementById('student-form').addEventListener('submit', handleFormSubmit);

    document.getElementById('student-is-minor').addEventListener('change', (e) => {
      const responsibleFields = document.getElementById('responsible-fields');
      if (e.target.checked) {
        responsibleFields.classList.remove('hidden');
      } else {
        responsibleFields.classList.add('hidden');
      }
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filteredStudents = allStudents.filter(student =>
        student.name.toLowerCase().includes(searchTerm) ||
        student.email.toLowerCase().includes(searchTerm)
      );
      renderTable(filteredStudents, allClass);
    });

    await loadStudents();
  }
};

export default StudentList;