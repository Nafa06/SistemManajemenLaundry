/* app.js */
const el = s => document.querySelector(s); 
const $$ = s => Array.from(document.querySelectorAll(s));
const toast = el('#toast');

function showToast(msg){ 
    el('#toastText').textContent = msg; 
    toast.classList.remove('hidden'); 
    toast.style.opacity='1'; 
    toast.style.transform='translateY(0)'; 
    clearTimeout(window._t); 
    window._t = setTimeout(()=>{ 
        toast.style.opacity='0'; 
        toast.style.transform='translateY(10px)'; 
        setTimeout(()=>toast.classList.add('hidden'),300); 
    }, 3000); 
}

const ACCOUNTS = [
    {username:'admin',password:'123',role:'Admin',name:'Admin Laundry'},
    {username:'pelanggan',password:'123',role:'Pelanggan',name:'Pelanggan Demo'}
];
const PRICES = {"Kiloan":8000,"Satuan":15000,"Karpet":20000};
let currentUser = null;
let adminChartInstance = null;

function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtIDR(v){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(v); }

// SIMULASI API ASYNC (Siap diganti ke fetch API Neon nantinya)
async function fetchTrans(){ 
    return new Promise(resolve => {
        let data = JSON.parse(localStorage.getItem('SIML_trans'));
        if(!data){
            data = [
                {id:'TRANS-101',service:'Kiloan',qty:4,desc:'Baju Harian',date:todayISO(),by:'pelanggan',status:'Selesai',status_payment:'Belum Lunas',total:32000},
                {id:'TRANS-102',service:'Satuan',qty:2,desc:'Jas',date:todayISO(),by:'pelanggan',status:'Dicuci',status_payment:'Belum Lunas',total:30000}
            ];
            localStorage.setItem('SIML_trans', JSON.stringify(data));
        }
        resolve(data);
    });
}
async function saveTrans(v){ 
    return new Promise(resolve => {
        localStorage.setItem('SIML_trans', JSON.stringify(v));
        resolve(true);
    });
}

async function loadSession(){
    const raw = localStorage.getItem('SIML_user'); 
    currentUser = raw ? JSON.parse(raw) : null;
    
    if(!currentUser){ 
        el('#sidebar').classList.add('hidden'); 
        el('#login-view').classList.remove('hidden'); 
        return; 
    }
    
    el('#login-view').classList.add('hidden'); 
    el('#sidebar').classList.remove('hidden');
    el('#userChip').textContent = `${currentUser.name} • ${currentUser.role}`; 
    el('#userChip').classList.remove('hidden');
    el('#userChipTop').textContent = currentUser.name; 
    el('#userChipTop').classList.remove('hidden'); 
    el('#logoutBtn').classList.remove('hidden');
    
    if(currentUser.role === 'Admin'){
        $$('.nav-item-pelanggan').forEach(e => e.classList.add('hidden'));
        $$('.nav-item-admin').forEach(e => e.classList.remove('hidden'));
        switchView('admin-container');
    } else {
        $$('.nav-item-pelanggan').forEach(e => e.classList.remove('hidden'));
        $$('.nav-item-admin').forEach(e => e.classList.add('hidden'));
        switchView('input-view');
    }
    updateBadges();
}

async function switchView(id){
    $$('section').forEach(s => { if(s.id !== 'login-view') s.classList.add('hidden'); });
    const target = el(`#${id}`); if(target) target.classList.remove('hidden');
    
    $$('#sidebar button').forEach(b => {
        b.classList.remove('bg-white/20','text-white','shadow-md');
        b.classList.add('text-sky-50');
    });
    const btn = el(`[data-view="${id}"]`); 
    if(btn) {
        btn.classList.add('bg-white/20','text-white','shadow-md');
        btn.classList.remove('text-sky-50');
    }
    
    if(id==='input-view') renderMyActive();
    if(id==='status-view') renderHistory();
    if(id==='payment-view') renderCustomerPayment();
    if(id==='admin-container') renderAdminAll();
}

$$('[data-view]').forEach(b => b.addEventListener('click', ()=>switchView(b.dataset.view)));
el('#menuToggle').addEventListener('click', ()=>el('#sidebar').classList.toggle('hidden'));
el('#logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('SIML_user'); currentUser=null; location.reload(); });

el('#loginBtn').addEventListener('click', ()=>{
    const u=el('#loginUser').value, p=el('#loginPass').value, r=el('#loginRole').value;
    const acc = ACCOUNTS.find(a=>a.username===u && a.password===p && a.role===r);
    if(acc){ 
        localStorage.setItem('SIML_user',JSON.stringify(acc)); 
        loadSession(); 
        showToast('Login Berhasil'); 
    } else {
        showToast('Login Gagal');
    }
});

el('#calcPreview').addEventListener('click', ()=>{
    const p = PRICES[el('#lndService').value] || 0;
    const q = parseFloat(el('#lndQty').value) || 0;
    el('#previewCost').textContent = fmtIDR(p*q);
});

el('#submitLaundry').addEventListener('click', async ()=>{
    const nm=el('#lndName').value, ct=el('#lndContact').value, sv=el('#lndService').value, qt=el('#lndQty').value, ds=el('#lndDesc').value;
    if(!nm || !qt){ showToast('Data tidak lengkap'); return; }
    
    const all = await fetchTrans();
    all.push({
        id:'TRANS-'+Date.now().toString().slice(-4), 
        service:sv, qty:parseFloat(qt), desc:ds, date:todayISO(), 
        by:currentUser.username, status:'Ditambahkan', status_payment:'Belum Lunas', 
        total:PRICES[sv]*parseFloat(qt) 
    });
    
    await saveTrans(all);
    renderMyActive(); 
    showToast('Transaksi disimpan');
    updateBadges();
});

async function renderMyActive(){
    if(!currentUser) return;
    const all = await fetchTrans();
    const my = all.filter(x=>x.by===currentUser.username && x.status!=='Diambil');
    el('#myActiveTransactions').innerHTML = my.length ? my.map(x=>`
    <div class="flex justify-between items-center py-3 border-b last:border-0">
        <div><div class="font-bold text-gray-800">${x.service} (${x.qty})</div><div class="text-xs text-gray-500">${x.id} • ${fmtIDR(x.total)}</div></div>
        <span class="px-2 py-1 bg-sky-50 text-sky-700 text-xs rounded">${x.status}</span>
    </div>`).join('') : '<div class="text-gray-400 italic">Tidak ada transaksi</div>';
}

async function renderHistory(){
    const q = el('#searchTrans').value.toLowerCase();
    const st = el('#filterStatus').value;
    const dt = el('#filterDate').value;
    const all = await fetchTrans();
    const my = all.filter(x=>x.by===currentUser.username);
    const fil = my.filter(x=> (!q || x.id.toLowerCase().includes(q)) && (!st || x.status===st) && (!dt || x.date===dt));
    
    el('#historyTableWrap').innerHTML = `<table class="w-full text-sm text-left"><thead class="bg-gray-50 text-gray-500"><tr><th class="p-3">ID</th><th class="p-3">Layanan</th><th class="p-3">Total</th><th class="p-3">Status</th></tr></thead><tbody>
    ${fil.map(x=>`<tr class="border-b hover:bg-gray-50"><td class="p-3 font-mono text-xs">${x.id}</td><td class="p-3">${x.service} (${x.qty})</td><td class="p-3 font-medium">${fmtIDR(x.total)}</td><td class="p-3"><span class="bg-gray-100 px-2 py-1 rounded text-xs">${x.status}</span></td></tr>`).join('')}
    </tbody></table>`;
    
    el('#searchTrans').oninput=renderHistory; 
    el('#filterStatus').onchange=renderHistory; 
    el('#filterDate').onchange=renderHistory;
}

async function renderCustomerPayment(){
    if(!currentUser) return;
    const all = await fetchTrans();
    const unpaid = all.filter(x => x.by === currentUser.username && x.status_payment !== 'Lunas');
    const container = el('#customerUnpaidList');
    
    if(unpaid.length === 0){ 
        container.innerHTML = `<div class="bg-white rounded-2xl p-8 text-center border border-gray-100"><div class="text-green-500 text-5xl mb-4">🎉</div><h3 class="text-lg font-bold text-gray-800">Semua Beres!</h3><p class="text-gray-500">Tidak ada tagihan yang perlu dibayar.</p></div>`; 
        return; 
    }

    container.innerHTML = unpaid.map(tx => {
        let statusBadge = `<span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">Belum Dibayar</span>`;
        let actionBtn = `<button onclick="openPayModal('${tx.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition">Bayar Sekarang</button>`;
        
        if(tx._awaiting_validation){
            statusBadge = `<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Menunggu Konfirmasi</span>`;
            actionBtn = `<button disabled class="bg-gray-100 text-gray-400 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed">Sedang Diproses</button>`;
        }
        return `<div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition hover:shadow-md"><div class="flex justify-between items-start mb-4"><div><div class="text-xs text-gray-400 font-mono mb-1">${tx.id}</div><h4 class="font-bold text-gray-800 text-lg">${tx.service} (${tx.qty})</h4><div class="text-sm text-gray-500">${tx.date}</div></div>${statusBadge}</div><div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-50"><div><div class="text-xs text-gray-400">Total Tagihan</div><div class="text-xl font-bold text-sky-600">${fmtIDR(tx.total)}</div></div>${actionBtn}</div></div>`;
    }).join('');
}

window.openPayModal = async function(id){
    const all = await fetchTrans();
    const tx = all.find(x => x.id === id); 
    if(!tx) return;
    
    el('#modalPayId').textContent = id; 
    el('#modalPayTotal').textContent = fmtIDR(tx.total); 
    el('#payModal').classList.remove('hidden'); 
    setTimeout(()=>el('#payModal > div').classList.remove('scale-95'), 10);
    
    el('#submitPaymentProof').onclick = async () => {
        const method = el('#payMethodInput').value, sender = el('#paySenderInput').value;
        if(!sender){ alert('Mohon isi nama pengirim'); return; }
        
        tx._awaiting_validation = true; 
        tx.requestedPayMethod = method; 
        tx.payNote = `Pengirim: ${sender}`; 
        
        await saveTrans(all.map(x => x.id === id ? tx : x));
        el('#closePayModal').click(); 
        renderCustomerPayment(); 
        showToast('Konfirmasi pembayaran terkirim');
    };
}

el('#closePayModal').onclick = () => { 
    el('#payModal > div').classList.add('scale-95'); 
    setTimeout(()=>el('#payModal').classList.add('hidden'), 200); 
};

// ADMIN LOGIC
const adminTabs = $$('.admin-tab');
adminTabs.forEach((btn,i) => btn.onclick = () => {
    adminTabs.forEach(b => { b.classList.remove('bg-white','text-sky-700','shadow-sm'); b.classList.add('text-gray-600','hover:bg-gray-200'); });
    btn.classList.add('bg-white','text-sky-700','shadow-sm'); btn.classList.remove('text-gray-600','hover:bg-gray-200');
    $$('.admin-sub-view').forEach(v=>v.classList.add('hidden'));
    
    if(i===0){ el('#admin-manage-view').classList.remove('hidden'); renderAdminAll(); }
    if(i===1){ el('#admin-payment-view').classList.remove('hidden'); renderAdminPayment(); }
});

async function renderAdminAll(){
    const all = await fetchTrans();
    el('#allTransactions').innerHTML = `<table class="w-full text-sm text-left"><thead class="bg-gray-50"><tr><th class="p-3">ID</th><th class="p-3">User</th><th class="p-3">Layanan</th><th class="p-3">Status</th><th class="p-3">Bayar</th></tr></thead><tbody>
    ${all.map(x=>`<tr class="border-b table-row-hover" onclick="fillAdminInputs('${x.id}')"><td class="p-3 font-mono text-xs">${x.id}</td><td class="p-3">${x.by}</td><td class="p-3">${x.service}</td><td class="p-3"><span class="px-2 py-1 rounded bg-gray-100 text-xs">${x.status}</span></td><td class="p-3"><span class="${x.status_payment==='Lunas'?'text-green-600 bg-green-50 px-2 py-1 rounded':'text-red-600 bg-red-50 px-2 py-1 rounded'} font-bold text-xs">${x.status_payment}</span>${x._awaiting_validation?' <span class="text-amber-500 text-xs animate-pulse">●</span>':''}</td></tr>`).join('')}</tbody></table>`;
}

window.fillAdminInputs = async function(id){
    el('#adminTransId').value = id;
    const all = await fetchTrans();
    const tx = all.find(x => x.id === id);
    if(tx) {
        el('#adminNewStatus').value = tx.status;
        el('#adminNewPayStatus').value = "NoChange"; 
    }
    el('#adminTransId').focus();
}

el('#updateStatusBtn').onclick = async () => {
    const id = el('#adminTransId').value.trim();
    const newStatus = el('#adminNewStatus').value;
    const newPay = el('#adminNewPayStatus').value; 

    if(!id) { showToast('Pilih ID Transaksi dulu'); return; }

    const all = await fetchTrans();
    const tx = all.find(x=>x.id===id);
    
    if(tx){ 
        let changes = [];
        if(newStatus !== 'NoChange') { tx.status = newStatus; changes.push(`Status`); }
        if(newPay !== 'NoChange') { 
            tx.status_payment = newPay; 
            if(newPay === 'Lunas') tx._awaiting_validation = false;
            changes.push(`Bayar`); 
        }

        if(changes.length > 0) {
            await saveTrans(all); 
            renderAdminAll(); 
            showToast(`Berhasil diupdate`); 
        } else {
            showToast('Tidak ada perubahan dipilih');
        }
    } else {
        showToast('ID Transaksi tidak ditemukan');
    }
};

async function renderAdminPayment(){
    const all = await fetchTrans();
    
    // Update Counts
    el('#pendingCount').textContent = all.filter(x=>x._awaiting_validation).length;
    el('#confirmedCount').textContent = all.filter(x=>x.status_payment==='Lunas' && x.date===todayISO()).length;
    
    // Render Pending Table
    const pend = all.filter(x => x._awaiting_validation);
    el('#adminPendingList').innerHTML = pend.length ? `<table class="w-full text-sm"><thead class="bg-gray-50 text-left"><tr><th class="p-3">ID</th><th class="p-3">Total</th><th class="p-3">Catatan</th><th class="p-3">Aksi</th></tr></thead><tbody>
    ${pend.map(x=>`<tr class="border-b"><td class="p-3 font-mono text-xs">${x.id}<br><span class="text-gray-400">${x.by}</span></td><td class="p-3 font-bold">${fmtIDR(x.total)}</td><td class="p-3 text-xs"><div class="font-bold text-sky-600">${x.requestedPayMethod}</div><div class="text-gray-500">${x.payNote}</div></td><td class="p-3 flex gap-2"><button onclick="admDecide('${x.id}',true)" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold hover:bg-green-200">Terima</button><button onclick="admDecide('${x.id}',false)" class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">Tolak</button></td></tr>`).join('')}</tbody></table>` : `<div class="p-4 text-center text-gray-400 italic">Tidak ada request baru</div>`;
    
    // Select dropdown
    const sel = el('#adminPayTransId');
    sel.innerHTML = '<option value="">-- Pilih Transaksi --</option>' + all.filter(x=>x.status_payment!=='Lunas').map(x=>`<option value="${x.id}">${x.id} - ${x.by} (${fmtIDR(x.total)})</option>`).join('');

    // Render Chart
    const totalsByService = all.reduce((acc, curr) => {
        acc[curr.service] = (acc[curr.service] || 0) + curr.total;
        return acc;
    }, {});

    const ctx = document.getElementById('adminRevenueChart');
    if(ctx){
        if(adminChartInstance) adminChartInstance.destroy();
        adminChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(totalsByService),
                datasets: [{
                    data: Object.values(totalsByService),
                    backgroundColor: ['#0ea5e9', '#4f46e5', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

window.admDecide = async function(id, approve){
    const all = await fetchTrans(); 
    const tx = all.find(x=>x.id===id); 
    if(!tx) return;
    
    tx._awaiting_validation = false;
    if(approve){ 
        tx.status_payment = 'Lunas'; 
        showToast(`Pembayaran ${id} DITERIMA`); 
    } else { 
        showToast(`Pembayaran ${id} DITOLAK`); 
    }
    
    await saveTrans(all); 
    renderAdminPayment();
};

el('#confirmPaymentAdmin').onclick = () => { const id=el('#adminPayTransId').value; if(id) admDecide(id, true); };
el('#rejectPaymentAdmin').onclick = () => { const id=el('#adminPayTransId').value; if(id) admDecide(id, false); };
el('#resetSeed').onclick = () => { if(confirm('Reset seluruh data?')){ localStorage.removeItem('SIML_trans'); location.reload(); }};

async function updateBadges(){
    if(!currentUser || currentUser.role === 'Admin') return;
    const all = await fetchTrans();
    const unpaid = all.filter(x => x.by === currentUser.username && x.status_payment !== 'Lunas');
    const badge = el('#payBadge');
    if(unpaid.length > 0) { badge.textContent = unpaid.length; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); }
}

// Inisialisasi Aplikasi
loadSession();