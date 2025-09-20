import { getUserProfile } from "../auth/userState.js";

// Adicionamos uma propriedade 'icon' com o SVG para cada link
const navLinks = [
    { 
        text: 'Dashboard', 
        href: '/admin/dashboard', 
        roles: ['admin', 'super_admin'],
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10M18 20V4M6 20V16"/></svg>`
    },
    { 
        text: 'Professores', 
        href: '/admin/teachers', 
        roles: ['admin', 'super_admin'],
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`
    },
    { 
        text: 'Alunos', 
        href: '/admin/students', 
        roles: ['admin', 'super_admin'],
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    },
    { 
        text: 'Turmas', 
        href: '/admin/classes', 
        roles: ['admin', 'super_admin'],
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3zM9 9h6v6H9z"/></svg>`
    },
    { 
        text: 'Financeiro', 
        href: '/admin/financial', 
        roles: ['admin', 'super_admin'],
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`
    },
    { 
        text: 'Sair', 
        href: '#', 
        roles: ['admin', 'super_admin', 'teacher', 'student'], 
        id: 'logout-button',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
    }
];

export function createSidebar() {
    const user = getUserProfile();
    if (!user) return '';

    const accessibleLinks = navLinks.filter(link => link.roles.includes(user.role));

    return `
        <!-- O contêiner da nav usa classes responsivas do Tailwind -->
        <nav class="
            bg-slate-800 text-white 
            w-full md:w-64 md:h-full md:p-4 md:flex-shrink-0
        ">
            <!-- Cabeçalho visível apenas em telas grandes -->
            <div class="hidden md:block p-4">
                <h3 class="text-xl font-bold">Olá, ${user.name}!</h3>
                <hr class="my-4 border-slate-600">
            </div>

            <!-- A lista de links agora é um flex container -->
            <ul class="
                flex justify-around items-center md:flex-col md:items-stretch
                h-full
            ">
                ${accessibleLinks.map(link => {
                    const idAttr = link.id ? `id="${link.id}"` : '';
                    return `
                        <li>
                            <a href="${link.href}" ${idAttr} data-navigo class="
                                flex flex-col md:flex-row items-center justify-center md:justify-start
                                p-3 md:p-2 rounded-lg
                                hover:bg-slate-700 transition-colors
                                text-sm text-center md:text-left
                            ">
                                ${link.icon}
                                <span class="mt-1 md:mt-0 md:ml-3">${link.text}</span>
                            </a>
                        </li>
                    `
                }).join('')}
            </ul>
        </nav>
    `;
}
