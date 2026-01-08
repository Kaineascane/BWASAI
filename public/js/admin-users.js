document.addEventListener('DOMContentLoaded', async () => {
    await AdminShell.ensureAdmin();
    document.getElementById('userCreationForm').addEventListener('submit', createUserAccount);
    loadUserAccounts();
});

let editModal = null;

async function loadUserAccounts() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Unable to load users');
        const { users } = await response.json();
        const tbody = document.getElementById('userListBody');
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No consumer accounts found</td></tr>';
            return;
        }
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username || '-'}</td>
                <td>${user.name || '-'}</td>
                <td>${user.email || '-'}</td>
                <td>${user.phone || '-'}</td>
                <td>${user.address || '-'}</td>
                <td><span class="badge bg-${user.status === 'active' ? 'success' : 'secondary'}">${user.status || 'active'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editAccount(${user.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAccount(${user.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Initialize modal
        if (!editModal) {
            editModal = new bootstrap.Modal(document.getElementById('editAccountModal'));
        }
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

async function createUserAccount(event) {
    event.preventDefault();
    const payload = {
        username: document.getElementById('newUsername').value,
        email: document.getElementById('newEmail').value,
        password: document.getElementById('newPassword').value,
        name: document.getElementById('newName').value,
        phone: document.getElementById('newPhone').value,
        address: document.getElementById('newAddress').value
    };
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to create account');
        }
        AdminShell.showAlert('Consumer account created successfully.', 'success');
        event.target.reset();
        loadUserAccounts();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

async function editAccount(userId) {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Unable to load user data');
        const { users } = await response.json();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            AdminShell.showAlert('User not found', 'danger');
            return;
        }
        
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editName').value = user.name || '';
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editAddress').value = user.address || '';
        document.getElementById('editPassword').value = '';
        
        if (!editModal) {
            editModal = new bootstrap.Modal(document.getElementById('editAccountModal'));
        }
        editModal.show();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

async function saveAccountChanges() {
    const userId = document.getElementById('editUserId').value;
    const payload = {
        username: document.getElementById('editUsername').value,
        email: document.getElementById('editEmail').value,
        name: document.getElementById('editName').value,
        phone: document.getElementById('editPhone').value,
        address: document.getElementById('editAddress').value
    };
    
    const password = document.getElementById('editPassword').value;
    if (password) {
        payload.password = password;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to update account');
        }
        AdminShell.showAlert('Account updated successfully.', 'success');
        editModal.hide();
        loadUserAccounts();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

async function deleteAccount(userId) {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to delete account');
        }
        AdminShell.showAlert('Account deleted successfully.', 'success');
        loadUserAccounts();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}
