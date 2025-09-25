import { fetchWithAuth } from '../lib/api.js';
import { showModal, hideModal } from './Modal.js';
import { showLoading, hideLoading } from './LoadingSpinner.js';

function getStatusBadge(status) {
    switch (status) {
        case 'paid':
            return '<span class="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Pago</span>';
        case 'pending':
            return '<span class="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">Pendente</span>';
        case 'overdue':
            return '<span class="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full">Atrasado</span>';
        default:
            return '';
    }
}

function openRegisterPaymentModal(payment, onSave) {
    const today = new Date().toISOString().split('T')[0];
    const modalHtml = `
        <form id="register-payment-form" data-payment-id="${payment.id}">
            <p class="mb-4">Registrando pagamento para <strong>${payment.student_name}</strong> referente a ${payment.type}.</p>
            <div class="mb-4">
                <label class="block text-sm font-medium">Valor Pago (R$)</label>
                <input type="number" step="0.01" name="amount" value="${payment.amount}" class="p-2 border rounded-md w-full" required>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium">Data do Pagamento</label>
                <input type="date" name="payment_date" value="${today}" class="p-2 border rounded-md w-full" required>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium">Forma de Pagamento</label>
                <select name="payment_method" class="p-2 border rounded-md w-full">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Outros">Outros</option>
                </select>
            </div>
            <div class="mb-4 hidden" id="payment-method-details-container">
                <label class="block text-sm font-medium">Detalhes</label>
                <input type="text" name="payment_method_details" placeholder="Ex: Link de pagamento, etc." class="p-2 border rounded-md w-full">
            </div>
            <div class="text-right mt-6">
                <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Confirmar Pagamento</button>
            </div>
        </form>
    `;
    showModal('Registrar Pagamento', modalHtml);

    const form = document.getElementById('register-payment-form');
    const paymentMethodSelect = form.querySelector('[name="payment_method"]');
    const detailsContainer = document.getElementById('payment-method-details-container');

    paymentMethodSelect.addEventListener('change', () => {
        detailsContainer.classList.toggle('hidden', paymentMethodSelect.value !== 'Outros');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        const payload = {
            payment_id: form.dataset.paymentId,
            amount: parseFloat(form.elements.amount.value),
            payment_date: form.elements.payment_date.value,
            payment_method: form.elements.payment_method.value,
            payment_method_details: form.elements.payment_method_details.value
        };

        try {
            const response = await fetchWithAuth('/api/admin/payments', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw await response.json();
            hideModal();
            onSave(); // Recarrega a tabela
        } catch (error) {
            showModal('Erro', `<p>${error.error || 'Falha ao registrar pagamento.'}</p>`);
            submitButton.disabled = false;
            submitButton.textContent = 'Confirmar Pagamento';
        }
    });
}

async function openMiscInvoiceModal(onSave) {
    showLoading();
    try {
        const [studentsRes, classesRes] = await Promise.all([
            fetchWithAuth('/api/admin/students/'),
            fetchWithAuth('/api/admin/classes/')
        ]);

        if (!studentsRes.ok || !classesRes.ok) {
            throw new Error('Falha ao carregar dados de alunos ou turmas.');
        }

        const allStudents = await studentsRes.json();
        const allClasses = await classesRes.json();
        hideLoading();

        const modalHtml = `
            <form id="misc-invoice-form">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium">Filtrar por Turma</label>
                        <select name="class_filter" class="p-2 border rounded-md w-full">
                            <option value="all">Todas as Turmas</option>
                            ${allClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium">Buscar Aluno</label>
                        <input type="text" name="student_search" placeholder="Digite o nome do aluno..." class="p-2 border rounded-md w-full">
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium mb-2">Selecionar Alunos</label>
                    <div id="student-list-container" class="max-h-48 overflow-y-auto border rounded p-2">
                        <!-- Student list will be rendered here by JavaScript -->
                    </div>
                     <div class="mt-2">
                        <label><input type="checkbox" id="select-all-students"> Selecionar Todos</label>
                    </div>
                </div>

                <hr class="my-4">

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium">Tipo da Fatura</label>
                        <input type="text" name="invoice_type" placeholder="Ex: Exame de Faixa" class="p-2 border rounded-md w-full" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium">Valor (R$)</label>
                        <input type="number" step="0.01" name="invoice_amount" class="p-2 border rounded-md w-full" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium">Data de Vencimento</label>
                        <input type="date" name="invoice_due_date" class="p-2 border rounded-md w-full" required>
                    </div>
                </div>
                
                <div class="text-right mt-6">
                    <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Gerar Faturas</button>
                </div>
            </form>
        `;
        showModal('Gerar Fatura Avulsa', modalHtml);

        const form = document.getElementById('misc-invoice-form');
        const classFilter = form.querySelector('[name="class_filter"]');
        const studentSearch = form.querySelector('[name="student_search"]');
        const studentListContainer = form.querySelector('#student-list-container');
        const selectAllCheckbox = form.querySelector('#select-all-students');

        const renderStudentList = () => {
            const classId = classFilter.value;
            const searchTerm = studentSearch.value.toLowerCase();
            
            const filteredStudents = allStudents.filter(student => {
                const nameMatch = student.name.toLowerCase().includes(searchTerm);
                const classMatch = classId === 'all' || student.enrollments.some(e => e.class_id === classId);
                return nameMatch && classMatch;
            });

            if (filteredStudents.length === 0) {
                studentListContainer.innerHTML = '<p class="text-gray-500">Nenhum aluno encontrado.</p>';
                return;
            }

            studentListContainer.innerHTML = filteredStudents.map(student => `
                <div class="p-1">
                    <label><input type="checkbox" name="student_ids" value="${student.id}" class="mr-2"> ${student.name}</label>
                </div>
            `).join('');
        };

        classFilter.addEventListener('input', renderStudentList);
        studentSearch.addEventListener('input', renderStudentList);
        
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            studentListContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Gerando...';

            const selectedStudentIds = Array.from(form.querySelectorAll('input[name="student_ids"]:checked')).map(cb => cb.value);
            
            if (selectedStudentIds.length === 0) {
                showModal('Atenção', '<p>Selecione pelo menos um aluno.</p>');
                submitButton.disabled = false;
                submitButton.textContent = 'Gerar Faturas';
                return;
            }

            const payload = {
                student_ids: selectedStudentIds,
                type: form.elements.invoice_type.value,
                amount: parseFloat(form.elements.invoice_amount.value),
                due_date: form.elements.invoice_due_date.value,
            };

            try {
                // NOTE: This endpoint needs to be created in the backend (e.g., in admin_routes.py)
                const response = await fetchWithAuth('/api/admin/financial/generate-misc-invoice', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) throw result;

                hideModal();
                showModal('Sucesso', `<p>${result.message || 'Faturas geradas com sucesso!'}</p>`);
                onSave();
            } catch (error) {
                showModal('Erro', `<p>${error.error || 'Não foi possível gerar as faturas.'}</p>`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Gerar Faturas';
            }
        });

        renderStudentList();

    } catch (error) {
        hideLoading();
        showModal('Erro', `<p>${error.message}</p>`);
    }
}


export function renderFinancialDashboard(targetElement) {
    const today = new Date();
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth() + 1;

    const mainHtml = `
        <div class="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h1 class="text-3xl font-bold text-white">Gestão Financeira</h1>
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-2 bg-white p-2 rounded-md shadow">
                    <label for="month-filter" class="text-sm font-medium">Mês:</label>
                    <select id="month-filter" class="p-1 border rounded-md">
                        ${Array.from({ length: 12 }, (_, i) => `
                            <option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>
                                ${new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                            </option>
                        `).join('')}
                    </select>
                    <select id="year-filter" class="p-1 border rounded-md">
                        ${Array.from({ length: 5 }, (_, i) => `
                            <option value="${currentYear - i}" ${currentYear - i === currentYear ? 'selected' : ''}>
                                ${currentYear - i}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <button id="generate-misc-invoice-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700">Fatura Avulsa</button>
                <button id="generate-billings-btn" class="bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700">Gerar Cobranças</button>
            </div>
        </div>
        <div id="financial-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"></div>
        
        <div id="financial-tables-container" class="space-y-8">
            <div>
                <h2 class="text-2xl font-bold text-white mb-4">Valores Arrecadados</h2>
                <div id="paid-table-container" class="bg-white rounded-lg shadow p-4"></div>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-white mb-4">Cobranças Pendentes</h2>
                <div id="pending-table-container" class="bg-white rounded-lg shadow p-4"></div>
            </div>
        </div>
    `;
    targetElement.innerHTML = mainHtml;

    const summaryContainer = targetElement.querySelector('#financial-summary');
    const paidTableContainer = targetElement.querySelector('#paid-table-container');
    const pendingTableContainer = targetElement.querySelector('#pending-table-container');
    const monthFilter = targetElement.querySelector('#month-filter');
    const yearFilter = targetElement.querySelector('#year-filter');
    const generateBillingsBtn = targetElement.querySelector('#generate-billings-btn');
    const generateMiscInvoiceBtn = targetElement.querySelector('#generate-misc-invoice-btn');

    const fetchAndRenderData = async () => {
        showLoading();
        summaryContainer.innerHTML = '';
        paidTableContainer.innerHTML = '<p>Carregando...</p>';
        pendingTableContainer.innerHTML = '<p>Carregando...</p>';

        try {
            const year = yearFilter.value;
            const month = monthFilter.value;
            const response = await fetchWithAuth(`/api/admin/financial/status?year=${year}&month=${month}`);
            
            if (response.status === 500) {
                 const errorData = await response.json().catch(() => null);
                 throw new Error(errorData?.error || 'Não foi possível carregar os detalhes.');
            }
            if (!response.ok) throw new Error('Falha ao carregar dados financeiros.');
            
            const data = await response.json();

            summaryContainer.innerHTML = `
                <div class="bg-green-100 p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-green-800">Total Arrecadado</h3>
                    <p class="text-2xl font-bold text-green-900">R$ ${data.summary.total_paid.toFixed(2)}</p>
                </div>
                <div class="bg-yellow-100 p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-yellow-800">Pendente</h3>
                    <p class="text-2xl font-bold text-yellow-900">R$ ${data.summary.total_pending.toFixed(2)}</p>
                </div>
                <div class="bg-red-100 p-4 rounded-lg shadow">
                    <h3 class="text-sm font-medium text-red-800">Em Atraso</h3>
                    <p class="text-2xl font-bold text-red-900">R$ ${data.summary.total_overdue.toFixed(2)}</p>
                </div>
            `;

            if (data.paid_payments.length === 0) {
                paidTableContainer.innerHTML = '<p>Nenhum pagamento registrado para este período.</p>';
            } else {
                const paidRows = data.paid_payments.map(p => `
                    <tr class="hover:bg-gray-50">
                        <td class="p-3 border-b">${p.student_name}</td>
                        <td class="p-3 border-b">${p.class_name || 'N/A'}</td>
                        <td class="p-3 border-b text-center">R$ ${p.amount.toFixed(2)}</td>
                        <td class="p-3 border-b text-center">${p.type}</td>
                         <td class="p-3 border-b text-center">${p.payment_method}</td>
                        <td class="p-3 border-b text-center">-</td>
                    </tr>
                `).join('');
                paidTableContainer.innerHTML = `
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="p-3 text-left text-sm font-semibold">Aluno</th>
                                    <th class="p-3 text-left text-sm font-semibold">Turma Ref.</th>
                                    <th class="p-3 text-center text-sm font-semibold">Valor Pago</th>
                                    <th class="p-3 text-center text-sm font-semibold">Tipo</th>
                                    <th class="p-3 text-center text-sm font-semibold">Forma Pag.</th>
                                    <th class="p-3 text-center text-sm font-semibold">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${paidRows}</tbody>
                        </table>
                    </div>
                `;
            }

             if (data.pending_payments.length === 0) {
                pendingTableContainer.innerHTML = '<p>Nenhuma cobrança pendente para este período.</p>';
            } else {
                 const pendingRows = data.pending_payments.map(p => `
                    <tr class="hover:bg-gray-50">
                        <td class="p-3 border-b">${p.student_name}</td>
                        <td class="p-3 border-b">${p.class_name || 'N/A'}</td>
                        <td class="p-3 border-b text-center">R$ ${p.amount.toFixed(2)}</td>
                        <td class="p-3 border-b text-center">${p.type}</td>
                        <td class="p-3 border-b text-center">${p.due_date_formatted}</td>
                        <td class="p-3 border-b text-center">${getStatusBadge(p.status)}</td>
                        <td class="p-3 border-b text-center">
                            <button data-action="register-payment" data-payment-id="${p.id}" class="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600">
                                Registrar Pagamento
                            </button>
                        </td>
                    </tr>
                `).join('');
                 pendingTableContainer.innerHTML = `
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="p-3 text-left text-sm font-semibold">Aluno</th>
                                    <th class="p-3 text-left text-sm font-semibold">Turma Ref.</th>
                                    <th class="p-3 text-center text-sm font-semibold">Valor Devido</th>
                                    <th class="p-3 text-center text-sm font-semibold">Tipo</th>
                                    <th class="p-3 text-center text-sm font-semibold">Vencimento</th>
                                    <th class="p-3 text-center text-sm font-semibold">Status</th>
                                    <th class="p-3 text-center text-sm font-semibold">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${pendingRows}</tbody>
                        </table>
                    </div>
                `;
                 pendingTableContainer.querySelectorAll('button[data-action="register-payment"]').forEach(button => {
                     button.addEventListener('click', () => {
                         const paymentId = button.dataset.paymentId;
                         const payment = data.pending_payments.find(p => p.id === paymentId);
                         if (payment) {
                             openRegisterPaymentModal(payment, fetchAndRenderData);
                         }
                     });
                 });
            }
        } catch (error) {
            console.error("Erro no painel financeiro:", error);
            const errorHtml = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong class="font-bold">Erro!</strong>
                    <span class="block sm:inline">${error.message}</span>
                </div>`;
            summaryContainer.innerHTML = '';
            paidTableContainer.innerHTML = errorHtml;
            pendingTableContainer.innerHTML = '';
        } finally {
            hideLoading();
        }
    };
    
    const handleGenerateBillingsClick = async () => {
        showLoading();
        try {
            const year = yearFilter.value;
            const month = monthFilter.value;
            const response = await fetchWithAuth('/api/admin/financial/generate-billings', {
                method: 'POST',
                body: JSON.stringify({ year: parseInt(year), month: parseInt(month) })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Falha ao gerar cobranças');
            
            showModal('Sucesso', `<p>${result.details.generated} cobranças geradas. ${result.details.skipped} já existiam.</p>`);
            fetchAndRenderData();
        } catch (error) {
            showModal('Erro', `<p>${error.message}</p>`);
        } finally {
            hideLoading();
        }
    };

    const handleGenerateMiscInvoiceClick = () => {
        openMiscInvoiceModal(fetchAndRenderData);
    };

    generateBillingsBtn.addEventListener('click', handleGenerateBillingsClick);
    generateMiscInvoiceBtn.addEventListener('click', handleGenerateMiscInvoiceClick);
    monthFilter.addEventListener('change', fetchAndRenderData);
    yearFilter.addEventListener('change', fetchAndRenderData);

    fetchAndRenderData();

    return () => {
        monthFilter.removeEventListener('change', fetchAndRenderData);
        yearFilter.removeEventListener('change', fetchAndRenderData);
        generateBillingsBtn.removeEventListener('click', handleGenerateBillingsClick);
        generateMiscInvoiceBtn.removeEventListener('click', handleGenerateMiscInvoiceClick);
    };
}

