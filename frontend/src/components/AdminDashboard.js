/**
 * Renderiza o dashboard com base nos dados do usuário fornecidos.
 * @param {HTMLElement} targetElement - O elemento onde o conteúdo será inserido.
 * @param {object} user - O objeto de perfil do usuário.
 */
export function renderAdminDashboard(targetElement, user) {
    if (!user) {
        targetElement.innerHTML = `<h1 class="text-red-500">Erro: Perfil de usuário não fornecido.</h1>`;
        return;
    }

    targetElement.innerHTML = `
        <h1 class="text-3xl font-bold">Dashboard</h1>
        <p class="mt-2 text-gray-600">Bem-vindo(a) de volta, ${user.name}!</p>
    `;
}