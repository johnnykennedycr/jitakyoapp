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
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
};

export function createSidebar() {
    const user = getUserProfile();
    if (!user) return '';

    const accessibleLinks = navLinks.filter(link => link.roles.includes(user.role));

    return `
        <!-- Mobile Sidebar -->
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 text-white flex justify-around p-2 z-40">
             ${accessibleLinks.map(link => `
                <a href="${link.href}" data-navigo class="flex flex-col items-center text-xs p-1 rounded-md hover:bg-slate-700">
                    <img src="${link.icon}" class="sidebar-icon w-6 h-6" alt="${link.text}"/>
                    <span>${link.text}</span>
                </a>
            `).join('')}
             <a href="${logoutLink.href}" id="${logoutLink.id}-mobile" class="flex flex-col items-center text-xs p-1 rounded-md hover:bg-slate-700">
                ${logoutLink.icon}
                <span>${logoutLink.text}</span>
            </a>
        </nav>

        <!-- Desktop Sidebar -->
        <nav class="hidden md:flex flex-col bg-slate-800 text-white w-64 h-full p-4">
            <div class="sidebar-header flex items-center justify-between pb-4 border-b border-slate-600">
                <div class="flex items-center">
                    <img src="/assets/logo-horizontal.png" alt="Logo" class="h-8 sidebar-logo">
                    
                </div>
                <button id="sidebar-toggle-btn" class="p-1 rounded-md hover:bg-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
            </div>
            
            <ul class="flex flex-col mt-4 flex-grow">
                ${accessibleLinks.map(link => `
                    <li>
                        <a href="${link.href}" data-navigo class="sidebar-link flex items-center justify-start p-2 rounded-lg hover:bg-slate-700">
                             <img src="${link.icon}" class="sidebar-icon" alt="${link.text}"/>
                             <span class="ml-3 sidebar-text">${link.text}</span>
                        </a>
                    </li>
                `).join('')}
            </ul>

            <div class="mt-auto pt-4 border-t border-slate-600">
                 <a href="${logoutLink.href}" id="${logoutLink.id}" class="sidebar-link flex items-center justify-start p-2 rounded-lg hover:bg-slate-700">
                     ${logoutLink.icon}
                     <span class="ml-3 sidebar-text">${logoutLink.text}</span>
                 </a>
            </div>
        </nav>
    `;
}

