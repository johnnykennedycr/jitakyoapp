const modalHtml = `
  <div id="app-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden z-40 transition-opacity duration-300">
    <div id="modal-content" class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative">
      <button id="modal-close-btn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
      <h2 id="modal-title" class="text-2xl font-bold mb-4"></h2>
      <div id="modal-body"></div>
    </div>
  </div>
`;

// Adiciona o modal ao corpo do documento uma única vez
if (!document.getElementById('app-modal')) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

const modalElement = document.getElementById('app-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = document.getElementById('modal-close-btn');

const hideModal = () => {
    modalElement.classList.add('hidden');
    modalTitle.textContent = '';
    // Limpa os listeners para evitar execuções múltiplas
    const newModalBody = modalBody.cloneNode(false);
    modalBody.parentNode.replaceChild(newModalBody, modalBody);
};

closeButton.addEventListener('click', hideModal);
modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
        hideModal();
    }
});

export function showModal(title, contentHtml) {
    modalTitle.textContent = title;
    document.getElementById('modal-body').innerHTML = contentHtml; // Pega a referência mais recente
    modalElement.classList.remove('hidden');
}

export { hideModal };
