window.SupportCenter = {
    mode: 'view',
    display: null,
    form: null,
    statusEl: null,
    async init(options = {}) {
        this.mode = options.mode || 'view';
        this.display = document.getElementById('supportDisplay');
        this.form = document.getElementById('supportForm');
        this.statusEl = document.getElementById('supportStatus');
        this.facebookLink = document.getElementById('supportFacebook');
        this.titleEl = document.getElementById('supportTitle');
        this.messageEl = document.getElementById('supportMessage');
        await this.load();
        if (this.form) {
            this.form.addEventListener('submit', (event) => this.handleSubmit(event));
        }
    },
    async load(showToast = false) {
        try {
            const response = await fetch('/api/support');
            if (!response.ok) {
                throw new Error('Unable to load support info.');
            }
            const { support } = await response.json();
            this.renderSupport(support);
            if (showToast) {
                this.notify('Support information refreshed.', 'info');
            }
            if (this.form && support) {
                this.form.organization.value = support.organization || '';
                this.form.phone.value = support.phone || '';
                this.form.email.value = support.email || '';
                this.form.address.value = support.address || '';
                this.form.facebook_url.value = support.facebook_url || '';
                this.form.hours.value = support.hours || '';
            }
        } catch (error) {
            this.notify(error.message, 'danger');
        }
    },
    renderSupport(support = {}) {
        if (!this.display) return;
        const fields = this.display.querySelectorAll('[data-support]');
        fields.forEach((field) => {
            const key = field.getAttribute('data-support');
            field.textContent = support[key] && support[key].trim() ? support[key] : 'Not available';
        });
        if (this.titleEl) {
            this.titleEl.textContent = support.organization || 'BWSAI Support Desk';
        }
        if (this.messageEl) {
            this.messageEl.textContent = support.address
                ? 'Share these official contact details with your constituents.'
                : 'Provide contact information so consumers can reach you faster.';
        }
        if (this.facebookLink) {
            if (support.facebook_url) {
                this.facebookLink.href = support.facebook_url;
                this.facebookLink.classList.remove('disabled');
            } else {
                this.facebookLink.href = '#';
                this.facebookLink.classList.add('disabled');
            }
        }
    },
    async handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(this.form);
        const payload = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/api/support', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Unable to update support info.');
            }
            if (this.statusEl) {
                this.statusEl.innerHTML = '<div class="alert alert-success mb-0">Support information saved.</div>';
            }
            this.renderSupport(result.support);
        } catch (error) {
            if (this.statusEl) {
                this.statusEl.innerHTML = `<div class="alert alert-danger mb-0">${error.message}</div>`;
            }
        }
    },
    notify(message, type = 'info') {
        if (window.AdminShell && typeof window.AdminShell.showAlert === 'function') {
            window.AdminShell.showAlert(message, type);
            return;
        }
        if (window.ConsumerShell && typeof window.ConsumerShell.showAlert === 'function') {
            window.ConsumerShell.showAlert(message, type);
            return;
        }
        if (this.statusEl) {
            this.statusEl.innerHTML = `<div class="alert alert-${type === 'danger' ? 'danger' : 'info'} mb-0">${message}</div>`;
        } else {
            alert(message);
        }
    }
};

