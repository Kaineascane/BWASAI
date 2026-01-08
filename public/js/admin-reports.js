document.addEventListener('DOMContentLoaded', async () => {
    await AdminShell.ensureAdmin();
    document.querySelectorAll('.report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            AdminShell.showAlert(`Preparing ${type} report...`, 'info');
        });
    });
});

