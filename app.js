/* app.js */

/* ==========================================
   1. FUNGSI PEMBANTU (HELPERS)
   ========================================== */
const el = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtIDR(v){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(v); }

const PRICES = {"Kiloan":8000,"Satuan":15000,"Karpet":20000};
let currentUser = null;

/* ==========================================
   2. LOGIKA AUTENTIKASI (LOGIN & DAFTAR)
   ========================================== */
window.toggleAuth = (isRegister) => {
    if(el('#login-form-container')) el('#login-form-container').classList.toggle('hidden', isRegister);
    if(el('#register-form-container')) el('#register-form-container').classList.toggle('hidden', !isRegister);
};

if(el('#regBtn')) {
    el('#regBtn').onclick = async () => {
        const user = {
            username: el('#regUser').value, password: el('#regPass').value,
            name: el('#regName').value, phone: el('#regPhone').value, role: 'Pelanggan'
        };

        if(!user.username || !user.password || !user.name) {
            Swal.fire('Oops', 'Lengkapi semua data pendaftaran', 'warning'); return;
        }

        try {
            const res = await fetch('/.netlify/functions/auth', {
                method: 'POST', body: JSON.stringify({ action: 'register', ...user })
            });
            const data = await res.json();
            
            if(res.ok) {
                Swal.fire('Berhasil!', 'Akun Anda sudah aktif. Silakan login.', 'success');
                toggleAuth(false);
            } else { throw new Error(data.error || 'Username mungkin sudah dipakai'); }
        } catch (e) { Swal.fire('Gagal!', e.message, 'error'); }
    };
}

if(el('#loginBtn')) {
    el('#loginBtn').onclick = async () => {
        const u = el('#loginUser').value, p = el('#loginPass').value, r = el('#loginRole').value;
        
        // Bypass Demo
        if(u === 'admin' && p === '123' && r === 'Admin'){
            localStorage.setItem('SIML_user', JSON.stringify({username:'admin', name:'Super Admin', role:'Admin'}));
            loadSession(); return;
        }

        try {
            const res = await fetch('/.netlify/functions/auth', {
                method: 'POST', body: JSON.stringify({ action: 'login', username: u, password: p, role: r })
            });
            
            if(res.ok) {
                const user = await res.json();
                localStorage.setItem('SIML_user', JSON.stringify(user));
                Swal.fire({ title: 'Berhasil Login', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                loadSession();
            } else { Swal.fire('Error', 'Username atau Password salah!', 'error'); }
        } catch (e) { Swal.fire('Error Jaringan', 'Cek koneksi database Anda', 'error'); }
    };
}

if(el('#logoutBtn')) {
    el('#logoutBtn').onclick = () => { localStorage.removeItem('SIML_user'); location.reload(); };
}

/* ==========================================
   3. MANAJEMEN SESI & PROFIL
   ========================================== */
async function loadSession(){
    const raw = localStorage.getItem('SIML_user'); 
    currentUser = raw ? JSON.parse(raw) : null;
    
    if(!currentUser){ 
        if(el('#sidebar')) el('#sidebar').classList.add('hidden'); 
        if(el('#login-view')) el('#login-view').classList.remove('hidden'); 
        return; 
    }
    
    if(el('#login-view')) el('#login-view').classList.add('hidden'); 
    if(el('#sidebar')) el('#sidebar').classList.remove('hidden');
    
    updateProfileUI();
    
    if(currentUser.role === 'Admin'){
        $$('.nav-item-pelanggan').forEach(e => e.classList.add('hidden'));
        $$('.nav-item-admin').forEach(e => e.classList.remove('hidden'));
        switchView('admin-container', 'Panel Kontrol Admin');
    } else {
        $$('.nav-item-pelanggan').forEach(e => e.classList.remove('hidden'));
        $$('.nav-item-admin').forEach(e => e.classList.add('hidden'));
        
        if(el('#lndName')) el('#lndName').value = currentUser.name;
        if(el('#lndContact')) el('#lndContact').value = currentUser.phone || '';
        
        switchView('input-view', 'Input Pesanan');
    }
    updateBadges();
}

function updateProfileUI() {
    if(!currentUser) return;
    const photo = currentUser.photo_url || `https://ui-avatars.com/api/?name=${currentUser.name}&background=0D8ABC&color=fff`;
    
    if(el('#sideAvatar')) el('#sideAvatar').src = photo;
    if(el('#topAvatar')) el('#topAvatar').src = photo;
    if(el('#profilePreview')) el('#profilePreview').src = photo;
    if(el('#profNameDisplay')) el('#profNameDisplay').textContent = currentUser.name;
    if(el('#profUsername')) el('#profUsername').textContent = `@${currentUser.username}`;
    if(el('#profPhone')) el('#profPhone').textContent = currentUser.phone || '-';
    if(el('#sideUserName')) el('#sideUserName').textContent = currentUser.name;
    if(el('#userChipTop')) el('#userChipTop').textContent = currentUser.name;
}

if(el('#photoUpload')){
    el('#photoUpload').onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            currentUser.photo_url = reader.result;
            localStorage.setItem('SIML_user', JSON.stringify(currentUser));
            updateProfileUI();
            Swal.fire({ title: 'Foto Diperbarui', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        };
        reader.readAsDataURL(file);
    };
}

/* ==========================================
   4. NAVIGASI (VIEW SWITCHER)
   ========================================== */
window.switchView = function(id, title = "Dashboard"){
    $$('section').forEach(s => { if(s.id !== 'login-view') s.classList.add('hidden'); });
    const target = el(`#${id}`); if(target) target.classList.remove('hidden');
    
    if(el('#currentViewTitle')) el('#currentViewTitle').textContent = title;

    $$('#sidebar button').forEach(b => { b.classList.remove('bg-white/20'); });
    const btn = el(`[data-view="${id}"]`); 
    if(btn) btn.classList.add('bg-white/20');
    
    if(id==='input-view') renderMyActive();
    if(id==='status-view') renderHistory();
    if(id==='payment-view') renderCustomerPayment();
    if(id==='admin-container') renderAdminAll();
}

$$('[data-view]').forEach(b => b.addEventListener('click', (e)=> {
    const title = e.currentTarget.textContent.replace(/[^a-zA-Z\s]/g, '').trim();
    switchView(b.dataset.view, title);
}));

if(el('#menuToggle')) { el('#menuToggle').addEventListener('click', ()=>el('#sidebar').classList.toggle('hidden')); }

/* ==========================================
   5. LOGIKA DATA LAUNDRY
   ========================================== */
async function fetchTrans() {
    try {
        const response = await fetch('/.netlify/functions/api');
        if (!response.ok) return [];
        return await response.json(); 
    } catch (err) { return []; }
}

if(el('#calcPreview')) {
    el('#calcPreview').addEventListener('click', ()=>{
        const p = PRICES[el('#lndService').value] || 0;
        const q = parseFloat(el('#lndQty').value) || 0;
        if(el('#previewCost')) el('#previewCost').textContent = fmtIDR(p*q);
    });
}

if(el('#submitLaundry')) {
    el('#submitLaundry').addEventListener('click', async ()=>{
        const nm=el('#lndName').value, ct=el('#lndContact').value, sv=el('#lndService').value, qt=el('#lndQty').value, ds=el('#lndDesc').value;
        if(!nm || !qt){ Swal.fire('Oops', 'Data tidak lengkap', 'warning'); return; }
        
        const btn = el('#submitLaundry');
        btn.innerHTML = 'Memproses...'; btn.disabled = true;

        try {
            const payload = {
                id: 'TRX-' + Math.floor(Math.random()*10000), 
                customer_name: nm, contact: ct, service_type: sv, 
                qty: parseFloat(qt), description: ds, 
                total_price: PRICES[sv]*parseFloat(qt), 
                created_by: currentUser.username
            };

            const res = await fetch('/.netlify/functions/api', { method: 'POST', body: JSON.stringify(payload) });

            if(res.ok) {
                Swal.fire('Berhasil!', 'Pesanan berhasil dibuat', 'success');
                el('#lndQty').value = 1; el('#lndDesc').value = '';
                renderMyActive(); updateBadges();
            } else { throw new Error('Gagal menyimpan'); }
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
        
        btn.innerHTML = 'Kirim Pesanan'; btn.disabled = false;
    });
}

async function renderMyActive(){
    if(!currentUser) return;
    if(el('#myActiveTransactions')) el('#myActiveTransactions').innerHTML = '<div class="h-16 w-full rounded-2xl bg-gray-200 animate-pulse"></div>';
    
    const all = await fetchTrans();
    const my = all.filter(x => x.created_by === currentUser.username && x.status_laundry !== 'Diambil');
    
    if(el('#myActiveTransactions')) {
        el('#myActiveTransactions').innerHTML = my.length ? my.map(x=>`
        <div class="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
            <div><div class="font-bold text-gray-800">${x.service_type} (${x.qty})</div><div class="text-xs text-gray-500">${x.id}</div></div>
            <span class="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-xl">${x.status_laundry}</span>
        </div>`).join('') : '<div class="text-center text-sm text-gray-400 py-4">Belum ada pesanan aktif</div>';
    }
}

async function renderHistory(){
    if(el('#historyTableWrap')) el('#historyTableWrap').innerHTML = '<div class="h-32 w-full rounded-2xl bg-gray-200 animate-pulse"></div>';
    const all = await fetchTrans();
    const my = all.filter(x => x.created_by === currentUser.username);
    
    if(el('#historyTableWrap')) {
        el('#historyTableWrap').innerHTML = `<table class="w-full text-sm text-left"><thead class="bg-gray-50 text-gray-500"><tr><th class="p-4">ID</th><th class="p-4">Layanan</th><th class="p-4">Total</th><th class="p-4">Status</th></tr></thead><tbody>
        ${my.map(x=>`<tr class="border-b"><td class="p-4 font-mono text-xs">${x.id}</td><td class="p-4">${x.service_type}</td><td class="p-4 font-bold">${fmtIDR(x.total_price)}</td><td class="p-4"><span class="bg-gray-100 px-3 py-1 rounded-xl text-xs font-bold">${x.status_laundry}</span></td></tr>`).join('')}
        </tbody></table>`;
    }
}

/* ==========================================
   6. LOGIKA PEMBAYARAN
   ========================================== */
async function renderCustomerPayment(){
    if(!currentUser) return;
    const all = await fetchTrans();
    const unpaid = all.filter(x => x.created_by === currentUser.username && x.status_payment !== 'Lunas');
    const container = el('#customerUnpaidList');
    if(!container) return;
    
    if(unpaid.length === 0){ 
        container.innerHTML = `<div class="bg-white rounded-3xl p-10 text-center border border-gray-100"><div class="text-6xl mb-4">🎉</div><h3 class="text-xl font-bold text-gray-800">Semua Beres!</h3><p class="text-gray-500">Tidak ada tagihan yang perlu dibayar.</p></div>`; 
        return; 
    }

    container.innerHTML = unpaid.map(tx => {
        let badge = `<span class="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold">Belum Dibayar</span>`;
        let btn = `<button onclick="openPayModal('${tx.id}', ${tx.total_price})" class="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md">Bayar</button>`;
        if(tx.status_payment === 'Menunggu Validasi'){
            badge = `<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Menunggu Validasi</span>`;
            btn = `<button disabled class="bg-gray-100 text-gray-400 px-5 py-2.5 rounded-xl text-sm font-bold cursor-not-allowed">Diproses</button>`;
        }
        return `<div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-4 flex justify-between items-center"><div class="flex-1"> ${badge} <h4 class="font-bold text-lg mt-2">${tx.service_type} (${tx.qty})</h4><div class="text-xs text-gray-400 font-mono">${tx.id}</div></div><div class="text-right"><div class="text-xl font-black text-sky-600 mb-2">${fmtIDR(tx.total_price)}</div>${btn}</div></div>`;
    }).join('');
}

window.openPayModal = function(id, total){
    if(el('#modalPayId')) el('#modalPayId').textContent = id; 
    if(el('#modalPayTotal')) el('#modalPayTotal').textContent = fmtIDR(total); 
    if(el('#payModal')) {
        el('#payModal').classList.remove('hidden'); 
        setTimeout(()=>el('#payModal > div').classList.remove('scale-90'), 10);
        el('#payModal').dataset.trxId = id;
    }
}

if(el('#closePayModal')) {
    el('#closePayModal').onclick = () => { 
        if(el('#payModal > div')) el('#payModal > div').classList.add('scale-90'); 
        if(el('#payModal')) setTimeout(()=>el('#payModal').classList.add('hidden'), 300); 
    };
}

if(el('#submitPaymentProof')) {
    el('#submitPaymentProof').onclick = async () => {
        const id = el('#payModal').dataset.trxId;
        const method = el('#payMethodInput').value, sender = el('#paySenderInput').value;
        if(!sender){ Swal.fire('Oops','Isi nama pengirim','warning'); return; }
        
        el('#submitPaymentProof').textContent = "Mengirim...";
        try {
            await fetch('/.netlify/functions/api', {
                method: 'PUT',
                body: JSON.stringify({ action: 'confirm_payment', id: id, method: method, sender: sender })
            });
            Swal.fire('Terkirim!', 'Bukti transfer sedang diproses admin', 'success');
            if(el('#closePayModal')) el('#closePayModal').click(); 
            renderCustomerPayment();
        } catch(e) { Swal.fire('Error', 'Gagal mengirim', 'error'); }
        el('#submitPaymentProof').textContent = "Kirim Bukti Pembayaran";
    };
}

/* ==========================================
   7. LOGIKA ADMIN
   ========================================== */
const adminTabs = $$('.admin-tab');
if(adminTabs.length > 0) {
    adminTabs.forEach((btn,i) => btn.onclick = () => {
        adminTabs.forEach(b => { b.classList.remove('bg-white','text-sky-600','shadow-md'); b.classList.add('text-gray-500'); });
        btn.classList.add('bg-white','text-sky-600','shadow-md'); btn.classList.remove('text-gray-500');
        $$('.admin-sub-view').forEach(v=>v.classList.add('hidden'));
        if(i===0){ 
            if(el('#admin-manage-view')) el('#admin-manage-view').classList.remove('hidden'); 
            renderAdminAll(); 
        }
        if(i===1){ 
            if(el('#admin-payment-view')) el('#admin-payment-view').classList.remove('hidden'); 
            renderAdminPayment(); 
        }
    });
}

async function renderAdminAll(){
    const all = await fetchTrans();
    if(el('#allTransactions')) {
        el('#allTransactions').innerHTML = `<table class="w-full text-sm text-left"><thead class="bg-gray-50 border-b border-gray-100"><tr><th class="p-4">ID</th><th class="p-4">Pelanggan</th><th class="p-4">Status</th><th class="p-4">Pembayaran</th></tr></thead><tbody>
        ${all.map(x=>`<tr class="border-b cursor-pointer hover:bg-sky-50 transition-colors" onclick="fillAdminInputs('${x.id}')"><td class="p-4 font-mono text-xs">${x.id}</td><td class="p-4 font-bold">${x.customer_name}</td><td class="p-4"><span class="px-3 py-1 rounded-xl bg-gray-100 text-xs font-bold">${x.status_laundry}</span></td><td class="p-4"><span class="${x.status_payment==='Lunas'?'text-emerald-600 bg-emerald-50':'text-rose-600 bg-rose-50'} px-3 py-1 rounded-xl font-bold text-xs">${x.status_payment}</span></td></tr>`).join('')}</tbody></table>`;
    }
}

window.fillAdminInputs = function(id){
    if(el('#adminTransId')) el('#adminTransId').value = id;
    if(el('#adminNewStatus')) el('#adminNewStatus').value = 'NoChange';
    if(el('#adminNewPayStatus')) el('#adminNewPayStatus').value = 'NoChange'; 
}

if(el('#updateStatusBtn')) {
    el('#updateStatusBtn').onclick = async () => {
        const id = el('#adminTransId').value.trim();
        const sl = el('#adminNewStatus').value;
        const sp = el('#adminNewPayStatus').value; 
        if(!id) return;

        try {
            await fetch('/.netlify/functions/api', {
                method: 'PUT',
                body: JSON.stringify({ 
                    action: 'admin_update', id: id, 
                    status_laundry: sl !== 'NoChange' ? sl : null, 
                    status_payment: sp !== 'NoChange' ? sp : null 
                })
            });
            Swal.fire({ title: 'Diperbarui', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            renderAdminAll();
        } catch(e) {}
    };
}

async function renderAdminPayment(){
    const all = await fetchTrans();
    const pend = all.filter(x => x.status_payment === 'Menunggu Validasi');
    
    if(el('#pendingCount')) el('#pendingCount').textContent = pend.length;
    if(el('#confirmedCount')) el('#confirmedCount').textContent = all.filter(x=>x.status_payment==='Lunas').length;
    
    if(el('#adminPendingList')) {
        el('#adminPendingList').innerHTML = pend.length ? pend.map(x=>`
            <div class="border rounded-2xl p-4 flex justify-between items-center bg-gray-50 mb-3">
                <div><div class="font-bold text-lg">${fmtIDR(x.total_price)}</div><div class="text-xs font-mono text-gray-500">${x.id} • ${x.payment_method || '-'} (${x.payment_sender || '-'})</div></div>
                <div class="flex gap-2"><button onclick="admDecide('${x.id}',true)" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Terima</button></div>
            </div>`).join('') : '<div class="text-gray-400 italic">Bersih! Tidak ada request baru</div>';
    }
}

window.admDecide = async function(id, approve){
    try {
        await fetch('/.netlify/functions/api', {
            method: 'PUT',
            body: JSON.stringify({ action: 'admin_update', id: id, status_payment: approve ? 'Lunas' : 'Belum Lunas' })
        });
        Swal.fire('Sukses', 'Status pembayaran diubah', 'success');
        renderAdminPayment();
    } catch(e){}
};

async function updateBadges(){
    if(!currentUser || currentUser.role === 'Admin') return;
    const all = await fetchTrans();
    const unpaid = all.filter(x => x.created_by === currentUser.username && x.status_payment !== 'Lunas');
    const badge = el('#payBadge');
    if(badge) {
        if(unpaid.length > 0) { badge.textContent = unpaid.length; badge.classList.remove('hidden'); } 
        else { badge.classList.add('hidden'); }
    }
}

if(el('#resetSeed')) {
    el('#resetSeed').onclick = () => { localStorage.clear(); location.reload(); };
}

// INIT
loadSession();