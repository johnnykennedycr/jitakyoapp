import { auth } from '../lib/firebase.js'; // Para a função de logout
import { fetchWithAuth } from '../lib/api.js'; // Para buscar dados do nosso backend

// A função 'renderDashboard' aceita o container principal da aplicação.
// A tornamos 'async' porque ela fará uma chamada de rede (fetch).
export async function renderDashboard(container) {
    // 1. Renderiza a "casca" do dashboard imediatamente com um aviso de "Carregando..."
    container.innerHTML = `
        <div class="container mx-auto p-4 text-white">
            <header class="flex justify-between items-center mb-6">
                <h1 class="text-2xl font-bold">Bem-vindo, <span id="student-name">...</span>!</h1>
                <button id="logout-button" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
                    Sair
                </button>
            </header>

            <div id="loading" class="mt-4">Carregando seus dados...</div>

            <div id="dashboard-content" class="hidden">
                <h2 class="text-xl mt-4">Suas Próximas Aulas:</h2>
                <ul id="upcoming-classes-list" class="list-disc list-inside bg-gray-800 p-4 rounded-lg mt-2">
                    </ul>
            </div>
        </div>
    `;

    // 2. Adiciona o evento de logout ao botão
    container.querySelector('#logout-button').addEventListener('click', () => {
        auth.signOut(); // O onAuthStateChanged no main.js vai cuidar do resto
    });

    // 3. Busca os dados dinâmicos da nossa API Flask de forma segura
    try {
        const data = await (await fetchWithAuth('/api/student/dashboard-data')).json();
        console.log("Dados do dashboard recebidos:", data);

        // 4. Preenche a página com os dados recebidos
        container.querySelector('#student-name').textContent = data.student_name;
        const classesList = container.querySelector('#upcoming-classes-list');
        
        if (data.upcoming_classes && data.upcoming_classes.length > 0) {
            // Limpa a lista antes de adicionar novos itens
            classesList.innerHTML = ''; 
            data.upcoming_classes.forEach(cls => {
                const li = document.createElement('li');
                li.textContent = `${cls.day} - ${cls.name} (${cls.time}) com Prof. ${cls.teacher}`;
                classesList.appendChild(li);
            });
        } else {
            classesList.innerHTML = '<li>Nenhuma aula encontrada nos próximos dias.</li>';
        }

        // 5. Esconde o "Carregando" e mostra o conteúdo principal
        container.querySelector('#loading').classList.add('hidden');
        container.querySelector('#dashboard-content').classList.remove('hidden');

    } catch (error) {
        console.error("Não foi possível carregar os dados do dashboard:", error);
        container.querySelector('#loading').textContent = 'Erro ao carregar seus dados. Tente recarregar a página.';
    }
}