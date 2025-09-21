// --- CRIAÇÃO E INICIALIZAÇÃO DO MODAL ---
// Este bloco cria o HTML do modal e o anexa ao corpo da página uma única vez.
const modalHtml = `
  <div id="app-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-center items-start hidden z-50 overflow-y-auto pt-10 pb-10">
    <div id="modal-content" class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl relative transform transition-all">
      <button id="modal-close-btn" class="absolute top-3 right-3 text-gray-400 hover:text-gray-800">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      <h2 id="modal-title" class="text-2xl font-bold mb-4 text-gray-800"></h2>
      <div id="modal-body"></div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHtml);

// Seleciona os elementos do modal para manipulação
const modalElement = document.getElementById('app-modal');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = document.getElementById('modal-close-btn');

// --- FUNÇÕES DE CONTROLE DO MODAL ---

/**
 * Exibe o modal com um título e conteúdo HTML específicos.
 * @param {string} title - O título a ser exibido no cabeçalho do modal.
 * @param {string} contentHtml - O conteúdo HTML a ser inserido no corpo do modal.
 */
export function showModal(title, contentHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
    modalElement.classList.remove('hidden');
    // Impede a rolagem da página principal enquanto o modal está aberto
    document.body.style.overflow = 'hidden';
}

/**
 * Esconde o modal e limpa seu conteúdo.
 */
export function hideModal() {
    modalElement.classList.add('hidden');
    modalTitle.textContent = '';
    modalBody.innerHTML = '';
    // Restaura a rolagem da página principal
    document.body.style.overflow = 'auto';
}

// --- LISTENERS DE EVENTOS PARA FECHAR O MODAL ---

// Fecha ao clicar no botão 'X'
closeButton.addEventListener('click', () => hideModal());

// Fecha ao clicar fora da área de conteúdo do modal
modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) {
        hideModal();
    }
});

// Fecha ao pressionar a tecla 'Escape'
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalElement.classList.contains('hidden')) {
        hideModal();
    }
});

