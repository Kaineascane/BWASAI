let billModal = null;
let consumers = [];
let consumerMap = {};
let allBills = [];
let consumerTotals = {};
let selectedConsumerId = null;
let currentRate = 28.00;

document.addEventListener('DOMContentLoaded', async () => {
    await AdminShell.ensureAdmin();
    
    // Check if consumer ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    selectedConsumerId = urlParams.get('consumer');
    
    await loadConsumers();
    loadBillingData();
    
    if (!billModal) {
        billModal = new bootstrap.Modal(document.getElementById('billModal'));
    }
    
    document.getElementById('billStatus').addEventListener('change', toggleBalanceInput);
    document.getElementById('billCubicMeters').addEventListener('input', calculateBillAmount);
    document.getElementById('billRate').addEventListener('input', calculateBillAmount);
    
    // Set default rate
    document.getElementById('ratePerCubicMeter').value = currentRate;
});

function calculateBillAmount() {
    const cubicMeters = parseFloat(document.getElementById('billCubicMeters').value) || 0;
    const rate = parseFloat(document.getElementById('billRate').value) || currentRate;
    const amount = cubicMeters * rate;
    document.getElementById('billAmount').value = amount.toFixed(2);
}

async function loadConsumers() {
    try {
        const response = await fetch('/api/consumers');
        if (!response.ok) throw new Error('Unable to load consumers');
        const data = await response.json();
        consumers = data.consumers || [];
        consumerMap = {};
        consumers.forEach(c => consumerMap[c.id] = c);
        
        const filterSelect = document.getElementById('consumerFilter');
        const billConsumerSelect = document.getElementById('billConsumerId');
        
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">All Consumers</option>' + 
                consumers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        if (billConsumerSelect) {
            billConsumerSelect.innerHTML = '<option value="" disabled selected>Select consumer</option>' + 
                consumers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        
        renderConsumerDirectory(consumers);

        // Set selected consumer if from URL
        if (selectedConsumerId) {
            const searchInput = document.getElementById('consumerSearch');
            const consumer = consumers.find(c => c.id == selectedConsumerId);
            if (consumer) {
                searchInput.value = consumer.name;
                document.getElementById('consumerFilter').value = selectedConsumerId;
                showConsumerInfo(consumer);
            }
        }
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

function searchConsumer() {
    const searchTerm = document.getElementById('consumerSearch').value.toLowerCase();
    if (searchTerm.length < 2) {
        document.getElementById('consumerFilter').value = '';
        loadBillingData();
        return;
    }
    
    const found = consumers.find(c => 
        c.name.toLowerCase().includes(searchTerm)
    );
    
    if (found) {
        document.getElementById('consumerFilter').value = found.id;
        showConsumerInfo(found);
        loadBillingData();
    }
}

function renderConsumerDirectory(list = []) {
    const container = document.getElementById('consumerList');
    if (!container) return;
    if (!list.length) {
        container.innerHTML = '<span class="text-muted small">No consumers found.</span>';
        return;
    }
    container.innerHTML = list
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(consumer => `
            <button type="button" class="consumer-chip ${String(selectedConsumerId) === String(consumer.id) ? 'active' : ''}"
                onclick="viewConsumerBilling(${consumer.id})">
                ${consumer.name}
            </button>
        `).join('');
}

function showConsumerInfo(consumer) {
    const infoDiv = document.getElementById('consumerInfo');
    if (!infoDiv) return;
    document.getElementById('selectedConsumerName').textContent = consumer.name;
    document.getElementById('selectedConsumerContact').textContent = consumer.email || '—';
    document.getElementById('selectedConsumerAddress').textContent = consumer.address || '—';
    document.getElementById('selectedConsumerPhone').textContent = consumer.phone || '—';
    const badge = document.getElementById('selectedConsumerStatus');
    if (badge) {
        badge.textContent = consumer.status || 'active';
        badge.className = `badge ${consumer.status === 'active' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`;
    }
    const totals = consumerTotals[consumer.id];
    document.getElementById('selectedConsumerBalance').textContent = totals
        ? `₱${formatCurrency(totals.totalBalance)}`
        : '₱0.00';
    infoDiv.style.display = 'block';
}

async function loadBillingData() {
    try {
        const consumerFilter = document.getElementById('consumerFilter')?.value || selectedConsumerId;
        const yearFilter = document.getElementById('yearFilter')?.value;
        const monthFilter = document.getElementById('monthFilter')?.value;
        
        const response = await fetch('/api/admin/billing/consumers');
        if (!response.ok) throw new Error('Unable to load billing data');
        const { consumers: billingData } = await response.json();
        
        allBills = [];
        consumerTotals = {};
        
        billingData.forEach(consumer => {
            if (consumerFilter && consumer.id != consumerFilter) return;
            
            let bills = consumer.bills || [];
            
            // Apply year filter
            if (yearFilter) {
                bills = bills.filter(b => b.year == yearFilter);
            }
            
            // Apply month filter
            if (monthFilter) {
                bills = bills.filter(b => b.month === monthFilter);
            }
            
            // Calculate totals by year
            const billsByYear = {};
            bills.forEach(bill => {
                if (!billsByYear[bill.year]) {
                    billsByYear[bill.year] = { total: 0, balance: 0 };
                }
                billsByYear[bill.year].total += parseFloat(bill.amount || 0);
                billsByYear[bill.year].balance += bill.dueAmount ?? (bill.status !== 'Paid' ? parseFloat(bill.balance || bill.amount || 0) : 0);
            });
            
            const totalBalance = bills
                .reduce((sum, b) => sum + (b.dueAmount ?? (b.status !== 'Paid' ? parseFloat(b.balance || b.amount || 0) : 0)), 0);
            
            consumerTotals[consumer.id] = { totalBalance, billsByYear };
            
            bills.forEach(bill => {
                allBills.push({
                    ...bill,
                    consumer_id: consumer.id,
                    consumer_name: consumer.name
                });
            });
        });
        
        // Populate year filter
        const yearSelect = document.getElementById('yearFilter');
        if (yearSelect) {
            const selectedValue = yearSelect.value;
            const now = new Date().getFullYear();
            const options = [];
            for (let year = 2020; year <= now; year += 1) {
                options.unshift(year);
            }
            yearSelect.innerHTML = '<option value="">All Years</option>' + 
                options.map(year => `<option value="${year}">${year}</option>`).join('');
            if (selectedValue) {
                yearSelect.value = selectedValue;
            }
        }
        
        renderBillingTable();
        updateSelectedConsumerHeader();
        renderConsumerDetail();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

function updateSelectedConsumerHeader() {
    const consumerFilter = document.getElementById('consumerFilter')?.value || selectedConsumerId;
    const infoDiv = document.getElementById('consumerInfo');
    if (!infoDiv) return;
    if (!consumerFilter || !consumerTotals[consumerFilter]) {
        infoDiv.style.display = 'none';
        return;
    }
    const consumer = consumerMap[consumerFilter] || consumers.find(c => c.id == consumerFilter);
    if (consumer) {
        selectedConsumerId = consumerFilter;
        showConsumerInfo(consumer);
    }
}
function renderBillingTable() {
    const tbody = document.getElementById('billingTableBody');
    tbody.innerHTML = '';

    if (!allBills.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No billing records found</td></tr>';
        return;
    }

    const consumerGroups = {};
    allBills.forEach(bill => {
        if (!consumerGroups[bill.consumer_id]) {
            consumerGroups[bill.consumer_id] = [];
        }
        consumerGroups[bill.consumer_id].push(bill);
    });

    Object.keys(consumerGroups).forEach(consumerId => {
        const bills = consumerGroups[consumerId].sort((a, b) => {
            const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            if (a.year !== b.year) return b.year - a.year;
            return months.indexOf(b.month) - months.indexOf(a.month);
        });

        const consumer = consumerMap[consumerId] || consumers.find(c => c.id == consumerId);
        const totals = consumerTotals[consumerId] || { totalBalance: 0 };
        const latest = bills[0];

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <button class="btn btn-link p-0 fw-semibold" onclick="viewConsumerBilling(${consumerId})">
                    ${consumer ? consumer.name : 'Consumer #' + consumerId}
                </button>
                <div class="small text-muted">${consumer?.email || ''}</div>
            </td>
            <td>${latest.month}</td>
            <td>${latest.year}</td>
            <td>${latest.cubic_meters || 0}</td>
            <td>₱${formatCurrency(latest.rate_per_cubic_meter || currentRate)}</td>
            <td>₱${formatCurrency(latest.amount)}</td>
            <td><span class="status-tag status-${latest.status.replace(/\s/g,'-')}">${latest.status}</span></td>
            <td>₱${formatCurrency(totals.totalBalance)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editBill(${latest.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderConsumerDetail();
}

function toggleBalanceInput() {
    const status = document.getElementById('billStatus').value;
    const balanceInput = document.getElementById('billBalance');
    balanceInput.disabled = status !== 'Balance';
    if (status !== 'Balance') {
        balanceInput.value = 0;
    }
}

function updateRate() {
    currentRate = parseFloat(document.getElementById('ratePerCubicMeter').value) || 28.00;
}

function clearConsumerSelection() {
    selectedConsumerId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('consumer');
    window.history.replaceState({}, '', url);
    document.getElementById('consumerInfo').style.display = 'none';
    document.getElementById('consumerDetailSection').style.display = 'none';
    renderConsumerDirectory(consumers);
    loadBillingData();
}

function renderConsumerDetail() {
    const detailSection = document.getElementById('consumerDetailSection');
    if (!detailSection) return;
    const consumerId = document.getElementById('consumerFilter')?.value || selectedConsumerId;
    if (!consumerId) {
        detailSection.style.display = 'none';
        return;
    }
    const consumer = consumerMap[consumerId] || consumers.find(c => c.id == consumerId);
    if (!consumer) {
        detailSection.style.display = 'none';
        return;
    }
    selectedConsumerId = consumerId;
    const bills = allBills
        .filter(bill => bill.consumer_id == consumerId)
        .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            return months.indexOf(b.month) - months.indexOf(a.month);
        });
    const body = document.getElementById('consumerDetailBody');
    if (!bills.length) {
        body.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No billing records for this consumer.</td></tr>';
    } else {
        body.innerHTML = bills.map(bill => `
            <tr>
                <td>${bill.month}</td>
                <td>${bill.year}</td>
                <td>${bill.cubic_meters || 0}</td>
                <td>₱${formatCurrency(bill.rate_per_cubic_meter || currentRate)}</td>
                <td>₱${formatCurrency(bill.amount)}</td>
                <td><span class="status-tag status-${bill.status.replace(/\s/g,'-')}">${bill.status}</span></td>
                <td>₱${formatCurrency(bill.balance || 0)}</td>
                <td>₱${formatCurrency(bill.dueAmount ?? bill.balance ?? 0)}</td>
            </tr>
        `).join('');
    }
    document.getElementById('consumerDetailSubtitle').textContent = `${consumer.name}'s billing history`;
    detailSection.style.display = 'block';
    renderConsumerDirectory(consumers);
}

async function updateBillStatus(billId, status) {
    const bill = allBills.find(b => b.id == billId);
    if (!bill) return;
    
    try {
        const response = await fetch(`/api/admin/billing/${billId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...bill,
                status: status
            })
        });
        
        if (!response.ok) throw new Error('Unable to update status');
        
        bill.status = status;
        const balanceInput = document.getElementById(`balance-${billId}`);
        if (balanceInput) {
            balanceInput.disabled = status !== 'Balance';
            if (status !== 'Balance') {
                balanceInput.value = 0;
            }
        }
        
        loadBillingData();
        AdminShell.showAlert('Bill status updated', 'success');
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

async function updateBillField(billId, field, value) {
    const bill = allBills.find(b => b.id == billId);
    if (!bill) return;
    
    try {
        const updateData = { ...bill };
        updateData[field] = field === 'year' || field === 'cubic_meters' || field === 'amount' || field === 'balance' || field === 'rate_per_cubic_meter'
            ? parseFloat(value) || 0 
            : value;
        
        // Auto-calculate amount if cubic meters or rate changed
        if (field === 'cubic_meters' || field === 'rate_per_cubic_meter') {
            updateData.amount = (updateData.cubic_meters || 0) * (updateData.rate_per_cubic_meter || currentRate);
        }
        
        const response = await fetch(`/api/admin/billing/${billId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) throw new Error('Unable to update bill');
        
        bill[field] = updateData[field];
        if (updateData.amount) bill.amount = updateData.amount;
        
        AdminShell.showAlert('Bill updated successfully', 'success');
        loadBillingData();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
        loadBillingData();
    }
}

function editBill(billId) {
    const bill = allBills.find(b => b.id == billId);
    if (!bill) return;
    
    document.getElementById('billForm').reset();
    document.getElementById('billId').value = bill.id;
    document.getElementById('billModalTitle').textContent = 'Update Bill';
    document.getElementById('billConsumerId').value = bill.consumer_id;
    document.getElementById('billMonth').value = bill.month;
    document.getElementById('billYear').value = bill.year;
    document.getElementById('billCubicMeters').value = bill.cubic_meters || 0;
    document.getElementById('billRate').value = bill.rate_per_cubic_meter || currentRate;
    document.getElementById('billAmount').value = bill.amount || 0;
    document.getElementById('billStatus').value = bill.status;
    document.getElementById('billBalance').value = bill.balance || 0;
    
    toggleBalanceInput();
    billModal.show();
}

function addNewBill() {
    document.getElementById('billForm').reset();
    document.getElementById('billId').value = '';
    document.getElementById('billModalTitle').textContent = 'Add New Bill';
    document.getElementById('billYear').value = new Date().getFullYear();
    document.getElementById('billRate').value = currentRate;
    if (selectedConsumerId) {
        document.getElementById('billConsumerId').value = selectedConsumerId;
    }
    toggleBalanceInput();
    billModal.show();
}

async function saveBill() {
    const billId = document.getElementById('billId').value;
    const payload = {
        consumer_id: parseInt(document.getElementById('billConsumerId').value),
        month: document.getElementById('billMonth').value,
        year: parseInt(document.getElementById('billYear').value),
        cubic_meters: parseFloat(document.getElementById('billCubicMeters').value) || 0,
        rate_per_cubic_meter: parseFloat(document.getElementById('billRate').value) || currentRate,
        amount: parseFloat(document.getElementById('billAmount').value),
        status: document.getElementById('billStatus').value,
        balance: parseFloat(document.getElementById('billBalance').value) || 0
    };
    if (!payload.consumer_id) {
        AdminShell.showAlert('Select a consumer before saving.', 'warning');
        return;
    }
    
    try {
        const url = billId ? `/api/admin/billing/${billId}` : '/api/admin/billing';
        const method = billId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(billId ? { ...payload, id: parseInt(billId) } : payload)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to save bill');
        }
        
        AdminShell.showAlert('Bill saved successfully', 'success');
        billModal.hide();
        loadBillingData();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
