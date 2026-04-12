/* app.js */

// FUNGSI TOGGLE LOGIN / DAFTAR
window.toggleAuth = (isRegister) => {
    el('#login-form-container').classList.toggle('hidden', isRegister);
    el('#register-form-container').classList.toggle('hidden', !isRegister);
};

// REGISTRASI PELANGGAN
el('#regBtn').onclick = async () => {
    const user = {
        username: el('#regUser').value,
        password: el('#regPass').value,
        name: el('#regName').value,
        phone: el('#regPhone').value,
        role: 'Pelanggan'
    };

    try {
        const res = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'register', ...user })
        });
        const data = await res.json();
        if(res.ok) {
            Swal.fire('Berhasil!', 'Akun Anda sudah aktif. Silakan login.', 'success');
            toggleAuth(false);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        Swal.fire('Gagal!', e.message, 'error');
    }
};

// LOGIN REAL
el('#loginBtn').onclick = async () => {
    const u = el('#loginUser').value, p = el('#loginPass').value, r = el('#loginRole').value;
    
    // Bypass Khusus Admin Internal (opsional jika belum daftar di db)
    if(u === 'admin' && p === '123' && r === 'Admin'){
        const adminData = {username:'admin', name:'Super Admin', role:'Admin'};
        localStorage.setItem('SIML_user', JSON.stringify(adminData));
        loadSession();
        return;
    }

    try {
        const res = await fetch('/.netlify/functions/auth', {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: u, password: p, role: r })
        });
        const user = await res.json();
        if(res.ok) {
            localStorage.setItem('SIML_user', JSON.stringify(user));
            loadSession();
        } else {
            Swal.fire('Error', 'Username atau Password salah!', 'error');
        }
    } catch (e) {
        Swal.fire('Error Jaringan', 'Cek koneksi database Anda', 'error');
    }
};

// UPDATE FOTO PROFIL (Base64)
el('#photoUpload').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64Photo = reader.result;
        currentUser.photo_url = base64Photo;
        // Simpan ke local dan DB
        localStorage.setItem('SIML_user', JSON.stringify(currentUser));
        updateProfileUI();
        // Disini tambahkan fetch PUT ke api.js untuk simpan ke Neon permanen
    };
    reader.readAsDataURL(file);
};

function updateProfileUI() {
    if(!currentUser) return;
    const photo = currentUser.photo_url || `https://ui-avatars.com/api/?name=${currentUser.name}`;
    el('#sideAvatar').src = photo;
    el('#topAvatar').src = photo;
    el('#profilePreview').src = photo;
    el('#profNameDisplay').textContent = currentUser.name;
    el('#profUsername').textContent = `@${currentUser.username}`;
    el('#profPhone').textContent = currentUser.phone || '-';
    el('#sideUserName').textContent = currentUser.name;
    el('#userChipTop').textContent = currentUser.name;
}