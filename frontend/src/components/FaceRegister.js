import * as faceapi from 'face-api.js';
import { fetchWithAuth } from "../lib/api.js";
import { loadFaceApiModels } from '../lib/faceService.js';
import { showModal } from './Modal.js';

/**
 * Renderiza a interface de registro de face para alunos.
 */
export async function renderFaceRegister(targetElement) {
    targetElement.innerHTML = `
        <div class="p-4 md:p-8 max-w-5xl mx-auto">
            <header class="mb-8 flex justify-between items-center">
                <div>
                    <h1 class="text-white font-bold text-2xl">Cadastro Facial</h1>
                    <p class="text-gray-400">Vincule a biometria facial a um aluno</p>
                </div>
                <a href="/admin/dashboard" data-navigo class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
                    Voltar ao Dashboard
                </a>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Coluna de Busca e Seleção -->
                <div class="bg-white p-6 rounded-xl shadow-lg">
                    <h2 class="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">1. Selecione o Aluno</h2>
                    <div class="relative mb-4">
                        <input type="text" id="student-search-input" placeholder="Buscar aluno pelo nome..." 
                            class="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 px-4 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none">
                        <div id="search-results" class="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto hidden"></div>
                    </div>
                    
                    <div id="selected-student-card" class="hidden p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <p class="text-xs text-indigo-600 font-bold uppercase tracking-wider">Aluno Selecionado</p>
                        <p id="selected-student-name" class="text-xl font-bold text-indigo-900"></p>
                        <p id="selected-student-id" class="text-xs text-indigo-400 font-mono mt-1"></p>
                    </div>

                    <div id="no-selection-msg" class="text-center py-10 text-gray-400 italic">
                        Pesquise e selecione um aluno para habilitar a câmera.
                    </div>
                </div>

                <!-- Coluna de Captura -->
                <div id="capture-section" class="bg-white p-6 rounded-xl shadow-lg opacity-50 pointer-events-none transition-opacity duration-500">
                    <h2 class="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">2. Capturar Face</h2>
                    
                    <div class="relative aspect-video bg-black rounded-lg overflow-hidden border-4 border-gray-200" id="video-container">
                        <video id="register-video" autoplay muted playsinline class="w-full h-full object-cover transform scale-x-[-1]"></video>
                        <canvas id="register-canvas" class="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"></canvas>
                        
                        <div id="camera-status" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-white text-sm text-center px-4">
                            Aguardando modelos...
                        </div>
                    </div>

                    <div class="mt-6 flex flex-col gap-3">
                        <button id="btn-capture-face" disabled class="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition">
                            Registrar Biometria Facial
                        </button>
                        <p class="text-xs text-gray-500 text-center">
                            Certifique-se de que o rosto está bem iluminado e centralizado.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const searchInput = document.getElementById('student-search-input');
    const searchResults = document.getElementById('search-results');
    const selectedCard = document.getElementById('selected-student-card');
    const noSelectionMsg = document.getElementById('no-selection-msg');
    const captureSection = document.getElementById('capture-section');
    const video = document.getElementById('register-video');
    const canvas = document.getElementById('register-canvas');
    const cameraStatus = document.getElementById('camera-status');
    const captureBtn = document.getElementById('btn-capture-face');

    let selectedStudentId = null;
    let stream = null;
    let detectionInterval = null;
    let currentDescriptor = null;

    // --- Lógica de Busca (Case-Insensitive no Frontend) ---
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const term = e.target.value.trim(); // Mantemos o termo original para o envio
        
        if (term.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                // Enviamos o termo, mas no backend você deve garantir que a busca seja case-insensitive.
                // Se o backend for limitado, buscamos e filtramos aqui.
                const res = await fetchWithAuth(`/api/admin/students/search?name=${encodeURIComponent(term)}`);
                let students = await res.json();
                
                // Filtro adicional de segurança para garantir case-insensitivity se a API falhar nisso
                const lowerTerm = term.toLowerCase();
                students = students.filter(s => s.name.toLowerCase().includes(lowerTerm));

                searchResults.innerHTML = '';
                if (students.length > 0) {
                    students.forEach(s => {
                        const item = document.createElement('div');
                        item.className = "p-3 hover:bg-indigo-50 border-b last:border-0 text-gray-700 flex justify-between items-center cursor-pointer";
                        item.innerHTML = `
                            <span>${s.name}</span>
                            ${s.face_descriptor ? '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Já possui face</span>' : ''}
                        `;
                        item.onclick = () => selectStudent(s);
                        searchResults.appendChild(item);
                    });
                    searchResults.classList.remove('hidden');
                } else {
                    searchResults.innerHTML = '<div class="p-3 text-gray-400">Nenhum aluno encontrado</div>';
                    searchResults.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Erro na busca:", err);
            }
        }, 400);
    });

    async function selectStudent(student) {
        selectedStudentId = student.id;
        document.getElementById('selected-student-name').innerText = student.name;
        document.getElementById('selected-student-id').innerText = `ID: ${student.id}`;
        
        searchResults.classList.add('hidden');
        selectedCard.classList.remove('hidden');
        noSelectionMsg.classList.add('hidden');
        captureSection.classList.remove('opacity-50', 'pointer-events-none');
        
        searchInput.value = '';
        if (!stream) startCamera();
    }

    async function startCamera() {
        try {
            cameraStatus.innerText = "Carregando Modelos IA...";
            await loadFaceApiModels();
            
            cameraStatus.innerText = "Iniciando Câmera...";
            stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
                cameraStatus.classList.add('hidden');
                startDetection();
            };
        } catch (err) {
            cameraStatus.innerText = "Erro ao acessar câmera: " + err.message;
            console.error(err);
        }
    }

    function startDetection() {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        detectionInterval = setInterval(async () => {
            const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                currentDescriptor = Array.from(detection.descriptor);
                captureBtn.disabled = false;
                
                const resized = faceapi.resizeResults(detection, displaySize);
                faceapi.draw.drawDetections(canvas, resized);
            } else {
                currentDescriptor = null;
                captureBtn.disabled = true;
            }
        }, 300);
    }

    captureBtn.onclick = async () => {
        if (!selectedStudentId || !currentDescriptor) return;

        captureBtn.disabled = true;
        captureBtn.innerText = "Salvando...";

        try {
            // CORREÇÃO: Usamos a rota padrão de PUT student para evitar o 404
            // Enviamos tanto dentro de user_data quanto fora, para garantir compatibilidade com o backend
            const res = await fetchWithAuth(`/api/admin/students/${selectedStudentId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    user_data: { 
                        face_descriptor: currentDescriptor 
                    }
                })
            });

            if (res.ok) {
                showModal("Sucesso", "Biometria facial vinculada com sucesso!", "success");
                // Limpeza e Reset
                captureSection.classList.add('opacity-50', 'pointer-events-none');
                selectedCard.classList.add('hidden');
                noSelectionMsg.classList.remove('hidden');
                stopCamera();
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Erro no servidor");
            }
        } catch (err) {
            showModal("Erro", "Falha ao registrar face: " + err.message, "error");
            captureBtn.disabled = false;
            captureBtn.innerText = "Registrar Biometria Facial";
        }
    };

    function stopCamera() {
        if (detectionInterval) clearInterval(detectionInterval);
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    return () => {
        stopCamera();
    };
}