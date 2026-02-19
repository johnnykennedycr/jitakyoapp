import * as faceapi from 'face-api.js';

let modelsLoaded = false;

/**
 * Carrega os modelos do Face-API.js da pasta pública.
 * O caminho '/models' aponta para public/models no Vite/Firebase.
 */
export async function loadFaceApiModels() {
    if (modelsLoaded) return;

    try {
        // Usamos caminhos absolutos para evitar erros em rotas virtuais
        const MODEL_URL = '/models'; 
        
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;
        console.log("Modelos do Face-API carregados com sucesso.");
    } catch (error) {
        console.error("Erro ao carregar modelos do Face-API:", error);
        throw new Error("Não foi possível carregar os modelos de reconhecimento facial.");
    }
}

/**
 * Cria um FaceMatcher baseado nos descritores dos alunos vindos do banco.
 * @param {Array} students - Lista de alunos com o campo face_descriptor.
 */
export async function createFaceMatcher(students) {
    const labeledDescriptors = students
        .filter(s => s.face_descriptor && Array.isArray(s.face_descriptor))
        .map(s => {
            // Converte o array simples de volta para Float32Array que o face-api exige
            const descriptor = new Float32Array(s.face_descriptor);
            return new faceapi.LabeledFaceDescriptors(s.id, [descriptor]);
        });

    if (labeledDescriptors.length === 0) return null;

    return new faceapi.FaceMatcher(labeledDescriptors, 0.6);
}