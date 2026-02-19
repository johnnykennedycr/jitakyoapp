import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';
import { loadFaceApiModels, getFaceDescriptor } from '../lib/faceService.js';

// --- FUNÇÕES AUXILIARES E DE FORMULÁRIO ---
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

async function openStudentForm(studentId = null) {
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
                        <span>${classMap[e.class_id]?.name || 'N/A'} (Desconto: R$ ${e.discount_amount || 0}, Venc: dia ${e.due_day || 'N/A'})</span>
                        <button type="button" data-action="remove-enrollment" data-enrollment-id="${e.id}" class="bg-red-500 text-white px-2 py-1 text-xs rounded">Remover</button>
                    </div>`).join('') : '<p class="text-sm text-gray-500">Nenhuma matrícula ativa.</p>'}
            </div>
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Matricular em Nova Turma</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <select name="new_class_id" class="p-2 border rounded-md flex-grow"><option value="">Selecione uma turma</option>${availableClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
                <input type="number" step="0.01" name="new_discount" placeholder="Desconto (R$)" class="p-2 border rounded-md">
                <input type="number" name="new_due_day" placeholder="Venc. (dia)" min="1" max="31" class="p-2 border rounded-md">
            </div>
            <div class="text-right mt-2">
                <button type="button" data-action="add-enrollment" data-student-id="${studentId}" class="bg-blue-500 text-white px-3 py-2 rounded-md">Adicionar Matrícula</button>
            </div>
            ` : `
            <hr class="my-4"><h4 class="text-lg font-medium mb-2">Matricular em Turmas (Opcional)</h4>
            <div class="space-y-2">
                ${allClasses.map(c => `
                    <div class="p-2 border rounded">
                        <label class="flex items-center"><input type="checkbox" name="class_enroll" value="${c.id}" data-fee="${c.default_monthly_fee}" class="mr-2">
                            <span>${c.name} - Base: R$ ${c.default_monthly_fee}</span></label>
                        <div class="enrollment-details hidden mt-2 pl-6 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input type="number" step="0.01" name="discount_amount" placeholder="Desconto (R$)" class="p-2 border rounded-md w-full">
                            <input type="number" name="due_day" placeholder="Dia do Vencimento (padrão: ${c.default_due_day || 10})" min="1" max="31" class="p-2 border rounded-md w-full">
                            <input type="text" name="discount_reason" placeholder="Motivo do Desconto" class="p-2 border rounded-md w-full md:col-span-2">
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

async function handleDeleteClick(studentId, studentName) {
    showModal(`Confirmar Exclusão`, `<p>Tem certeza que deseja deletar <strong>${studentName}</strong>?</p>
             <div class="text-right mt-6">
                    <button data-action="cancel-delete" class="bg-gray-300 px-4 py-2 rounded-md mr-2">Cancelar</button>
                    <button data-action="confirm-delete" data-student-id="${studentId}" class="bg-red-600 text-white px-4 py-2 rounded-md">Confirmar</button></div>`);
}

// --- FUNÇÃO PARA ABRIR CÂMERA E REGISTRAR FACE ---
async function openFaceRegistration(studentId, studentName) {
    showModal(`Cadastrar Face: ${studentName}`, `
        <div class="flex flex-col items-center">
            <p class="mb-4 text-sm text-gray-600">Posicione o rosto do aluno no centro da câmera. Aguarde o modelo carregar.</p>
            <div class="relative w-full max-w-sm bg-black rounded-lg overflow-hidden aspect-[4/3]">
                <video id="face-video" autoplay muted playsinline class="w-full h-full object-cover transform scale-x-[-1]"></video>
                <div id="face-overlay" class="absolute inset-0 flex items-center justify-center text-white font-bold bg-black bg-opacity-50 text-center px-4">Carregando IA...</div>
            </div>
            <div class="mt-4 flex gap-2">
                <button data-action="capture-face" class="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                    Capturar Rosto
                </button>
                <button data-action="close-camera" class="bg-gray-400 text-white px-4 py-2 rounded-full">Cancelar</button>
            </div>
            <p id="face-status" class="mt-2 text-sm font-medium text-orange-500"></p>
        </div>
    `);

    const video = document.getElementById('face-video');
    const overlay = document.getElementById('face-overlay');
    const btnCapture = document.querySelector('button[data-action="capture-face"]');
    const statusText = document.getElementById('face-status');
    let stream = null;

    try {
        await loadFaceApiModels();
        overlay.classList.add('hidden');
        
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            btnCapture.disabled = false;
        };

        btnCapture.onclick = async () => {
            btnCapture.disabled = true;
            btnCapture.textContent = "Processando...";
            statusText.textContent = "Analisando rosto...";
            statusText.className = "mt-2 text-sm font-medium text-blue-500";

            try {
                const descriptor = await getFaceDescriptor(video);
                
                if (!descriptor) {
                    throw new Error("Nenhum rosto detectado. Tente melhorar a iluminação.");
                }

                const descriptorArray = Array.from(descriptor);

                const response = await fetchWithAuth(`/api/admin/students/${studentId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        user_data: { face_descriptor: descriptorArray }
                    })
                });

                if (!response.ok) throw new Error("Erro ao salvar no servidor.");

                statusText.textContent = "Rosto cadastrado com sucesso!";
                statusText.className = "mt-2 text-sm font-medium text-green-600";
                
                setTimeout(() => {
                    if (stream) stream.getTracks().forEach(track => track.stop());
                    hideModal();
                    // O renderTable() será chamado pelo evento de fechamento se necessário, 
                    // ou podemos forçar aqui se quisermos atualizar o badge "Face Cadastrada"
                    location.reload(); 
                }, 1500);

            } catch (err) {
                console.error(err);
                statusText.textContent = err.message || "Erro na captura.";
                statusText.className = "mt-2 text-sm font-medium text-red-500";
                btnCapture.disabled = false;
                btnCapture.textContent = "Tentar Novamente";
            }
        };

        document.querySelector('button[data-action="close-camera"]').onclick = () => {
             if (stream) stream.getTracks().forEach(track => track.stop());
             hideModal();
        };

    } catch (err) {
        console.error(err);
        overlay.textContent = "Erro ao acessar câmera: " + err.message;
        overlay.classList.remove('hidden');
    }
}


export async function renderStudentList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-white">Gerenciamento de Alunos</h1>
            <button data-action="add" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Adicionar Aluno</button>
        </div>
        <div id="table-container"><p class="text-white">Carregando...</p></div>`;

    const tableContainer = targetElement.querySelector('#table-container');

    const renderTable = async () => {
        showLoading();
        try {
            const response = await fetchWithAuth('/api/admin/students/');
            const students = await response.json();
            if (students.length === 0) {
                tableContainer.innerHTML = '<p class="text-white">Nenhum aluno encontrado.</p>';
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
                                        ${student.face_descriptor && student.face_descriptor.length > 0 
                                            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Face Cadastrada</span>' 
                                            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Sem Face</span>'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${(student.enrollments && student.enrollments.length > 0) ? student.enrollments.map(e => `<div>${e.class_name}</div>`).join('') : 'Nenhuma'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${(student.guardians && student.guardians.length > 0) ? student.guardians.map(g => `<div><strong>${g.name}</strong> (${g.kinship}): ${g.contact}</div>`).join('') : 'Nenhum'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex items-center justify-end space-x-2">
                                            <button data-action="face-register" data-student-id="${student.id}" data-student-name="${student.name}" class="p-2 rounded-full hover:bg-gray-200" title="Cadastrar Face">
                                                 <svg class="w-5 h-5 text-blue-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                            </button>
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
            tableContainer.innerHTML = `<p class="text-red-500">Falha ao carregar os alunos.</p>`;
        } finally {
            hideLoading();
        }
    }

    const handlePageClick = (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        const studentId = button.dataset.studentId;
        const studentName = button.dataset.studentName;
        if (action === 'add') openStudentForm();
        if (action === 'edit') openStudentForm(studentId);
        if (action === 'delete') handleDeleteClick(studentId, studentName);
        if (action === 'face-register') openFaceRegistration(studentId, studentName);
    };

    const modalBody = document.getElementById('modal-body');

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        if (form.id !== 'student-form') return;

        const studentId = form.dataset.studentId;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        
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
                
                const payload = { user_data: userData };
                const response = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });

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
                        discount_amount: parseFloat(detailsDiv.querySelector('[name="discount_amount"]').value) || 0,
                        discount_reason: detailsDiv.querySelector('[name="discount_reason"]').value || "",
                        due_day: parseInt(detailsDiv.querySelector('[name="due_day"]').value) || null,
                    });
                });
                const payload = { user_data: userData, enrollments_data: enrollmentsData };
                const response = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
                if (!response.ok) throw await response.json();
            }
            hideModal();
            await renderTable();
        } catch (error) {
            showModal('Erro ao Salvar', `<p>${error.error || 'Ocorreu uma falha.'}</p>`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar';
        }
    };

    const handleModalClick = async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.dataset.action;
        
        if (action === 'add-guardian') document.getElementById('guardians-container').insertAdjacentHTML('beforeend', createGuardianFieldHtml());
        if (action === 'remove-dynamic-entry') document.getElementById(button.dataset.target)?.remove();
        if (action === 'cancel-delete') hideModal();

        if (action === 'confirm-delete') {
            const studentIdToDelete = button.dataset.studentId;
            hideModal(); 
            showLoading();
            try { 
                const response = await fetchWithAuth(`/api/admin/students/${studentIdToDelete}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Falha ao deletar');
            } catch (error) { 
                showModal('Erro', `<p>${error.message}</p>`);
            } finally { 
                await renderTable(); 
                hideLoading(); 
            }
        }

        if (action === 'add-enrollment' || action === 'remove-enrollment') {
            e.stopPropagation();
            const studentId = document.querySelector('#student-form')?.dataset.studentId;
            const isAdding = action === 'add-enrollment';
            const url = isAdding ? '/api/admin/enrollments' : `/api/admin/enrollments/${button.dataset.enrollmentId}`;
            const method = isAdding ? 'POST' : 'DELETE';
            const body = isAdding ? {
                student_id: studentId,
                class_id: document.querySelector('[name="new_class_id"]').value,
                discount_amount: parseFloat(document.querySelector('[name="new_discount"]').value) || 0,
                due_day: parseInt(document.querySelector('[name="new_due_day"]').value) || null,
            } : null;
            if (isAdding && !body.class_id) {
                showModal('Atenção', '<p>Selecione uma turma para matricular.</p>');
                return;
            };
            showLoading();
            try { 
                const response = await fetchWithAuth(url, { method, body: body ? JSON.stringify(body) : null });
                if (!response.ok) throw await response.json();
            } catch (error) { 
                showModal('Erro', `<p>${error.error || 'Falha na operação.'}</p>`);
            } finally { 
                await openStudentForm(studentId); 
            }
        }
    };

    targetElement.addEventListener('click', handlePageClick);
    modalBody.addEventListener('click', handleModalClick);
    modalBody.addEventListener('submit', handleFormSubmit);
    
    modalBody.addEventListener('change', (e) => {
        if (e.target.name === 'class_enroll') {
            const detailsDiv = e.target.closest('.p-2').querySelector('.enrollment-details');
            detailsDiv.classList.toggle('hidden', !e.target.checked);
        }
    });

    await renderTable();

    return () => {
        targetElement.removeEventListener('click', handlePageClick);
        modalBody.removeEventListener('click', handleModalClick);
        modalBody.removeEventListener('submit', handleFormSubmit);
    };
}