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

function openRegisterPaymentModal(student, month, year, onSave) {
    const today = new Date().toISOString().split('T')[0];
    const modalHtml = `
        <form id="register-payment-form" data-student-id="${student.id}">
            <p class="mb-4">Registrando pagamento para <strong>${student.name}</strong> referente a <strong>${month}/${year}</strong>.</p>
            <div class="mb-4">
                <label class="block text-sm font-medium">Valor Pago (R$)</label>
                <input type="number" step="0.01" name="amount" value="${student.total_due}" class="p-2 border rounded-md w-full" required>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium">Data do Pagamento</label>
                <input type="date" name="payment_date" value="${today}" class="p-2 border rounded-md w-full" required>
            </div>
            <div class="text-right mt-6">
                <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md">Confirmar Pagamento</button>
            </div>
        </form>
    `;
    showModal('Registrar Pagamento', modalHtml);

    const form = document.getElementById('register-payment-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        const payload = {
            student_id: form.dataset.studentId,
            amount: parseFloat(form.elements.amount.value),
            payment_date: form.elements.payment_date.value,
            reference_month: month,
            reference_year: year
        };

        try {
            const response = await fetchWithAuth('/api/admin/payments', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw await response.json();
            hideModal();
            onSave(); // Chama a função para recarregar a tabela
        } catch (error) {
            alert(`Erro: ${error.error || 'Falha ao registrar pagamento.'}`);
            submitButton.disabled = false;
            submitButton.textContent = 'Confirmar Pagamento';
        }
    });
}

export function renderFinancialDashboard(targetElement) {
    const today = new Date();
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth() + 1;

    const mainHtml = `
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 class="text-3xl font-bold text-white">Gestão Financeira</h1>
            <div class="flex items-center gap-4">
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
                <button id="generate-billings-btn" class="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
                    Gerar Cobranças
                </button>
            </div>
        </div>
        <div id="financial-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"></div>
        <div id="financial-table-container" class="bg-white rounded-lg shadow p-4">
            <p>Carregando dados financeiros...</p>
        </div>
    `;
    targetElement.innerHTML = mainHtml;

    const summaryContainer = targetElement.querySelector('#financial-summary');
    const tableContainer = targetElement.querySelector('#financial-table-container');
    const monthFilter = targetElement.querySelector('#month-filter');
    const yearFilter = targetElement.querySelector('#year-filter');
    const generateBillingsBtn = targetElement.querySelector('#generate-billings-btn');

    const fetchAndRenderData = async () => {
        showLoading();
        summaryContainer.innerHTML = '';
        tableContainer.innerHTML = '<p>Carregando dados financeiros...</p>';

        try {
            const year = yearFilter.value;
            const month = monthFilter.value;
            const response = await fetchWithAuth(`/api/admin/financial/status?year=${year}&month=${month}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Falha ao carregar dados financeiros.');
            }
            
            const data = await response.json();

            // Renderiza o resumo
            if (data && data.summary) {
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
            }

            // Renderiza a tabela
            if (!data || !data.students || data.students.length === 0) {
                tableContainer.innerHTML = '<p>Nenhum aluno ativo encontrado para este período.</p>';
                return;
            }

            const tableRows = data.students.map(student => `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 border-b">${student.name}</td>
                    <td class="p-3 border-b text-center">R$ ${student.total_due.toFixed(2)}</td>
                    <td class="p-3 border-b text-center">${getStatusBadge(student.status)}</td>
                    <td class="p-3 border-b text-center">
                        ${student.status !== 'paid' ? `
                            <button data-action="register-payment" data-student-id="${student.id}" class="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600">
                                Registrar Pagamento
                            </button>
                        ` : `<span>-</span>`}
                    </td>
                </tr>
            `).join('');

            tableContainer.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="p-3 text-left text-sm font-semibold">Aluno</th>
                                <th class="p-3 text-center text-sm font-semibold">Valor Devido</th>
                                <th class="p-3 text-center text-sm font-semibold">Status</th>
                                <th class="p-3 text-center text-sm font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            `;
            
            tableContainer.querySelectorAll('button[data-action="register-payment"]').forEach(button => {
                button.addEventListener('click', () => {
                    const studentId = button.dataset.studentId;
                    const student = data.students.find(s => s.id === studentId);
                    if (student) {
                        openRegisterPaymentModal(student, month, year, fetchAndRenderData);
                    }
                });
            });

        } catch (error) {
            console.error("Erro no painel financeiro:", error);
            summaryContainer.innerHTML = `<div class="col-span-3 bg-red-100 p-4 rounded-lg text-red-800">${error.message}</div>`;
            tableContainer.innerHTML = `<p class="text-red-500">Não foi possível carregar os detalhes.</p>`;
        } finally {
            hideLoading();
        }
    };

    const handleGenerateBillings = async () => {
        showLoading();
        const year = yearFilter.value;
        const month = monthFilter.value;
        try {
            const response = await fetchWithAuth('/api/admin/financial/generate-billings', {
                method: 'POST',
                body: JSON.stringify({ year: parseInt(year), month: parseInt(month) })
            });
            const result = await response.json();
            if (!response.ok) throw result;
            
            showModal('Sucesso', `<p>${result.message}</p>`);
            await fetchAndRenderData(); // Recarrega os dados após gerar as cobranças

        } catch (error) {
            showModal('Erro', `<p>${error.error || 'Falha ao gerar cobranças.'}</p>`);
        } finally {
            hideLoading();
        }
    };

    monthFilter.addEventListener('change', fetchAndRenderData);
    yearFilter.addEventListener('change', fetchAndRenderData);
    generateBillingsBtn.addEventListener('click', handleGenerateBillings);

    fetchAndRenderData();

    return () => {
        monthFilter.removeEventListener('change', fetchAndRenderData);
        yearFilter.removeEventListener('change', fetchAndRenderData);
        generateBillingsBtn.removeEventListener('click', handleGenerateBillings);
    };
}

