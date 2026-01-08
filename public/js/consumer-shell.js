const consumerNav = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-house', href: '/dashboard/user' },
    { id: 'usage', label: 'Usage Insights', icon: 'fas fa-droplet', href: '/dashboard/user/usage' },
    { id: 'billing', label: 'Billing', icon: 'fas fa-wallet', href: '/dashboard/user/billing' },
    { id: 'support', label: 'Support', icon: 'fas fa-headset', href: '/dashboard/user/support' }
];

const ConsumerShell = {
    user: null,
    async init() {
        const host = document.getElementById('consumer-shell');
        if (!host) return;
        const active = document.body.dataset.page || 'dashboard';
        host.innerHTML = `
            <div class="app-shell">
                <aside class="user-sidebar" id="userSidebar">
                    <div class="sidebar-logo" id="sidebarLogo" style="cursor: pointer;" onclick="window.location.href='/dashboard/user'">
                        <img src="/assets/logo.svg" alt="BWSAI logo">
                        <div>
                            <strong>BWSAI</strong><br>
                            <small>Consumer Portal</small>
                        </div>
                    </div>
                    <nav class="sidebar-nav">
                        ${consumerNav.map(item => `
                            <a class="sidebar-link ${active === item.id ? 'active' : ''}" href="${item.href}">
                                <i class="${item.icon}"></i><span class="sidebar-label">${item.label}</span>
                            </a>
                        `).join('')}
                    </nav>
                    <div class="sidebar-footer">
                        <button class="btn btn-outline-light w-100" id="logoutBtn">
                            <i class="fas fa-sign-out-alt me-2"></i><span>Log out</span>
                        </button>
                    </div>
                </aside>
                <main class="content-area" id="contentArea">
                    <div class="user-topbar">
                        <div class="topbar-left">
                            <button id="sidebarToggle"><i class="fas fa-bars"></i></button>
                            <div>
                                <small class="text-muted">Welcome back</small>
                                <h5 id="userGreeting" class="mb-0">Consumer</h5>
                            </div>
                        </div>
                        <div class="profile-menu">
                            <div class="profile-trigger" id="profileTrigger">
                                <div class="text-end">
                                    <small class="text-muted d-block">Profile</small>
                                    <span>Options</span>
                                </div>
                                <div class="avatar" id="userInitials">BW</div>
                            </div>
                            <div class="profile-dropdown" id="profileDropdown">
                                <button onclick="window.location.href='/dashboard/user/settings'"><i class="fas fa-gear me-2"></i>Account Settings</button>
                                <button onclick="ConsumerShell.logout()"><i class="fas fa-sign-out-alt me-2"></i>Log out</button>
                            </div>
                        </div>
                    </div>
                    <section id="pageContainer"></section>
                </main>
            </div>
        `;

        const template = document.getElementById('page-content');
        if (template) {
            document.getElementById('pageContainer').appendChild(template.content.cloneNode(true));
        }

        this.bindUI();
        await this.ensureConsumer();
    },
    bindUI() {
        const sidebar = document.getElementById('userSidebar');
        document.getElementById('sidebarToggle')?.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
        document.getElementById('sidebarLogo')?.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        const trigger = document.getElementById('profileTrigger');
        const dropdown = document.getElementById('profileDropdown');
        trigger?.addEventListener('click', () => dropdown.classList.toggle('show'));
        document.addEventListener('click', (e) => {
            if (!trigger?.contains(e.target)) {
                dropdown?.classList.remove('show');
            }
        });
    },
    async ensureConsumer() {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const { user } = await response.json();
        if (!user || user.role === 'admin') {
            window.location.href = '/dashboard/admin';
            return;
        }
        this.user = user;
        document.getElementById('userGreeting').textContent = user.username;
        document.getElementById('userInitials').textContent = user.username.slice(0, 2).toUpperCase();
    },
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} position-fixed top-0 end-0 m-3 shadow`;
        alert.style.zIndex = 1100;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close ms-3" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 4000);
    },
    async logout() {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    }
};

window.ConsumerShell = ConsumerShell;

document.addEventListener('DOMContentLoaded', () => {
    ConsumerShell.init();
});

