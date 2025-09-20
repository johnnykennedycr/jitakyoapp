import { getUserProfile } from "../auth/userState.js";

// Agora a propriedade 'icon' aponta para o caminho do seu arquivo SVG
const navLinks = [
    { 
        text: 'Dashboard', 
        href: '/admin/dashboard', 
        roles: ['admin', 'super_admin'],
        icon: '/assets/icons/dashboard.svg'
    },
    { 
        text: 'Professores', 
        href: '/admin/teachers', 
        roles: ['admin', 'super_admin'],
        icon: '/assets/icons/professor.svg'
    },
    { 
        text: 'Alunos', 
        href: '/admin/students', 
        roles: ['admin', 'super_admin'],
        icon: '/assets/icons/alunos.svg'
    },
    { 
        text: 'Turmas', 
        href: '/admin/classes', 
        roles: ['admin', 'super_admin'],
        icon: '/assets/icons/turmas.svg'
    },
    { 
        text: 'Financeiro', 
        href: '/admin/financial', 
        roles: ['admin', 'super_admin'],
        icon: '/assets/icons/financeiro.svg'
    },
    { 
        text: 'Sair', 
        href: '#', 
        roles: ['admin', 'super_admin', 'teacher', 'student'], 
        id: 'logout-button',
        // Para o ícone de 'Sair', podemos manter o SVG inline ou criar um arquivo para ele também
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
    }
];

export function createSidebar() {
    const user = getUserProfile();
    if (!user) return '';

    const accessibleLinks = navLinks.filter(link => link.roles.includes(user.role));

    return `
        <nav class="
            bg-slate-800 text-white 
            w-full md:w-64 md:h-full md:p-4 md:flex-shrink-0
        ">
            <div class="hidden md:block p-4">
                <h3 class="text-xl font-bold">Olá, ${user.name}!</h3>
                <hr class="my-4 border-slate-600">
            </div>
            <ul class="
                flex justify-around items-center md:flex-col md:items-stretch
                h-full
            ">
                ${accessibleLinks.map(link => {
                    const idAttr = link.id ? `id="${link.id}"` : '';
                    // Usamos uma tag <object> para carregar o SVG, o que nos permite estilizá-lo via CSS se necessário
                    const iconHtml = link.icon.startsWith('<svg') 
                        ? link.icon 
                        : `<object data="${link.icon}" type="image/svg+xml" class="w-6 h-6 pointer-events-none"></object>`;

                    return `
                        <li>
                            <a href="${link.href}" ${idAttr} data-navigo class="
                                flex flex-col md:flex-row items-center justify-center md:justify-start
                                p-3 md:p-2 rounded-lg
                                hover:bg-slate-700 transition-colors
                                text-sm text-center md:text-left
                            ">
                                ${iconHtml}
                                <span class="mt-1 md:mt-0 md:ml-3">${link.text}</span>
                            </a>
                        </li>
                    `
                }).join('')}
            </ul>
        </nav>
    `;
}

