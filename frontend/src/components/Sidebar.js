import { getUserProfile } from "../auth/userState.js";

const navLinks = [
    { text: 'Dashboard', href: '/admin/dashboard', roles: ['admin', 'super_admin'] },
    { text: 'Professores', href: '/admin/teachers', roles: ['admin', 'super_admin'] },
    { text: 'Alunos', href: '/admin/students', roles: ['admin', 'super_admin'] },
    { text: 'Turmas', href: '/admin/classes', roles: ['admin', 'super_admin'] },
    { text: 'Financeiro', href: '/admin/financial', roles: ['admin', 'super_admin'] },
    { text: 'Sair', href: '#', roles: ['admin', 'super_admin', 'teacher', 'student'], id: 'logout-button' }
];

export function createSidebar() {
    const user = getUserProfile();
    if (!user) return '';

    const accessibleLinks = navLinks.filter(link => link.roles.includes(user.role));

    return `
        <nav class="sidebar-nav">
            <h3>Olá, ${user.name}!</h3>
            <hr>
            <ul>
                ${accessibleLinks.map(link => {
                    const idAttr = link.id ? `id="${link.id}"` : '';
                    return `<li><a href="${link.href}" ${idAttr} data-navigo>${link.text}</a></li>`
                }).join('')}
            </ul>
        </nav>
    `;
}