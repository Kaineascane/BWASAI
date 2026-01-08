let billingData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await ConsumerShell.ensureConsumer?.();
    document.getElementById('billingMonthSelect').addEventListener('change', updateSelectedBill);
    loadBillingData();
});

async function loadBillingData() {
    try {
        const response = await fetch('/api/consumer/billing');
        if (!response.ok) throw new Error('Unable to load billing data');
        const data = await response.json();
        billingData = data.bills || [];

        const prev = data.balance?.previousBalance || 0;
        const current = data.balance?.currentBalance || 0;
        document.getElementById('previousBalanceValue').textContent = `₱${formatCurrency(prev)}`;
        document.getElementById('currentBalanceValue').textContent = `₱${formatCurrency(current)}`;
        document.getElementById('balanceTotal').textContent = `₱${formatCurrency(data.balance?.totalBalance || 0)}`;
        document.getElementById('currentMonthLabel').textContent = data.balance?.currentMonth || '—';

        const selector = document.getElementById('billingMonthSelect');
        selector.innerHTML = billingData.map((bill, index) => `
            <option value="${index}">${bill.month} ${bill.year}</option>
        `).join('');
        if (billingData.length) {
            selector.value = 0;
            updateSelectedBill();
        } else {
            document.getElementById('selectedBillDetails').innerHTML = '<p class="text-muted mb-0">No billing data available.</p>';
        }

        const tableBody = document.getElementById('billingTableBody');
        if (billingData.length) {
            tableBody.innerHTML = billingData.map(bill => `
                <tr>
                    <td>${bill.month} ${bill.year}</td>
                    <td>${bill.cubic_meters || 0}</td>
                    <td>₱${formatCurrency(bill.amount)}</td>
                    <td><span class="status-tag status-${bill.status.replace(/\s/g,'-')}">${bill.status}</span></td>
                    <td>₱${formatCurrency(bill.dueAmount ?? bill.balance ?? 0)}</td>
                </tr>
            `).join('');
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">No billing data available.</td>
                </tr>
            `;
        }
    } catch (error) {
        ConsumerShell.showAlert?.(error.message, 'danger');
    }
}

function updateSelectedBill() {
    const bill = billingData[document.getElementById('billingMonthSelect').value];
    const container = document.getElementById('selectedBillDetails');
    if (!bill) {
        container.innerHTML = '<p class="text-muted mb-0">No billing data available.</p>';
        return;
    }
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
                <small class="text-muted">Selected Month</small>
                <h5 class="mb-1">${bill.month} ${bill.year}</h5>
                <span class="status-tag status-${bill.status.replace(/\s/g,'-')}">${bill.status}</span>
            </div>
            <div class="text-end">
                <small class="text-muted d-block">Amount</small>
                <h3>₱${formatCurrency(bill.amount)}</h3>
                <small>Cubic meters: ${bill.cubic_meters}</small>
            </div>
        </div>
    `;
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

