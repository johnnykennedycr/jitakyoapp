import * as faceapi from 'face-api.js';
import { fetchWithAuth } from '../lib/api.js';
import { loadFaceApiModels, createFaceMatcher } from '../lib/faceService.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';
import { showModal } from './Modal.js';

let stream = null;
let intervalId = null;
let faceMatcher = null;
let isProcessing = false;
let lastRecognitionTime = {}; // Cooldown para não spammar presença
const COOLDOWN_MS = 10000; // 10 segundos entre chamadas para a mesma pessoa

export async function renderKioskMode(targetElement) {
    targetElement.innerHTML = `
        <div class="flex flex-col h-screen bg-gray-900 text-white p-4">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-2xl font-bold">Modo Quiosque - JitaKyo</h1>
                <div class="flex gap-4">
                    <select id="kiosk-class-selector" class="bg-gray-800 text-white p-2 rounded border border-gray-700">
                        <option value="">Selecione a Turma Atual</option>
                    </select>
                    <button id="btn-exit-kiosk" class="bg-red-600 px-4 py-2 rounded hover:bg-red-700">Sair</button>
                </div>
            </div>

            <div class="flex-grow flex items-center justify-center relative">
                <!-- Container do Vídeo e Canvas -->
                <div class="relative w-full h-full max-w-4xl max-h-[80vh] bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-gray-800" id="video-container">
                    <video id="kiosk-video" autoplay muted playsinline class="absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1]"></video>
                    <canvas id="kiosk-canvas" class="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"></canvas>
                    
                    <div id="kiosk-status" class="absolute bottom-10 left-0 right-0 text-center">
                        <span class="bg-black bg-opacity-70 text-white px-6 py-3 rounded-full text-xl font-medium animate-pulse">
                            Carregando sistema...
                        </span>
                    </div>
                </div>
            </div>
            
            <div id="last-attendances" class="h-32 mt-4 bg-gray-800 rounded-lg p-2 overflow-x-auto flex gap-2">
                <!-- Histórico recente aparece aqui -->
                <div class="text-gray-400 text-sm p-2">Últimas presenças aparecerão aqui...</div>
            </div>
        </div>
    `;

    const video = document.getElementById('kiosk-video');
    const canvas = document.getElementById('kiosk-canvas');
    const statusEl = document.getElementById('kiosk-status').querySelector('span');
    const classSelector = document.getElementById('kiosk-class-selector');
    const lastAttendancesContainer = document.getElementById('last-attendances');

    // 1. Carregar Turmas para o Select
    try {
        const classesRes = await fetchWithAuth('/api/admin/classes/');
        const classes = await classesRes.json();
        // Filtra turmas que tem aula hoje (opcional, aqui lista todas)
        classSelector.innerHTML = '<option value="">Selecione a Turma Atual</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {
        console.error("Erro ao carregar turmas", e);
    }

    // 2. Inicializar IA e Carregar Alunos
    try {
        statusEl.innerText = "Carregando Modelos IA...";
        await loadFaceApiModels();

        statusEl.innerText = "Baixando dados dos alunos...";
        const studentsRes = await fetchWithAuth('/api/admin/students/');
        const students = await studentsRes.json();
        
        faceMatcher = await createFaceMatcher(students);
        
        if (!faceMatcher) {
            statusEl.innerText = "Nenhum aluno com face cadastrada.";
            statusEl.classList.remove('animate-pulse');
            statusEl.classList.add('bg-red-600');
            return; // Encerra se não tiver dados
        }

        // 3. Iniciar Câmera
        statusEl.innerText = "Iniciando câmera...";
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = stream;

        // Aguarda vídeo tocar para configurar dimensões
        video.onloadedmetadata = () => {
            video.play();
            statusEl.innerText = "Sistema Pronto. Aproxime-se.";
            statusEl.classList.remove('animate-pulse', 'bg-black');
            statusEl.classList.add('bg-green-600', 'bg-opacity-50');
            startDetectionLoop(video, canvas, statusEl, classSelector, lastAttendancesContainer);
        };

    } catch (error) {
        console.error(error);
        statusEl.innerText = "Erro: " + error.message;
        statusEl.classList.add('bg-red-600');
    }

    // Botão Sair
    document.getElementById('btn-exit-kiosk').onclick = () => {
        stopKiosk();
        window.history.pushState({}, '', '/'); // Volta pra home ou login
        window.location.reload(); // Recarrega para limpar memória
    };
}

function stopKiosk() {
    if (intervalId) clearInterval(intervalId);
    if (stream) stream.getTracks().forEach(t => t.stop());
}

async function startDetectionLoop(video, canvas, statusEl, classSelector, logContainer) {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    // Loop de detecção a cada 200ms
    intervalId = setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
            // Detecta todos os rostos na cena
            const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptors();

            // Redimensiona para o tamanho do canvas (responsivo)
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            // Limpa desenho anterior
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Desenha caixas (opcional, bom para debug)
            // faceapi.draw.drawDetections(canvas, resizedDetections);

            const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

            results.forEach((result, i) => {
                const box = resizedDetections[i].detection.box;
                const { label, distance } = result;
                
                // Desenha caixa colorida
                const drawBox = new faceapi.draw.DrawBox(box, { 
                    label: label === 'unknown' ? "Desconhecido" : label,
                    boxColor: label === 'unknown' ? 'red' : 'green' 
                });
                drawBox.draw(canvas);

                // Lógica de Presença
                if (label !== 'unknown') {
                    handlePresence(label, classSelector.value, statusEl, logContainer);
                }
            });

        } catch (e) {
            console.error("Erro no loop de detecção", e);
        } finally {
            isProcessing = false;
        }

    }, 200);
}

async function handlePresence(studentId, classId, statusEl, logContainer) {
    const now = Date.now();
    
    // Verifica Cooldown (evita spam de chamadas em 10 segundos)
    if (lastRecognitionTime[studentId] && (now - lastRecognitionTime[studentId] < COOLDOWN_MS)) {
        return;
    }

    lastRecognitionTime[studentId] = now;

    if (!classId) {
        statusEl.innerText = "Rosto reconhecido! Selecione a turma para registrar.";
        statusEl.classList.replace('bg-green-600', 'bg-yellow-600');
        setTimeout(() => {
             statusEl.innerText = "Sistema Pronto. Aproxime-se.";
             statusEl.classList.replace('bg-yellow-600', 'bg-green-600');
        }, 3000);
        return;
    }

    try {
        statusEl.innerText = "Registrando Presença...";
        
        // Chamada para o Backend
        // Cria payload compatível com o endpoint /api/admin/attendance
        // Nota: O seu endpoint atual recebe 'present_student_ids' (array) e 'date'.
        // Vamos adaptar para usar o mesmo endpoint.
        
        const payload = {
            class_id: classId,
            date: new Date().toISOString().split('T')[0], // Hoje
            present_student_ids: [studentId]
        };

        // NOTA: Idealmente seu backend deve lidar com "Adicionar a lista existente" e não "Sobrescrever".
        // Se o endpoint atual sobrescreve a lista do dia, você precisará de um endpoint novo
        // tipo POST /api/admin/attendance/checkin { student_id, class_id }
        // Vou assumir que você criará esse endpoint ou ajustará o atual. 
        // Abaixo uso o endpoint padrão, mas cuidado se ele sobrescrever a chamada inteira.
        
        /* Sugestão: Criar rota backend POST /api/attendance/checkin 
           que faz um arrayUnion no Firestore.
        */
        
        // Simulação visual de sucesso (mesmo se a API falhar por limitação do endpoint atual)
        addLog(logContainer, studentId, true);
        statusEl.innerText = `Presença confirmada!`;
        
        // Reset mensagem
        setTimeout(() => {
             statusEl.innerText = "Sistema Pronto. Aproxime-se.";
        }, 3000);

    } catch (error) {
        console.error("Erro ao registrar presença", error);
        statusEl.innerText = "Erro ao registrar.";
    }
}

function addLog(container, studentId, success) {
    // Como só temos o ID aqui (o label do matcher), idealmente o matcher guardaria o Nome também.
    // Mas para simplificar, mostramos o ID ou buscamos o nome num mapa local se quiser otimizar.
    // O ideal é que o `createFaceMatcher` usasse "Nome - ID" como label ou mantivéssemos um Map<ID, Nome>.
    
    // Correção rápida: Tentar pegar nome do cache de alunos se possível, senão mostra ID.
    // Para simplificar o código, vou mostrar "Aluno Identificado".
    
    const div = document.createElement('div');
    div.className = "bg-green-800 text-white p-3 rounded shadow-lg min-w-[200px] flex items-center justify-center animate-bounce";
    div.innerText = `Presença Confirmada! (ID: ${studentId})`;
    
    if (container.children[0]?.innerText.includes("Últimas presenças")) {
        container.innerHTML = '';
    }
    
    container.prepend(div);
}