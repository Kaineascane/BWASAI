document.addEventListener('DOMContentLoaded', async () => {
    await ConsumerShell.ensureConsumer?.();
    if (window.ConsumerUsage && typeof window.ConsumerUsage.renderCards === 'function') {
        try {
            await window.ConsumerUsage.renderCards();
        } catch (error) {
            ConsumerShell.showAlert?.(error.message || 'Unable to load analytics.', 'danger');
        }
    }
    loadDashboardBilling();
    loadUsageGrowth();
    startSlides();
});

let slideInterval;

function startSlides() {
    const slides = document.querySelectorAll('.slide');
    if (!slides.length) return;
    let index = 0;
    slideInterval = setInterval(() => {
        slides[index].classList.remove('active');
        index = (index + 1) % slides.length;
        slides[index].classList.add('active');
    }, 4500);
}

async function loadDashboardBilling() {
    const body = document.getElementById('dashboardBillingBody');
    if (!body) return;
    try {
        const response = await fetch('/api/consumer/billing');
        if (!response.ok) {
            throw new Error('Unable to load billing data.');
        }
        const data = await response.json();
        const preview = (data.bills || []).slice(0, 5);
        if (!preview.length) {
            body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No billing data available.</td></tr>`;
            return;
        }
        body.innerHTML = preview.map((bill) => `
            <tr>
                <td>${bill.month} ${bill.year}</td>
                <td>${bill.cubic_meters}</td>
                <td>₱${formatCurrency(bill.dueAmount ?? bill.balance ?? bill.amount)}</td>
                <td><span class="status-tag status-${bill.status.replace(/\s/g,'-')}">${bill.status}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        ConsumerShell.showAlert?.(error.message || 'Unable to load billing data.', 'danger');
        body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Unable to load billing data.</td></tr>`;
    }
}

function formatCurrency(value) {
    return Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

async function loadUsageGrowth() {
    try {
        const response = await fetch('/api/user/usage');
        if (!response.ok) {
            throw new Error('Unable to load usage data.');
        }
        const data = await response.json();
        
        if (data.growth) {
            const growthCard = document.getElementById('usageGrowthCard');
            const growthMessage = document.getElementById('growthMessage');
            const growthPercentage = document.getElementById('growthPercentage');
            const growthIcon = document.getElementById('growthIcon');
            
            if (growthCard && growthMessage && growthPercentage && growthIcon) {
                growthMessage.textContent = data.growth.message;
                growthPercentage.textContent = data.growth.percentage !== 0 
                    ? `${data.growth.percentage > 0 ? '+' : ''}${data.growth.percentage}% compared to previous period`
                    : '';
                
                // Set icon and color based on trend
                let iconClass = 'fas fa-chart-line';
                let colorClass = 'text-info';
                
                if (data.growth.trend === 'increasing') {
                    iconClass = 'fas fa-arrow-trend-up';
                    colorClass = 'text-danger';
                } else if (data.growth.trend === 'decreasing') {
                    iconClass = 'fas fa-arrow-trend-down';
                    colorClass = 'text-success';
                } else {
                    iconClass = 'fas fa-chart-line';
                    colorClass = 'text-info';
                }
                
                growthIcon.innerHTML = `<i class="${iconClass} fa-3x ${colorClass}"></i>`;
                growthMessage.className = `d-block mt-1 ${colorClass}`;
            }
        }
    } catch (error) {
        console.error('Error loading usage growth:', error);
    }
}
