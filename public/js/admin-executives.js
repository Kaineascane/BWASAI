let executives = [];
let editModal = null;

async function loadExecutives() {
    try {
        const response = await fetch('/api/executives');
        if (!response.ok) throw new Error('Unable to load executives');
        const data = await response.json();
        executives = data.executives || [];
        renderExecutives();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}

function renderExecutives() {
    const grid = document.getElementById('executivesGrid');
    if (!grid) return;
    
    if (executives.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-muted">No executives found</div>';
        return;
    }
    
    grid.innerHTML = executives.map(exec => `
        <div class="col-md-4 col-lg-3">
            <div class="card">
                <img src="${exec.image_url || 'https://via.placeholder.com/200x200?text=No+Image'}" 
                     class="card-img-top" 
                     alt="${exec.name}"
                     style="height: 200px; object-fit: cover;">
                <div class="card-body">
                    <h6 class="card-title"><strong>${exec.name}</strong></h6>
                    <p class="card-text text-muted mb-2">${exec.title}</p>
                    <button class="btn btn-sm btn-outline-primary w-100" onclick="editExecutive(${exec.id})">
                        <i class="fas fa-edit me-1"></i>Edit
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function editExecutive(id) {
    const executive = executives.find(e => e.id === id);
    if (!executive) {
        AdminShell.showAlert('Executive not found', 'danger');
        return;
    }
    
    document.getElementById('executiveId').value = executive.id;
    document.getElementById('executiveName').value = executive.name;
    document.getElementById('executiveTitle').value = executive.title;
    document.getElementById('executiveImageUrl').value = executive.image_url || '';
    const photoInput = document.getElementById('executivePhoto');
    if (photoInput) {
        photoInput.value = '';
    }
    
    if (!editModal) {
        editModal = new bootstrap.Modal(document.getElementById('editExecutiveModal'));
    }
    editModal.show();
}

async function saveExecutive() {
    const id = document.getElementById('executiveId').value;
    const payload = {
        name: document.getElementById('executiveName').value,
        title: document.getElementById('executiveTitle').value
    };
    const existingImage = document.getElementById('executiveImageUrl').value;
    const photoInput = document.getElementById('executivePhoto');
    
    try {
        if (photoInput && photoInput.files.length) {
            const formData = new FormData();
            formData.append('photo', photoInput.files[0]);
            const uploadResponse = await fetch(`/api/executives/${id}/photo`, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadResponse.json();
            if (!uploadResponse.ok) {
                throw new Error(uploadData.error || 'Unable to upload photo');
            }
            payload.imagePath = uploadData.path;
        } else if (existingImage) {
            payload.image_url = existingImage;
        }

        const response = await fetch(`/api/executives/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to update executive');
        }
        
        AdminShell.showAlert('Executive updated successfully', 'success');
        editModal.hide();
        loadExecutives();
    } catch (error) {
        AdminShell.showAlert(error.message, 'danger');
    }
}


