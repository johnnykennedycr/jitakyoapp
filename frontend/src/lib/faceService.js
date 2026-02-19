import * as faceapi from 'face-api.js';

// Configuração: Caminho onde você salvou os arquivos na pasta public
const MODEL_URL = '/models';

let isModelLoaded = false;

export async function loadFaceApiModels() {
    if (isModelLoaded) return;

    try {
        console.log("Carregando modelos de reconhecimento facial...");
        await Promise.all([
            // Carrega o detector SSD (mais preciso que o TinyFace)
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), 
            // Carrega o detector de pontos de referência (olhos, nariz, boca)
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            // Carrega o modelo que transforma o rosto em números (descritor)
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        isModelLoaded = true;
        console.log("Modelos carregados com sucesso!");
    } catch (error) {
        console.error("Erro ao carregar modelos do face-api:", error);
        throw new Error("Falha ao carregar inteligência artificial. Verifique se a pasta /public/models existe.");
    }
}

export async function getFaceDescriptor(videoElement) {
    if (!isModelLoaded) await loadFaceApiModels();

    // Detecta um único rosto com a maior confiança
    const detection = await faceapi.detectSingleFace(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        return null; // Nenhum rosto detectado
    }

    // Retorna o array de números (descritor) e os dados de desenho
    return detection.descriptor;
}

// Cria um "Matcher" com os dados de todos os alunos
export async function createFaceMatcher(students) {
    if (!isModelLoaded) await loadFaceApiModels();

    const labeledDescriptors = students
        .filter(student => student.face_descriptor && student.face_descriptor.length > 0) // Filtra quem tem face cadastrada
        .map(student => {
            // O descritor vem do banco como um Array normal ou Object, o face-api precisa de Float32Array
            const descriptor = new Float32Array(Object.values(student.face_descriptor));
            return new faceapi.LabeledFaceDescriptors(student.id, [descriptor]);
        });

    if (labeledDescriptors.length === 0) return null;

    // 0.6 é a distância de tolerância (quanto menor, mais rigoroso)
    return new faceapi.FaceMatcher(labeledDescriptors, 0.55);
}