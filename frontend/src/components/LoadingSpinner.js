const spinnerHtml = `
  <div id="loading-overlay" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center hidden z-50 transition-opacity duration-300">
    <div class="text-center">
      <svg width="150" height="150" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <style>
          .belt { fill: none; stroke: #333; stroke-width: 8; stroke-linecap: round; transform-origin: 50% 50%; }
          .belt-end-1 { animation: tie-knot-1 2.5s ease-in-out infinite; }
          .belt-end-2 { animation: tie-knot-2 2.5s ease-in-out infinite; }
          @keyframes tie-knot-1 {
            0% { transform: rotate(0deg) scaleX(1); stroke-dasharray: 0 157; }
            50% { transform: rotate(180deg) scaleX(1); stroke-dasharray: 157 157; }
            50.1% { transform: rotate(180deg) scaleX(-1); }
            100% { transform: rotate(360deg) scaleX(-1); stroke-dasharray: 0 157; }
          }
          @keyframes tie-knot-2 {
            0% { transform: rotate(90deg) scaleX(1); stroke-dasharray: 0 157; }
            50% { transform: rotate(270deg) scaleX(1); stroke-dasharray: 157 157; }
            50.1% { transform: rotate(270deg) scaleX(-1); }
            100% { transform: rotate(450deg) scaleX(-1); stroke-dasharray: 0 157; }
          }
        </style>
        <circle class="belt belt-end-1" cx="50" cy="50" r="25" />
        <circle class="belt belt-end-2" cx="50" cy="50" r="25" />
      </svg>
      <p class="text-white text-lg mt-4 font-semibold">Processando...</p>
    </div>
  </div>
`;

// Adiciona o spinner ao corpo do documento uma única vez
document.body.insertAdjacentHTML('beforeend', spinnerHtml);

const overlay = document.getElementById('loading-overlay');

/** Mostra o overlay de carregamento */
export function showLoading() {
  overlay.classList.remove('hidden');
}

/** Esconde o overlay de carregamento */
export function hideLoading() {
  overlay.classList.add('hidden');
}
