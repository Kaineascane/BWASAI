document.addEventListener('DOMContentLoaded', async () => {
    await AdminShell.ensureAdmin();
    loadAnalytics();
});

let consumptionChart;
let revenueChart;

async function loadAnalytics() {
    try {
        const response = await fetch('/api/admin/sales');
        if (!response.ok) throw new Error('Unable to load analytics data');
        const { bills } = await response.json();
        buildCharts(bills || []);
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

function buildCharts(bills) {
    const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const currentYear = new Date().getFullYear();
    const filteredBills = bills.filter(bill => bill.year == currentYear);

    const monthlyData = monthOrder.reduce((acc, month) => {
        const monthBills = filteredBills.filter(bill => bill.month === month);
        if (!monthBills.length) return acc;
        const usage = monthBills.reduce((sum, bill) => sum + parseFloat(bill.cubic_meters || 0), 0);
        const revenue = monthBills.reduce((sum, bill) => sum + Math.max(parseFloat(bill.amount || 0) - parseFloat(bill.balance || 0), 0), 0);
        acc.labels.push(month.slice(0, 3));
        acc.usage.push(usage);
        acc.revenue.push(revenue);
        return acc;
    }, { labels: [], usage: [], revenue: [] });

    if (!monthlyData.labels.length) {
        monthlyData.labels = ['N/A'];
        monthlyData.usage = [0];
        monthlyData.revenue = [0];
    }

    const ctxConsumption = document.getElementById('consumptionChart').getContext('2d');
    if (consumptionChart) consumptionChart.destroy();
    consumptionChart = new Chart(ctxConsumption, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Usage (m³)',
                data: monthlyData.usage,
                borderColor: '#0d7dbb',
                backgroundColor: 'rgba(13, 125, 187, 0.12)',
                tension: 0.4
            }]
        },
        options: { plugins: { legend: { display: false } }, responsive: true }
    });

    const ctxRevenue = document.getElementById('revenueChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctxRevenue, {
        type: 'bar',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Revenue (₱)',
                data: monthlyData.revenue,
                backgroundColor: '#23a6d5'
            }]
        },
        options: { plugins: { legend: { display: false } }, responsive: true }
    });
}

