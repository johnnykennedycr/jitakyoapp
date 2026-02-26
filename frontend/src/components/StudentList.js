/**
 * StudentList.js
 * Componente para gerenciamento de alunos, com filtros avançados, biometria facial
 * e visualização do questionário de prontidão física (PAR-Q).
 */

import { auth } from "../config/firebaseConfig.js";
import { showModal, hideModal } from "./Modal.js";
import { showLoading, hideLoading } from "./LoadingSpinner.js";
import { loadFaceApiModels, getFaceDescriptor } from '../lib/faceService.js';

// --- HELPER DE API (Firebase Token) ---
const fetchWithAuth = async (url, options = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado no Firebase.");
    
    // Obtém o token real e atualizado do Firebase (Força o refresh para evitar 401)
    const idToken = await user.getIdToken(true);
    
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}t=${timestamp}`;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        ...options.headers
    };
    
    const response = await fetch(finalUrl, { ...options, headers });
    if (response.status === 401) {
        console.error("Erro 401: Token inválido ou expirado. A sessão pode ter caído.");
    }
    if (!response.ok) throw new Error('Erro na requisição');
    return response;
};

let allStudentsCache = [];

// --- FUNÇÕES AUXILIARES ---

function calculateAge(dobString) {
    if (!dobString) return 'N/A';
    
    let birthday;
    if (typeof dobString === 'object' && dobString._seconds) {
        birthday = new Date(dobString._seconds * 1000);
    } else if (typeof dobString === 'string') {
        const parts = dobString.split('T')[0].split('-');
        if(parts.length === 3) {
            birthday = new Date(parts[0], parts[1] - 1, parts[2]); 
        } else {
            birthday = new Date(dobString);
        }
    } else {
        birthday = new Date(dobString);
    }
    
    if (isNaN(birthday.getTime())) return 'N/A';

    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const m = today.getMonth() - birthday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    return age < 0 ? 0 : age;
}

function createGuardianFieldHtml(guardian = { name: '', kinship: '', contact: '' }) {
    const fieldId = `guardian-${Date.now()}-${Math.random()}`;
    return `
        <div class="dynamic-entry grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-2 border rounded bg-white shadow-sm" id="${fieldId}">
            <input type="text" name="guardian_name" placeholder="Nome do Responsável" value="${guardian.name}" class="p-2 border border-gray-200 rounded-md outline-none focus:border-indigo-500" required>
            <input type="text" name="guardian_kinship" placeholder="Parentesco" value="${guardian.kinship}" class="p-2 border border-gray-200 rounded-md outline-none focus:border-indigo-500" required>
            <input type="text" name="guardian_contact" placeholder="Contato (Telefone)" value="${guardian.contact}" class="p-2 border border-gray-200 rounded-md outline-none focus:border-indigo-500" required>
            <button type="button" data-action="remove-dynamic-entry" data-target="${fieldId}" class="bg-red-50 text-red-600 font-bold px-3 py-1 rounded-md hover:bg-red-100 self-center transition">Remover</button>
        </div>
    `;
}

async function viewParQAnswers(studentId, studentName) {
    showLoading();
    try {
        const response = await fetchWithAuth(`/api/admin/students/${studentId}`);
        const student = await response.json();
        const parQ = student.par_q_data;

        if (!parQ) {
            return showModal(`Saúde: ${studentName}`, `<p class="p-8 text-center text-gray-500 italic">Este aluno ainda não preencheu o questionário de saúde.</p>`);
        }

        const questions = [
            { id: 'q1', text: 'Algum médico já disse que possui problema de coração e recomendou supervisão?' },
            { id: 'q2', text: 'Sente dores no peito quando pratica atividade física?' },
            { id: 'q3', text: 'No último mês, sentiu dores no peito em atividade?' },
            { id: 'q4', text: 'Apresenta desequilíbrio devido a tontura ou perda de consciência?' },
            { id: 'q5', text: 'Possui problema ósseo/articular que pode ser piorado?' },
            { id: 'q6', text: 'Toma atualmente medicamento para pressão/coração?' },
            { id: 'q7', text: 'Sabe de alguma outra razão para não praticar atividade física?' },
            { id: 'q8', text: 'Apresentou atestado com restrições desportivas?' }
        ];

        const modalHtml = `
            <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 text-left">
                <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                    <div>
                        <p class="text-[10px] uppercase font-black text-indigo-400 tracking-widest">Data da Declaração</p>
                        <p class="font-bold text-indigo-900">${parQ.filled_at || 'N/A'}</p>
                    </div>
                    <div class="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded font-bold shadow-sm tracking-widest uppercase">
                        Validado via Login
                    </div>
                </div>

                <div class="border rounded-xl overflow-hidden shadow-sm">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pergunta</th>
                                <th class="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest w-24">Resposta</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${questions.map(q => {
                                const ans = parQ.answers?.[q.id];
                                const isSim = ans === 'sim';
                                return `
                                    <tr>
                                        <td class="px-4 py-3 text-sm text-gray-700">${q.text}</td>
                                        <td class="px-4 py-3 text-center">
                                            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${isSim ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
                                                ${ans || 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 italic text-xs text-gray-500 leading-relaxed text-justify">
                    O aluno declarou através do seu acesso autenticado a veracidade das informações acima, assumindo plena responsabilidade por qualquer atividade praticada sob orientações adversas.
                </div>
            </div>
        `;

        showModal(`Saúde: ${studentName}`, modalHtml);
    } catch (e) {
        showModal("Erro", "Falha ao carregar os dados de saúde do aluno.");
    } finally {
        hideLoading();
    }
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

        const nameAndEmailHtml = studentId ? `<p class="mb-2 text-gray-600">Editando <strong>${student.name}</strong> (${student.email}).</p>` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-left">
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label><input type="text" name="name" class="p-2 border border-gray-300 rounded-lg w-full outline-none focus:border-indigo-500" required></div>
                <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" name="email" class="p-2 border border-gray-300 rounded-lg w-full outline-none focus:border-indigo-500" required></div>
            </div>`;

        const passwordFieldHtml = studentId ? `
            <div class="mb-4 text-left">
                <label class="block text-sm font-medium text-gray-700 mb-1">Nova Senha (deixe em branco para não alterar)</label>
                <input type="password" name="password" class="p-2 border border-gray-300 rounded-lg w-full outline-none focus:border-indigo-500">
            </div>` : '';

        const enrollmentsHtml = studentId ? `
            <hr class="my-6 border-gray-200"><h4 class="text-lg font-bold mb-3 text-left text-gray-800">Turmas Matriculadas</h4>
            <div id="current-enrollments-container" class="space-y-2">
                ${currentEnrollments.length > 0 ? currentEnrollments.map(e => `
                    <div class="p-3 border rounded-lg flex justify-between items-center bg-gray-50">
                        <span class="font-medium text-sm text-gray-700">${classMap[e.class_id]?.name || 'N/A'} <span class="text-gray-400 font-normal ml-2">(R$ ${e.discount_amount || 0}, dia ${e.due_day || 'N/A'})</span></span>
                        <button type="button" data-action="remove-enrollment" data-enrollment-id="${e.id}" class="bg-red-50 text-red-600 px-3 py-1 text-xs font-bold rounded hover:bg-red-100 transition">Remover</button>
                    </div>`).join('') : '<p class="text-sm text-gray-500 text-left italic">Nenhuma matrícula ativa.</p>'}
            </div>
            <hr class="my-6 border-gray-200"><h4 class="text-base font-bold mb-3 text-indigo-600 text-left">Matricular em Nova Turma</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <select name="new_class_id" class="p-2 border border-gray-300 rounded-lg flex-grow text-sm outline-none focus:border-indigo-500"><option value="">Selecione uma turma</option>${availableClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
                <input type="number" step="0.01" name="new_discount" placeholder="Desconto (R$)" class="p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500">
                <input type="number" name="new_due_day" placeholder="Venc. (dia)" min="1" max="31" class="p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500">
            </div>
            <div class="text-right mt-3">
                <button type="button" data-action="add-enrollment" data-student-id="${studentId}" class="bg-indigo-50 text-indigo-700 px-4 py-2 font-bold rounded-lg hover:bg-indigo-100 transition text-sm">Adicionar Matrícula</button>
            </div>
            ` : `
            <hr class="my-6 border-gray-200"><h4 class="text-lg font-bold mb-3 text-left text-gray-800">Matricular em Turmas (Opcional)</h4>
            <div class="space-y-3">
                ${allClasses.map(c => `
                    <div class="p-3 border border-gray-200 rounded-xl text-left bg-gray-50 hover:bg-white transition">
                        <label class="flex items-center cursor-pointer"><input type="checkbox" name="class_enroll" value="${c.id}" data-fee="${c.default_monthly_fee}" class="mr-3 w-4 h-4 text-indigo-600">
                            <span class="text-sm font-bold text-gray-800">${c.name} <span class="text-gray-500 font-normal ml-1">- Base: R$ ${c.default_monthly_fee}</span></span></label>
                        <div class="enrollment-details hidden mt-3 pl-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="number" step="0.01" name="discount_amount" placeholder="Desconto (R$)" class="p-2 border border-gray-300 rounded-lg w-full text-sm outline-none focus:border-indigo-500">
                            <input type="number" name="due_day" placeholder="Dia do Vencimento" min="1" max="31" class="p-2 border border-gray-300 rounded-lg w-full text-sm outline-none focus:border-indigo-500">
                            <input type="text" name="discount_reason" placeholder="Motivo do Desconto" class="p-2 border border-gray-300 rounded-lg w-full md:col-span-2 text-sm outline-none focus:border-indigo-500">
                        </div></div>`).join('')}</div>`;

        const guardiansHtml = (student?.guardians || []).map(createGuardianFieldHtml).join('');

        const formHtml = `<form id="student-form" data-student-id="${studentId || ''}">
                ${nameAndEmailHtml}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-left">
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label><input type="date" name="date_of_birth" value="${student?.date_of_birth?.split('T')[0] || ''}" class="p-2 border border-gray-300 rounded-lg w-full outline-none focus:border-indigo-500"></div>
                    <div><label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label><input type="text" name="phone" value="${student?.phone || ''}" class="p-2 border border-gray-300 rounded-lg w-full outline-none focus:border-indigo-500"></div></div>
                ${passwordFieldHtml}
                <hr class="my-6 border-gray-200">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-lg font-bold text-gray-800">Responsáveis</h4>
                    <button type="button" data-action="add-guardian" class="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition">+ Adicionar</button>
                </div>
                <div id="guardians-container" class="space-y-3">${guardiansHtml}</div>
                ${enrollmentsHtml}
                <div class="text-right mt-8 pt-4 border-t border-gray-100">
                    <button type="submit" class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">Salvar Aluno</button>
                </div>
            </form>`;
        
        showModal(title, formHtml);
    } catch (error) { 
        showModal('Erro', '<p>Não foi possível carregar os dados do formulário.</p>'); 
    } finally { 
        hideLoading(); 
    }
}

function openShareGuideModal(studentId, studentName, studentEmail, studentPhone) {
    showModal(`Compartilhar Guia: ${studentName}`, `
        <div class="p-4 text-center">
            <p class="mb-6 text-gray-600 text-sm text-balance">Escolha como deseja enviar o guia de instalação para o aluno.</p>
            <div class="grid grid-cols-1 gap-4">
                <button data-action="share-email" data-student-id="${studentId}" class="flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    Enviar por E-mail
                </button>
                <button data-action="share-whatsapp" data-student-name="${studentName}" data-student-phone="${studentPhone}" class="flex items-center justify-center gap-3 bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-500/20">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884 0 2.225.584 3.911 1.629 5.712l-.999 3.646 3.86-.959z"></path></svg>
                    Enviar via WhatsApp
                </button>
            </div>
        </div>
    `);
}

async function openFaceRegistration(studentId, studentName) {
    showModal(`Cadastrar Face: ${studentName}`, `
        <div class="flex flex-col items-center">
            <p class="mb-4 text-sm text-gray-600 text-center text-balance">Posicione o rosto do aluno no centro da câmera. Aguarde o modelo carregar.</p>
            <div class="relative w-full max-w-sm bg-black rounded-lg overflow-hidden aspect-[4/3] border-4 border-gray-100 shadow-inner">
                <video id="face-video" autoplay muted playsinline class="w-full h-full object-cover transform scale-x-[-1]"></video>
                <div id="face-overlay" class="absolute inset-0 flex items-center justify-center text-white font-bold bg-black bg-opacity-70 text-center px-4 italic">Iniciando IA...</div>
            </div>
            <div class="mt-4 flex gap-2">
                <button data-action="capture-face" class="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition" disabled>
                    Capturar Rosto
                </button>
                <button data-action="close-camera" class="bg-gray-400 text-white px-4 py-2 rounded-full transition hover:bg-gray-500 font-bold">Cancelar</button>
            </div>
            <p id="face-status" class="mt-2 text-sm font-medium text-blue-600"></p>
        </div>
    `);

    const video = document.getElementById('face-video');
    const overlay = document.getElementById('face-overlay');
    const btnCapture = document.querySelector('button[data-action="capture-face"]');
    const statusText = document.getElementById('face-status');
    let stream = null;

    try {
        await loadFaceApiModels();
        if (overlay) overlay.classList.add('hidden');
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => { btnCapture.disabled = false; };

        btnCapture.onclick = async () => {
            btnCapture.disabled = true;
            btnCapture.textContent = "Processando...";
            statusText.textContent = "Analisando rosto...";

            try {
                const descriptor = await getFaceDescriptor(video);
                if (!descriptor) throw new Error("Rosto não detectado. Tente melhorar a iluminação.");

                const descriptorArray = Array.from(descriptor);
                
                const response = await fetchWithAuth(`/api/admin/students/${studentId}/face`, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        user_data: { 
                            face_descriptor: descriptorArray,
                            has_face_registered: true 
                        } 
                    })
                });

                if (!response.ok) throw new Error("Erro ao salvar no servidor.");
                
                statusText.textContent = "Sucesso! Rosto cadastrado.";
                statusText.className = "mt-2 text-sm font-medium text-green-600";
                
                setTimeout(() => {
                    if (stream) stream.getTracks().forEach(track => track.stop());
                    hideModal();
                    document.getElementById('refresh-list-btn')?.click();
                }, 1500);

            } catch (err) {
                statusText.textContent = err.message || "Erro na captura.";
                statusText.className = "mt-2 text-sm font-medium text-red-500";
                btnCapture.disabled = false;
                btnCapture.textContent = "Tentar Novamente";
            }
        };

        const closeBtn = document.querySelector('button[data-action="close-camera"]');
        if (closeBtn) {
            closeBtn.onclick = () => {
                if (stream) stream.getTracks().forEach(track => track.stop());
                hideModal();
            };
        }
    } catch (err) {
        if (overlay) {
            overlay.textContent = "Erro ao acessar câmera: " + err.message;
            overlay.classList.remove('hidden');
        }
    }
}

export async function renderStudentList(targetElement) {
    targetElement.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 class="text-3xl font-extrabold text-white tracking-tight">Alunos</h1>
            <div class="flex gap-2">
                <button id="refresh-list-btn" class="bg-gray-800 text-gray-300 hover:text-white px-4 py-3 rounded-xl border border-gray-700 transition shadow-lg" title="Atualizar Dados">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
                <button data-action="add" class="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 whitespace-nowrap">Novo Aluno</button>
            </div>
        </div>

        <!-- BARRA DE FILTROS E ORDENAÇÃO -->
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div class="flex items-center gap-2 mb-4">
                <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                <h3 class="font-bold text-gray-800 tracking-tight">Filtros e Ordenação</h3>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
                <!-- Pesquisa -->
                <div class="lg:col-span-2 relative">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Pesquisar</label>
                    <input type="text" id="list-search" placeholder="Nome ou email..." 
                        class="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium">
                    <svg class="absolute left-3.5 top-[28px] w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                </div>
                
                <!-- Ordenação -->
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Ordenar por</label>
                    <select id="sort-by" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-indigo-500 outline-none p-2.5 font-medium cursor-pointer">
                        <option value="name_asc">Nome (A-Z)</option>
                        <option value="name_desc">Nome (Z-A)</option>
                        <option value="age_asc">Idade (Crescente)</option>
                        <option value="age_desc">Idade (Decrescente)</option>
                    </select>
                </div>

                <!-- Turma -->
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Turma</label>
                    <select id="filter-class" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-indigo-500 outline-none p-2.5 font-medium cursor-pointer">
                        <option value="all">Todas as Turmas</option>
                    </select>
                </div>

                <!-- Saúde (PAR-Q) -->
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Status Saúde</label>
                    <select id="filter-parq" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-indigo-500 outline-none p-2.5 font-medium cursor-pointer">
                        <option value="all">Todos</option>
                        <option value="ok">PAR-Q OK</option>
                        <option value="pending">Pendente</option>
                    </select>
                </div>

                <!-- Biometria -->
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Biometria</label>
                    <select id="filter-biometry" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-indigo-500 outline-none p-2.5 font-medium cursor-pointer">
                        <option value="all">Todas</option>
                        <option value="ok">Cadastrada</option>
                        <option value="missing">Sem Face</option>
                    </select>
                </div>

                <!-- Idade -->
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Faixa Etária</label>
                    <select id="filter-age" class="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-indigo-500 outline-none p-2.5 font-medium cursor-pointer">
                        <option value="all">Todas</option>
                        <option value="0-12">0 a 12 anos</option>
                        <option value="13-17">13 a 17 anos</option>
                        <option value="18-35">18 a 35 anos</option>
                        <option value="36+">36+ anos</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="table-container"></div>
    `;

    const tableContainer = targetElement.querySelector('#table-container');

    const updateTableDisplay = (students) => {
        if (students.length === 0) {
            tableContainer.innerHTML = '<div class="p-16 text-center text-gray-400 bg-gray-800 rounded-3xl italic">Nenhum aluno encontrado com os filtros selecionados.</div>';
            return;
        }
        tableContainer.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th class="px-6 py-4 text-left">Aluno & Identificação</th>
                            <th class="px-6 py-4 text-left">Matrículas</th>
                            <th class="px-6 py-4 text-left">Contatos / Responsável</th>
                            <th class="px-6 py-4 text-center">Saúde</th>
                            <th class="px-6 py-4 text-right">Ações de Gestão</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                        ${students.map(s => `
                            <tr class="hover:bg-gray-50/80 transition-colors group">
                                <td class="px-6 py-5">
                                    <div class="font-bold text-gray-900 text-base">${s.name}</div>
                                    <div class="text-xs text-gray-500 font-mono mt-0.5">${s.email}</div>
                                    <div class="flex items-center gap-2 mt-2">
                                        <div class="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                            ${calculateAge(s.date_of_birth)} anos
                                        </div>
                                        ${(s.face_descriptor && s.face_descriptor.length > 0) || s.has_face_registered 
                                            ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-green-100 text-green-700 uppercase tracking-wider shadow-sm border border-green-200">FACE OK</span>' 
                                            : '<span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-gray-100 text-gray-400 uppercase tracking-wider">SEM BIOMETRIA</span>'}
                                    </div>
                                </td>
                                <td class="px-6 py-5 text-sm text-gray-600">
                                    ${(s.enrollments || []).map(e => `<div class="truncate max-w-[200px] mb-1"><span class="text-indigo-400 font-bold mr-1">•</span>${e.class_name}</div>`).join('') || '<span class="text-gray-300 italic">Sem turmas</span>'}
                                </td>
                                <td class="px-6 py-5 text-sm text-gray-600">
                                    ${(s.guardians && s.guardians.length > 0) 
                                        ? s.guardians.map(g => `<div class="truncate max-w-[200px]" title="${g.name}: ${g.contact}"><strong class="text-gray-800">${g.name}</strong>: <span class="font-mono text-xs">${g.contact}</span></div>`).join('') 
                                        : `<div class="text-indigo-600 font-bold font-mono text-xs">${s.phone || 'Sem telefone'}</div>`
                                    }
                                </td>
                                <td class="px-6 py-5 text-center">
                                    ${(s.par_q_filled || s.par_q_data) 
                                        ? `<button data-action="view-parq" data-student-id="${s.id}" data-student-name="${s.name}" class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-700 uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition shadow-sm border border-indigo-100 hover:border-transparent">PAR-Q OK</button>` 
                                        : `<span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 uppercase tracking-widest border border-amber-100">Pendente</span>`}
                                </td>
                                <td class="px-6 py-5 text-right">
                                    <div class="flex justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <button data-action="send-guide" data-student-id="${s.id}" data-student-name="${s.name}" data-student-email="${s.email}" data-student-phone="${s.phone || ''}" class="p-2.5 text-orange-600 hover:bg-orange-50 hover:shadow-sm rounded-xl transition" title="Compartilhar Guia PWA">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                        </button>
                                        <button data-action="face-register" data-student-id="${s.id}" data-student-name="${s.name}" class="p-2.5 text-blue-600 hover:bg-blue-50 hover:shadow-sm rounded-xl transition" title="Cadastrar Face">
                                             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                        </button>
                                        <button data-action="edit" data-student-id="${s.id}" class="p-2.5 text-indigo-600 hover:bg-indigo-50 hover:shadow-sm rounded-xl transition" title="Editar Aluno">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </button>
                                        <button data-action="delete" data-student-id="${s.id}" data-student-name="${s.name}" class="p-2.5 text-red-500 hover:bg-red-50 hover:shadow-sm rounded-xl transition" title="Deletar Aluno">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    const populateClassFilter = () => {
        const classSelect = targetElement.querySelector('#filter-class');
        if (!classSelect) return;
        
        const classesSet = new Set();
        allStudentsCache.forEach(s => {
            if (s.enrollments) {
                s.enrollments.forEach(e => {
                    if (e.class_name && e.class_name !== 'Turma Desconhecida') {
                        classesSet.add(e.class_name);
                    }
                });
            }
        });
        
        const currentVal = classSelect.value;
        classSelect.innerHTML = '<option value="all">Todas as Turmas</option>';
        Array.from(classesSet).sort().forEach(c => {
            classSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
        classSelect.value = currentVal; 
    };

    const applyFiltersAndSort = () => {
        let result = [...allStudentsCache];

        // 1. Text Search
        const term = targetElement.querySelector('#list-search').value.toLowerCase().trim();
        if (term) {
            result = result.filter(s => 
                s.name.toLowerCase().includes(term) || 
                (s.email && s.email.toLowerCase().includes(term))
            );
        }

        // 2. PAR-Q Status (Usando o fallback par_q_data)
        const parq = targetElement.querySelector('#filter-parq').value;
        if (parq === 'ok') result = result.filter(s => s.par_q_filled || s.par_q_data);
        if (parq === 'pending') result = result.filter(s => !(s.par_q_filled || s.par_q_data));

        // 3. Biometry Status
        const bio = targetElement.querySelector('#filter-biometry').value;
        if (bio === 'ok') result = result.filter(s => (s.face_descriptor && s.face_descriptor.length > 0) || s.has_face_registered);
        if (bio === 'missing') result = result.filter(s => !((s.face_descriptor && s.face_descriptor.length > 0) || s.has_face_registered));

        // 4. Age Groups
        const ageFilter = targetElement.querySelector('#filter-age').value;
        if (ageFilter !== 'all') {
            result = result.filter(s => {
                const age = calculateAge(s.date_of_birth);
                if (age === 'N/A') return false; 
                if (ageFilter === '0-12') return age >= 0 && age <= 12;
                if (ageFilter === '13-17') return age >= 13 && age <= 17;
                if (ageFilter === '18-35') return age >= 18 && age <= 35;
                if (ageFilter === '36+') return age >= 36;
                return true;
            });
        }

        // 5. Classes
        const classFilter = targetElement.querySelector('#filter-class').value;
        if (classFilter !== 'all') {
            result = result.filter(s => s.enrollments && s.enrollments.some(e => e.class_name === classFilter));
        }

        // 6. Sorting
        const sort = targetElement.querySelector('#sort-by').value;
        result.sort((a, b) => {
            if (sort === 'name_asc') return a.name.localeCompare(b.name);
            if (sort === 'name_desc') return b.name.localeCompare(a.name);
            
            const ageA = calculateAge(a.date_of_birth);
            const ageB = calculateAge(b.date_of_birth);
            const valA = ageA === 'N/A' ? -1 : ageA;
            const valB = ageB === 'N/A' ? -1 : ageB;

            if (sort === 'age_asc') return valA - valB;
            if (sort === 'age_desc') return valB - valA;
            
            return 0;
        });

        updateTableDisplay(result);
    };

    const fetchStudents = async () => {
        showLoading();
        try {
            const response = await fetchWithAuth('/api/admin/students/');
            allStudentsCache = await response.json();
            populateClassFilter();
            applyFiltersAndSort();
        } catch (error) {
            tableContainer.innerHTML = `<p class="text-red-500 p-8 text-center bg-gray-800 rounded-xl">Erro ao sincronizar alunos do servidor.</p>`;
        } finally {
            hideLoading();
        }
    };

    const handlePageClick = (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.id === 'refresh-list-btn') {
            fetchStudents();
            return;
        }

        const { action, studentId, studentName, studentEmail, studentPhone } = button.dataset;
        
        if (action === 'add') openStudentForm();
        if (action === 'edit') openStudentForm(studentId);
        if (action === 'delete') {
            showModal(`Confirmar Exclusão`, `<p class="p-4 text-center">Tem certeza que deseja deletar <strong>${studentName}</strong>?</p>
                <div class="text-right p-4 border-t mt-4">
                    <button data-action="confirm-delete" data-student-id="${studentId}" class="bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold">Confirmar Exclusão</button>
                </div>`);
        }
        if (action === 'face-register') openFaceRegistration(studentId, studentName);
        if (action === 'send-guide') openShareGuideModal(studentId, studentName, studentEmail, studentPhone);
        if (action === 'view-parq') viewParQAnswers(studentId, studentName);
    };

    const modalBody = document.getElementById('modal-body');

    const handleModalClick = async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const { action, target, studentId, enrollmentId, studentName, studentPhone } = button.dataset;
        
        if (action === 'add-guardian') document.getElementById('guardians-container').insertAdjacentHTML('beforeend', createGuardianFieldHtml());
        if (action === 'remove-dynamic-entry') document.getElementById(target)?.remove();

        if (action === 'confirm-delete') {
            hideModal(); 
            showLoading();
            try { 
                const response = await fetchWithAuth(`/api/admin/students/${studentId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Falha ao deletar');
                await fetchStudents();
            } catch (error) { 
                alert('Erro: ' + error.message);
            } finally { 
                hideLoading(); 
            }
        }

        if (action === 'add-enrollment' || action === 'remove-enrollment') {
            const sId = document.querySelector('#student-form')?.dataset.studentId;
            const isAdding = action === 'add-enrollment';
            const url = isAdding ? '/api/admin/enrollments' : `/api/admin/enrollments/${enrollmentId}`;
            const method = isAdding ? 'POST' : 'DELETE';
            
            const newClassEl = document.querySelector('[name="new_class_id"]');
            const newDiscountEl = document.querySelector('[name="new_discount"]');
            const newDueDayEl = document.querySelector('[name="new_due_day"]');

            const body = isAdding ? {
                student_id: sId,
                class_id: newClassEl?.value,
                discount_amount: parseFloat(newDiscountEl?.value) || 0,
                due_day: parseInt(newDueDayEl?.value) || null,
            } : null;

            if (isAdding && !body.class_id) {
                alert('Por favor, selecione uma turma.');
                return;
            }
            showLoading();
            try { 
                const response = await fetchWithAuth(url, { method, body: body ? JSON.stringify(body) : null });
                if (!response.ok) throw await response.json();
                await openStudentForm(sId); 
            } catch (error) { 
                alert(error.error || 'Falha na operação de matrícula.');
            } finally {
                hideLoading();
            }
        }

        if (action === 'share-email') {
            button.disabled = true;
            button.innerText = "Enviando...";
            try {
                const res = await fetchWithAuth(`/api/admin/students/${studentId}/send-guide`, { method: 'POST' });
                if (res.ok) {
                    hideModal();
                    alert("O guia de instalação foi enviado por e-mail!");
                } else {
                    throw new Error("Erro no servidor");
                }
            } catch (err) {
                button.disabled = false;
                button.innerText = "Tentar novamente";
                console.error(err);
            }
        }

        if (action === 'share-whatsapp') {
            const phone = studentPhone.replace(/\D/g, '');
            if (!phone) return alert("O aluno não possui um número de telefone cadastrado.");
            
            const message = encodeURIComponent(`Olá ${studentName}! Aqui está o guia oficial para instalar o app da nossa academia e acompanhar seus treinos: https://aluno-jitakyoapp.web.app/instalar.html`);
            const whatsappUrl = `https://api.whatsapp.com/send?phone=55${phone}&text=${message}`;
            window.open(whatsappUrl, '_blank');
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        if (form.id !== 'student-form') return;

        const studentId = form.dataset.studentId;
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';
        }
        
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
                if (form.elements.password?.value) userData.password = form.elements.password.value;
                const response = await fetchWithAuth(url, { method, body: JSON.stringify({ user_data: userData }) });
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
                const response = await fetchWithAuth(url, { method, body: JSON.stringify({ user_data: userData, enrollments_data: enrollmentsData }) });
                if (!response.ok) throw await response.json();
            }
            hideModal();
            await fetchStudents();
        } catch (error) {
            alert(error.error || 'Falha ao salvar informações do aluno.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Aluno';
            }
        }
    };

    // Vincular Eventos
    const filterIds = ['list-search', 'sort-by', 'filter-parq', 'filter-biometry', 'filter-age', 'filter-class'];
    filterIds.forEach(id => {
        const el = targetElement.querySelector(`#${id}`);
        if (el) el.addEventListener(id === 'list-search' ? 'input' : 'change', applyFiltersAndSort);
    });

    targetElement.addEventListener('click', handlePageClick);
    
    if (modalBody) {
        modalBody.addEventListener('click', handleModalClick);
        modalBody.addEventListener('submit', handleFormSubmit);
        modalBody.addEventListener('change', (e) => {
            if (e.target.name === 'class_enroll') {
                const entry = e.target.closest('.p-2').querySelector('.enrollment-details');
                if (entry) entry.classList.toggle('hidden', !e.target.checked);
            }
        });
    }

    await fetchStudents();

    return () => {
        targetElement.removeEventListener('click', handlePageClick);
        filterIds.forEach(id => {
            const el = targetElement.querySelector(`#${id}`);
            if (el) el.removeEventListener(id === 'list-search' ? 'input' : 'change', applyFiltersAndSort);
        });
        if (modalBody) {
            modalBody.removeEventListener('click', handleModalClick);
            modalBody.removeEventListener('submit', handleFormSubmit);
        }
    };
}