const API_URL = '/api/admin'; // Caminho relativo para produção (Firebase Rewrites)
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const btnCheckin = document.getElementById('btn-checkin');
const statusOverlay = document.getElementById('status-overlay');
const statusIcon = document.getElementById('status-icon');
const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');

// 1. Iniciar Câmera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        showFeedback('error', 'Erro de Câmera', 'Verifique se a permissão foi concedida.');
    }
}

// 2. Capturar e Enviar
async function verifyAttendance() {
    if (!video.srcObject) return;

    btnCheckin.disabled = true;
    btnCheckin.innerText = "Verificando...";

    // Desenha o frame atual no canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Converte para Blob (arquivo)
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'kiosk_capture.jpg');

        try {
            const response = await fetch(`${API_URL}/attendance/kiosk/recognize`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showFeedback('success', `Bem-vindo, ${data.student_name}!`, data.message);
            } else {
                showFeedback('error', 'Não Identificado', data.message || 'Tente se aproximar mais.');
            }

        } catch (error) {
            console.error(error);
            showFeedback('error', 'Erro de Conexão', 'Não foi possível contatar o servidor.');
        } finally {
            btnCheckin.disabled = false;
            btnCheckin.innerText = "CONFIRMAR PRESENÇA";
        }
    }, 'image/jpeg', 0.9);
}

// 3. Mostrar Feedback na Tela
function showFeedback(type, title, message) {
    statusOverlay.classList.remove('hidden');
    
    if (type === 'success') {
        statusIcon.innerHTML = '✅';
        statusTitle.className = 'text-2xl font-bold text-green-500';
    } else {
        statusIcon.innerHTML = '❌';
        statusTitle.className = 'text-2xl font-bold text-red-500';
    }

    statusTitle.innerText = title;
    statusMessage.innerText = message;

    // Esconde após 4 segundos
    setTimeout(() => {
        statusOverlay.classList.add('hidden');
    }, 4000);
}

btnCheckin.addEventListener('click', verifyAttendance);
window.addEventListener('load', startCamera);