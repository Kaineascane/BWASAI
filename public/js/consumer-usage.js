window.ConsumerUsage = {
    cache: null,
    async fetchData() {
        if (this.cache) {
            return this.cache;
        }
        const response = await fetch('/api/user/usage');
        if (!response.ok) {
            throw new Error('Unable to load usage data.');
        }
        this.cache = await response.json();
        return this.cache;
    },
    async renderCards() {
        const container = document.getElementById('analyticsCubic');
        if (!container) return;
        const data = await this.fetchData();
        document.getElementById('analyticsCubic').textContent = data.totals.cubicMeters.toFixed(1);
        const paid = data.usage.filter(item => item.status === 'Paid').length;
        document.getElementById('analyticsPaid').textContent = paid;
        const pending = data.usage
            .filter(item => item.status !== 'Paid')
            .reduce((sum, item) => sum + (item.dueAmount ?? item.amountPeso), 0);
        document.getElementById('analyticsPending').textContent = pending.toFixed(2);
        document.getElementById('analyticsAverage').textContent = (data.totals.amount / (data.usage.length || 1)).toFixed(2);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'usage' || document.getElementById('analyticsCubic')) {
        window.ConsumerUsage.renderCards().catch(error => {
            ConsumerShell.showAlert?.(error.message, 'danger');
        });
    }
});

