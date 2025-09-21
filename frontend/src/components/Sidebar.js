import { getUserProfile } from "../auth/userState.js";

const navLinks = [
    { text: 'Dashboard', href: '/admin/dashboard', roles: ['admin', 'super_admin'], icon: '/assets/icons/dashboard.svg' },
    { text: 'Professores', href: '/admin/teachers', roles: ['admin', 'super_admin'], icon: '/assets/icons/professor.svg' },
    { text: 'Alunos', href: '/admin/students', roles: ['admin', 'super_admin'], icon: '/assets/icons/alunos.svg' },
    { text: 'Turmas', href: '/admin/classes', roles: ['admin', 'super_admin'], icon: '/assets/icons/turmas.svg' },
    { text: 'Financeiro', href: '/admin/financial', roles: ['admin', 'super_admin'], icon: '/assets/icons/financeiro.svg' },
];

const logoutLink = { 
    text: 'Sair', 
    href: '#', 
    id: 'logout-button',
    // Ícone de logout como SVG inline para simplicidade
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
};

export function createSidebar() {
    const user = getUserProfile();
    if (!user) return '';

    const accessibleLinks = navLinks.filter(link => link.roles.includes(user.role));

    return `
        <!-- Mobile Sidebar -->
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-100 text-gray-800 flex justify-around p-1 z-40 border-t border-gray-300">
            ${accessibleLinks.map(link => `
                <a href="${link.href}" data-navigo class="flex flex-col items-center text-xs p-1 rounded-md hover:bg-slate-200 w-1/6">
                    <img src="${link.icon}" class="w-6 h-6 icon-filter-dark" alt="${link.text}"/>
                    <span class="mt-1">${link.text}</span>
                </a>
            `).join('')}
            <a href="${logoutLink.href}" id="${logoutLink.id}-mobile" class="flex flex-col items-center text-xs p-1 rounded-md hover:bg-slate-200 w-1/6">
                <span class="w-6 h-6">${logoutLink.icon}</span>
                <span class="mt-1">${logoutLink.text}</span>
            </a>
        </nav>

        <!-- Desktop Sidebar -->
        <nav class="hidden md:flex flex-col bg-slate-100 text-gray-800 w-64 h-full p-4 border-r border-gray-300">
            <div class="sidebar-header flex items-center justify-between pb-4 border-b border-gray-300">
                <div class="flex items-center">
                    <img src="/assets/logo-horizontal.png" alt="Logo" class="h-24 sidebar-logo">
                </div>
                <button id="sidebar-toggle-btn" class="p-1 rounded-md hover:bg-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-800"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
            </div>
            
            <ul class="flex flex-col mt-4 flex-grow">
                ${accessibleLinks.map(link => `
                    <li>
                        <a href="${link.href}" data-navigo class="sidebar-link flex items-center justify-start p-2 rounded-lg hover:bg-slate-200">
                             <img src="${link.icon}" class="w-6 h-6 icon-filter-dark" alt="${link.text}"/>
                             <span class="ml-3 sidebar-text">${link.text}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>

            <div class="mt-auto pt-4 border-t border-gray-300">
                 <a href="${logoutLink.href}" id="${logoutLink.id}" class="sidebar-link flex items-center justify-start p-2 rounded-lg hover:bg-slate-200">
                       <span class="w-6 h-6">${logoutLink.icon}</span>
                       <span class="ml-3 sidebar-text">${logoutLink.text}</span>
                 </a>
            </div>
        </nav>
    `;
}

