let allConsumers = [];
let salesData = { bills: [] };

document.addEventListener('DOMContentLoaded', async () => {
    await AdminShell.ensureAdmin();
    loadMetrics();
    loadConsumers();
    const hasSalesControls = document.getElementById('salesYearFilter') && document.getElementById('salesMonthFilter');
    if (hasSalesControls) {
        loadSalesData();
    }
    
    const consumerSearchInput = document.getElementById('consumerSearch');
    consumerSearchInput?.addEventListener('input', filterConsumers);
    
    const salesYearFilter = document.getElementById('salesYearFilter');
    const salesMonthFilter = document.getElementById('salesMonthFilter');
    salesYearFilter?.addEventListener('change', updateSalesDisplay);
    salesMonthFilter?.addEventListener('change', updateSalesDisplay);
});

async function loadMetrics() {
    try {
        const response = await fetch('/api/admin/metrics');
        if (!response.ok) {
            throw new Error('Unable to load metrics');
        }
        const { metrics } = await response.json();
        document.getElementById('metricUsers').textContent = metrics.totalUsers || 0;
        document.getElementById('metricConsumers').textContent = metrics.totalConsumers || 0;
        document.getElementById('metricRevenue').textContent = formatCurrency(metrics.totalRevenue || 0);
        document.getElementById('metricCubic').textContent = (metrics.totalCubicMeters || 0).toFixed(1);
        document.getElementById('consumerActive').textContent = metrics.activeConsumers || 0;
    } catch (error) {
        console.error('Error loading metrics:', error);
        AdminShell.showAlert(error.message, 'danger');
    }
}

async function loadConsumers() {
    try {
        const response = await fetch('/api/admin/billing/consumers');
        if (!response.ok) throw new Error('Unable to load consumers');
        const { consumers } = await response.json();
        allConsumers = consumers;
        renderConsumers(consumers);
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

function renderConsumers(consumers) {
    const tbody = document.getElementById('consumersListBody');
    if (consumers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No consumers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = consumers.map(consumer => {
        const totalBalance = consumer.bills
            .reduce((sum, b) => sum + (b.dueAmount ?? (parseFloat(b.balance || 0) || (b.status !== 'Paid' ? parseFloat(b.amount || 0) : 0))), 0);
        
        return `
            <tr style="cursor: pointer;" onclick="viewConsumerBilling(${consumer.id})">
                <td><strong>${consumer.name || '-'}</strong></td>
                <td>${consumer.email || '-'}</td>
                <td>${consumer.phone || '-'}</td>
                <td>${consumer.address || '-'}</td>
                <td><span class="badge bg-${consumer.status === 'active' ? 'success' : 'secondary'}">${consumer.status || 'active'}</span></td>
                <td>₱${formatCurrency(totalBalance)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewConsumerBilling(${consumer.id})">
                        <i class="fas fa-eye"></i> View Bills
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterConsumers() {
    const searchTerm = document.getElementById('consumerSearch').value.toLowerCase();
    const filtered = allConsumers.filter(consumer => 
        (consumer.name && consumer.name.toLowerCase().includes(searchTerm)) ||
        (consumer.email && consumer.email.toLowerCase().includes(searchTerm)) ||
        (consumer.phone && consumer.phone.includes(searchTerm))
    );
    renderConsumers(filtered);
}

function viewConsumerBilling(consumerId) {
    window.location.href = `/dashboard/admin/billing?consumer=${consumerId}`;
}

async function loadSalesData() {
    const yearFilter = document.getElementById('salesYearFilter');
    if (!yearFilter) return;
    try {
        const response = await fetch('/api/admin/sales');
        if (!response.ok) throw new Error('Unable to load sales data');
        const data = await response.json();
        salesData = data;
        
        const currentYear = new Date().getFullYear();
        const yearOptions = [];
        for (let year = 2020; year <= currentYear; year += 1) {
            yearOptions.unshift(year);
        }
        yearFilter.innerHTML = '<option value="">All Years</option>' + 
            yearOptions.map(y => `<option value="${y}">${y}</option>`).join('');
        yearFilter.value = currentYear.toString();
        
        updateSalesDisplay();
    } catch (error) {
        console.error('Error loading sales data:', error);
    }
}

function updateSalesDisplay() {
    const yearSelect = document.getElementById('salesYearFilter');
    const monthSelect = document.getElementById('salesMonthFilter');
    if (!yearSelect || !monthSelect) return;

    const yearValue = yearSelect.value;
    const monthValue = monthSelect.value;
    
    const bills = (salesData.bills || []).filter(bill => {
        const withinYear = yearValue ? bill.year == yearValue : true;
        const withinMonth = monthValue ? bill.month === monthValue : true;
        return withinYear && withinMonth;
    });

    const totalMonth = bills
        .filter(bill => monthValue ? bill.month === monthValue : true)
        .reduce((sum, bill) => sum + Math.max(parseFloat(bill.amount || 0) - parseFloat(bill.balance || 0), 0), 0);

    const totalYear = (salesData.bills || [])
        .filter(bill => yearValue ? bill.year == yearValue : true)
        .reduce((sum, bill) => sum + Math.max(parseFloat(bill.amount || 0) - parseFloat(bill.balance || 0), 0), 0);

    document.getElementById('salesMonthTotal').textContent = formatCurrency(totalMonth);
    document.getElementById('salesYearTotal').textContent = formatCurrency(totalYear);
}

function showMetricDetails(type) {
    const modal = new bootstrap.Modal(document.getElementById('metricModal'));
    const title = document.getElementById('metricModalTitle');
    const body = document.getElementById('metricModalBody');
    
    switch(type) {
        case 'users':
            title.textContent = 'Total Users Details';
            body.innerHTML = '<p>Total number of registered users in the system.</p>';
            break;
        case 'consumers':
            title.textContent = 'Active Connections Details';
            body.innerHTML = '<p>Number of active consumer connections being monitored.</p>';
            break;
        case 'revenue':
            title.textContent = 'Projected Revenue Details';
            body.innerHTML = '<p>Total projected revenue from current billing cycle.</p>';
            break;
        case 'usage':
            title.textContent = 'Water Usage Details';
            body.innerHTML = '<p>Total cubic meters of water tracked this month.</p>';
            break;
    }
    
    modal.show();
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
