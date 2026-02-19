// Importações atualizadas
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === ATENÇÃO: COLOQUE SUAS CREDENCIAIS AQUI ===
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "jitakyoapp.firebaseapp.com",
    projectId: "jitakyoapp",
    storageBucket: "jitakyoapp.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementos da DOM
const video = document.getElementById('webcam');
const videoContainer = document.getElementById('video-container');
const statusText = document.getElementById('status-text');
const statusCard = document.getElementById('status-card');
const studentSelect = document.getElementById('student-select');
const captureBtn = document.getElementById('capture-btn');
const resultMessage = document.getElementById('result-message');

let isModelLoaded = false;
let currentStream = null;

// 1. Inicia o carregamento dos modelos de IA
async function loadModels() {
    try {
        const MODEL_URL = '/models'; 
        
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        isModelLoaded = true;
        updateStatus("Modelos carregados! A iniciar câmara...", "green");
        startVideo();
        // Carrega os alunos assim que os modelos carregam
        loadStudents();
    } catch (error) {
        console.error("Erro ao carregar modelos do FaceAPI:", error);
        updateStatus("Erro ao carregar modelos. Verifique a pasta /models.", "red");
    }
}

// 2. Liga a Webcam
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;
        })
        .catch(err => {
            console.error("Erro ao aceder à webcam:", err);
            updateStatus("Câmara bloqueada ou não encontrada.", "red");
        });
}

// 3. Desenha o rastreamento no vídeo ao vivo
video.addEventListener('playing', () => {
    // Atraso intencional mínimo para garantir que o vídeo tem dimensões reais
    setTimeout(() => {
        // Verifica se as dimensões reais do vídeo existem antes de criar o canvas
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const canvas = faceapi.createCanvasFromMedia(video);
        videoContainer.append(canvas);
        
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        // Loop de deteção em tempo real
        setInterval(async () => {
            if (!isModelLoaded) return;

            const detection = await faceapi.detectSingleFace(video).withFaceLandmarks();
            
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                const resizedDetection = faceapi.resizeResults(detection, displaySize);
                faceapi.draw.drawDetections(canvas, resizedDetection);
            }
        }, 100);
    }, 500); // Aguarda meio segundo após a câmara ligar
});

// 4. Carrega a lista de alunos do Firestore
async function loadStudents() {
    try {
        // Removida a dependência de Auth para testes práticos
        const querySnapshot = await getDocs(collection(db, "students"));
        studentSelect.innerHTML = '<option value="">Selecione um aluno...</option>';
        
        querySnapshot.forEach((doc) => {
            const student = doc.data();
            const hasFace = student.faceDescriptor ? ' (✓ Biometria OK)' : '';
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${student.name || student.email}${hasFace}`;
            studentSelect.appendChild(option);
        });

        studentSelect.disabled = false;
        updateStatus("Sistema pronto. Selecione o aluno e posicione o rosto.", "green");
    } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        updateStatus("Erro ao ligar à base de dados. Verifique as regras do Firestore.", "red");
    }
}

// Habilita o botão de capturar
studentSelect.addEventListener('change', (e) => {
    if (e.target.value !== "") {
        captureBtn.disabled = false;
        captureBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        captureBtn.disabled = true;
        captureBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
});

// 5. Captura a face
captureBtn.addEventListener('click', async () => {
    const studentId = studentSelect.value;
    if (!studentId) return;

    captureBtn.disabled = true;
    captureBtn.innerHTML = 'A processar...';

    try {
        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            showMessage("Rosto não detetado. Olhe diretamente para a câmara e tente novamente.", "error");
            resetCaptureButton();
            return;
        }

        const faceDescriptorArray = Array.from(detection.descriptor);

        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
            faceDescriptor: faceDescriptorArray,
            updatedAt: new Date()
        });

        showMessage("Biometria guardada com sucesso!", "success");
        setTimeout(() => loadStudents(), 1000);

    } catch (error) {
        console.error("Erro ao guardar biometria:", error);
        showMessage("Erro ao guardar os dados. Tente novamente.", "error");
    } finally {
        resetCaptureButton();
    }
});

// UI
function updateStatus(message, color) {
    statusText.textContent = message;
    statusCard.className = `p-4 rounded border-l-4 ${color === 'red' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'}`;
}

function showMessage(msg, type) {
    resultMessage.textContent = msg;
    resultMessage.className = `p-3 rounded text-sm text-center font-bold block mt-4 ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    resultMessage.classList.remove('hidden');
    setTimeout(() => resultMessage.classList.add('hidden'), 5000);
}

function resetCaptureButton() {
    captureBtn.disabled = false;
    captureBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        Capturar Rosto
    `;
}

window.addEventListener('load', loadModels);