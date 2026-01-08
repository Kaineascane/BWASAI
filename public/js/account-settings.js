window.AccountSettings = {
    mode: 'user',
    user: null,
    consumer: null,
    async init(options = {}) {
        this.mode = options.mode || 'user';
        this.allowProfileEdit = this.mode === 'admin';
        this.profileForm = document.getElementById('profileForm');
        this.passwordForm = document.getElementById('passwordForm');
        this.summaryContainer = document.getElementById('profileSummary');
        await this.loadProfile();
        if (this.profileForm && this.allowProfileEdit) {
            this.profileForm.addEventListener('submit', (event) => this.handleProfileSubmit(event));
        }
        if (this.passwordForm) {
            this.passwordForm.addEventListener('submit', (event) => this.handlePasswordSubmit(event));
        }
        if (this.profileForm && !this.allowProfileEdit) {
            Array.from(this.profileForm.elements).forEach((el) => el.setAttribute('disabled', 'disabled'));
        }
    },
    async loadProfile() {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                throw new Error('Unable to load profile details.');
            }
            const data = await response.json();
            this.user = data.user;
            this.consumer = data.consumer;
            if (this.summaryContainer) {
                ['username', 'email', 'phone', 'address'].forEach((field) => {
                    const target = this.summaryContainer.querySelector(`[data-field="${field}"]`);
                    if (!target) return;
                    if (field === 'phone' || field === 'address') {
                        target.textContent = (this.consumer && this.consumer[field]) ? this.consumer[field] : '—';
                        return;
                    }
                    target.textContent = this.user?.[field] || '—';
                });
            }
            if (!this.profileForm) return;
            const usernameInput = this.profileForm.querySelector('[name="username"]');
            const emailInput = this.profileForm.querySelector('[name="email"]');
            const phoneInput = this.profileForm.querySelector('[name="phone"]');
            const addressInput = this.profileForm.querySelector('[name="address"]');
            if (usernameInput) {
                usernameInput.value = this.user?.username || '';
            }
            if (emailInput) {
                emailInput.value = this.user?.email || '';
            }
            if (phoneInput) {
                phoneInput.value = (this.consumer && this.consumer.phone) ? this.consumer.phone : '';
            }
            if (addressInput) {
                addressInput.value = (this.consumer && this.consumer.address) ? this.consumer.address : '';
            }
        } catch (error) {
            this.notify(error.message, 'danger');
        }
    },
    async handleProfileSubmit(event) {
        event.preventDefault();
        if (!this.allowProfileEdit) {
            this.notify('Profile editing is disabled for this account.', 'warning');
            return;
        }
        const formData = new FormData(this.profileForm);
        const payload = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Unable to update profile.');
            }
            this.notify('Profile updated successfully.', 'success');
            await this.loadProfile();
        } catch (error) {
            this.notify(error.message, 'danger');
        }
    },
    async handlePasswordSubmit(event) {
        event.preventDefault();
        const formData = new FormData(this.passwordForm);
        const payload = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/api/user/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Unable to update password.');
            }
            this.passwordForm.reset();
            this.notify('Password updated successfully.', 'success');
        } catch (error) {
            this.notify(error.message, 'danger');
        }
    },
    notify(message, type = 'info') {
        if (window.ConsumerShell && typeof window.ConsumerShell.showAlert === 'function') {
            window.ConsumerShell.showAlert(message, type);
            return;
        }
        if (window.AdminShell && typeof window.AdminShell.showAlert === 'function') {
            window.AdminShell.showAlert(message, type);
            return;
        }
        if (window.AccountSettingsToast && typeof window.AccountSettingsToast === 'function') {
            window.AccountSettingsToast(type, message);
            return;
        }
        alert(message);
    }
};

