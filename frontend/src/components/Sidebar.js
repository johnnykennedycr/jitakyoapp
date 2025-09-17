// Definição de todos os links possíveis e quais perfis podem vê-los
const navLinks = [
    { text: 'Dashboard', href: '/admin/dashboard', roles: ['admin', 'super_admin', 'receptionist'] },
    { text: 'Professores', href: '/admin/teachers', roles: ['admin', 'super_admin'] },
    { text: 'Alunos', href: '/admin/students', roles: ['admin', 'super_admin', 'receptionist'] },
    { text: 'Turmas', href: '/admin/classes', roles: ['admin', 'super_admin', 'receptionist'] },
    { text: 'Financeiro', href: '/admin/financial', roles: ['admin', 'super_admin', 'receptionist'] },
    { text: 'Gerenciar Usuários', href: '/admin/users', roles: ['super_admin'] },
    
    // Links para Professores
    { text: 'Meu Dashboard', href: '/teacher/dashboard', roles: ['teacher'] },
    { text: 'Minhas Turmas', href: '/teacher/classes', roles: ['teacher'] },
    { text: 'Notificar Turma', href: '/teacher/notify', roles: ['teacher'] },

    // Links para Alunos
    { text: 'Meu Dashboard', href: '/student/dashboard', roles: ['student'] },
    { text: 'Meu Financeiro', href: '/student/financials', roles: ['student'] },
    { text: 'Notificações', href: '/student/notifications', roles: ['student'] },
];

/**
 * Cria e renderiza o menu lateral com base no perfil do usuário.
 * @param {object} user - O objeto do usuário logado, contendo a propriedade 'role'.
 * @returns {string} - O HTML do menu lateral.
 */
export function createSidebar(user) {
    if (!user || !user.role) {
        return ''; // Retorna vazio se não houver usuário ou perfil
    }

    // Filtra os links para mostrar apenas aqueles que o perfil do usuário permite
    const accessibleLinks = navLinks.filter(link => link.roles.includes(user.role));

    return `
        <nav class="sidebar-nav">
            <h3>Olá, ${user.name}!</h3>
            <hr>
            <ul>
                ${accessibleLinks.map(link => `
                    <li>
                        <a href="${link.href}" data-navigo>${link.text}</a>
                    </li>
                `).join('')}
            </ul>
            <hr>
            <button id="logout-button">Sair</button>
        </nav>
    `;
}