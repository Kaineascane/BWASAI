const adminNav = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-gauge', href: '/dashboard/admin' },
    { id: 'users', label: 'User Management', icon: 'fas fa-users', href: '/dashboard/admin/user-management' },
    { id: 'billing', label: 'Billing Management', icon: 'fas fa-file-invoice-dollar', href: '/dashboard/admin/billing' },
    { id: 'reports', label: 'Reports', icon: 'fas fa-download', href: '/dashboard/admin/reports' },
    { id: 'support', label: 'Support', icon: 'fas fa-headset', href: '/dashboard/admin/support' },
    { id: 'settings', label: 'Settings', icon: 'fas fa-gear', href: '/dashboard/admin/settings' }
];

const AdminShell = {
    user: null,
    async init() {
        const shell = document.getElementById('admin-shell');
        if (!shell) return;
        const activePage = document.body.dataset.page || 'dashboard';
        shell.innerHTML = `
            <div class="app-shell">
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar-header" id="sidebarLogo" style="cursor: pointer;" onclick="window.location.href='/dashboard/admin'">
                        <img src="/assets/logo.svg" alt="BWSAI logo">
                        <div>
                            <strong>BWSAI</strong><br>
                            <small>Admin Console</small>
                        </div>
                    </div>
                    <nav class="nav-menu">
                        ${adminNav.map(item => `
                            <a class="nav-link ${activePage === item.id ? 'active' : ''}" href="${item.href}">
                                <i class="${item.icon}"></i><span class="nav-label">${item.label}</span>
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
                    <header class="top-bar">
                        <div class="brand-group">
                            <button id="sidebarToggle" title="Toggle sidebar"><i class="fas fa-bars"></i></button>
                            <div class="brand-identity" style="cursor: pointer;" onclick="window.location.href='/dashboard/admin'">
                                <img src="/assets/logo.svg" alt="BWSAI icon">
                                <div>
                                    <strong>BWSAI</strong><br>
                                    <small>Barangay Water Smart Access Interface</small>
                                </div>
                            </div>
                        </div>
                        <div class="profile-menu">
                            <div class="profile-trigger" id="profileTrigger">
                                <div class="text-end">
                                    <small class="text-muted d-block">Account</small>
                                    <span id="userName">Administrator</span>
                                </div>
                                <div class="avatar" id="userInitials">BW</div>
                            </div>
                            <div class="profile-dropdown" id="profileDropdown">
                                <button onclick="window.location.href='/dashboard/admin/settings'"><i class="fas fa-gear me-2"></i>Account Settings</button>
                                <button onclick="AdminShell.logout()"><i class="fas fa-sign-out-alt me-2"></i>Log out</button>
                            </div>
                        </div>
                    </header>
                    <section id="pageContainer" class="page-container"></section>
                </main>
            </div>
        `;

        const template = document.getElementById('page-content');
        if (template) {
            const slot = document.getElementById('pageContainer');
            slot.appendChild(template.content.cloneNode(true));
        }

        this.bindUI();
        await this.ensureAdmin();
    },
    bindUI() {
        const sidebar = document.getElementById('sidebar');
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
        document.getElementById('sidebarLogo')?.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
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
    async ensureAdmin() {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const { user } = await response.json();
        if (!user || user.role !== 'admin') {
            window.location.href = '/dashboard/user';
            return;
        }
        this.user = user;
        document.getElementById('userName').textContent = user.username;
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

window.AdminShell = AdminShell;

document.addEventListener('DOMContentLoaded', () => {
    AdminShell.init();
});

