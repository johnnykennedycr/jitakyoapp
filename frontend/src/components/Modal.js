// --- CRIAÇÃO E INICIALIZAÇÃO DO MODAL ---
const modalHtml = `
  <div id="app-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden z-50 p-4">
    <div id="modal-content" class="bg-white rounded-lg shadow-xl w-full max-w-2xl relative flex flex-col" style="max-height: 90vh;">
      <div class="flex justify-between items-center p-4 border-b">
        <h2 id="modal-title" class="text-2xl font-bold text-gray-800"></h2>
        <button id="modal-close-btn" class="text-gray-400 hover:text-gray-800">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div id="modal-body" class="p-6 overflow-y-auto"></div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHtml);

const modalElement = document.getElementById('app-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = document.getElementById('modal-close-btn');

// --- FUNÇÕES DE CONTROLE ---
export function showModal(title, contentHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
    modalElement.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function hideModal() {
    modalElement.classList.add('hidden');
    modalTitle.textContent = '';
    modalBody.innerHTML = '';
    document.body.style.overflow = 'auto';
}

// --- LISTENERS DE EVENTOS ---
closeButton.addEventListener('click', () => hideModal());
modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
        hideModal();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalElement.classList.contains('hidden')) {
        hideModal();
    }
});

