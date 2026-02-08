/**
 * FinApex Premium - v4.1 (Fixed Reactivity)
 * Architecture: Wallets (Accounts) vs Savings Targets (Goals)
 */

// --- 0. State & Initialization ---
const translations = {
    en: {
        title: "FINAPEX",
        dashboard: "Dashboard",
        savingsMenu: "Savings Menu",
        totalNet: "Total Net Worth",
        income: "Income (Month)",
        expense: "Expense (Month)",
        noData: "No records found.",
        deleteConfirm: "Are you sure?",
        mainBalance: "Primary Fund",
        accounts: "Accounts (Celengan)",
        goals: "Savings Goals",
        addAccount: "Add Account",
        addGoal: "Set Goal",
        walletName: "Account Name",
        goalName: "Goal Name",
    },
    id: {
        title: "FINAPEX",
        dashboard: "Dashboard",
        savingsMenu: "Menu Tabungan",
        totalNet: "Total Kekayaan",
        income: "Pemasukan (Bulan)",
        expense: "Pengeluaran (Bulan)",
        noData: "Data tidak ditemukan.",
        deleteConfirm: "Hapus data ini?",
        mainBalance: "Saldo Utama",
        accounts: "Daftar Celengan",
        goals: "Target Tabungan",
        addAccount: "Tambah Celengan",
        addGoal: "Buat Target",
        walletName: "Nama Celengan",
        goalName: "Nama Target",
    }
};

const initialState = {
    transactions: [],
    wallets: [
        { id: 'main', name: 'Saldo Utama', balance: 0, createdAt: new Date().toISOString() }
    ],
    savingsTargets: [],
    categories: ['Gaji', 'Makan', 'Transport', 'Belanja', 'Investasi', 'Lainnya'],
    settings: { currency: 'IDR', theme: 'dark', language: 'id' },
    ui: { currentView: 'dashboard', searchQuery: '', currentPage: 1, itemsPerPage: 10 }
};

// Store Holder
let appState = loadData();

function loadData() {
    try {
        const saved = localStorage.getItem('finapex_v4_1');
        return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(initialState));
    } catch (e) {
        return JSON.parse(JSON.stringify(initialState));
    }
}

function saveData() {
    localStorage.setItem('finapex_v4_1', JSON.stringify(appState));
}

// Reactivity Core: Check for changes and render
function setState(updater) {
    if (typeof updater === 'function') {
        appState = updater(appState);
    } else {
        appState = { ...appState, ...updater };
    }
    saveData();
    renderApp();
}

// --- 1. Core Engines ---

function addTransaction(data) {
    const tx = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };

    // Calculate new wallet balances
    const newWallets = appState.wallets.map(w => {
        if (w.id === data.walletId) {
            return {
                ...w,
                balance: data.type === 'in' ? w.balance + data.amount : w.balance - data.amount
            };
        }
        return w;
    });

    setState(prev => ({
        ...prev,
        transactions: [tx, ...prev.transactions],
        wallets: newWallets,
        categories: !prev.categories.includes(data.category) ? [...prev.categories, data.category] : prev.categories
    }));
}

function updateTransaction(id, newData) {
    const old = appState.transactions.find(t => t.id === id);
    if (!old) return;

    // Logic: Revert old effect -> Apply new effect
    // To keep it simple and robust, we recalculate ALL wallets from scratch based on transactions
    // But for performance, we'll do delta updates

    let wList = [...appState.wallets];

    // Revert old
    wList = wList.map(w => {
        if (w.id === old.walletId) {
            return { ...w, balance: old.type === 'in' ? w.balance - old.amount : w.balance + old.amount };
        }
        return w;
    });

    // Apply new
    wList = wList.map(w => {
        if (w.id === newData.walletId) {
            return { ...w, balance: newData.type === 'in' ? w.balance + newData.amount : w.balance - newData.amount };
        }
        return w;
    });

    setState(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === id ? { ...t, ...newData } : t),
        wallets: wList
    }));
}

function deleteTransaction(id) {
    const tx = appState.transactions.find(t => t.id === id);
    if (!tx) return;

    const wList = appState.wallets.map(w => {
        if (w.id === tx.walletId) {
            return { ...w, balance: tx.type === 'in' ? w.balance - tx.amount : w.balance + tx.amount };
        }
        return w;
    });

    setState(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id),
        wallets: wList
    }));
}

// Wallets CRUD
function addWallet(name, initial) {
    const bal = parseFloat(initial) || 0;
    setState(prev => ({
        ...prev,
        wallets: [...prev.wallets, { id: crypto.randomUUID(), name, balance: bal, createdAt: new Date().toISOString() }]
    }));
}

function deleteWallet(id) {
    if (id === 'main') return;
    setState(prev => ({
        ...prev,
        wallets: prev.wallets.filter(w => w.id !== id)
    }));
}

// --- 2. Utils ---
const t = (k) => translations[appState.settings.language][k] || k;
const formatMoney = (v) => new Intl.NumberFormat(appState.settings.language === 'id' ? 'id-ID' : 'en-US', {
    style: 'currency', currency: appState.settings.currency, maximumFractionDigits: 0
}).format(v);
const formatDate = (d) => new Date(d).toLocaleDateString();

// --- 3. UI Controller ---

window.switchView = (v) => {
    setState(prev => ({ ...prev, ui: { ...prev.ui, currentView: v } }));
};

let mainChart = null;

function renderApp() {
    try {
        const now = new Date();
        const totalNet = appState.wallets.reduce((a, w) => a + w.balance, 0);
        const incM = appState.transactions.filter(t => t.type === 'in' && new Date(t.date).getMonth() === now.getMonth()).reduce((a, t) => a + t.amount, 0);
        const expM = appState.transactions.filter(t => t.type === 'out' && new Date(t.date).getMonth() === now.getMonth()).reduce((a, t) => a + t.amount, 0);

        // Global Stats
        safeSetText('totalBalance', formatMoney(totalNet));
        safeSetText('totalIncome', formatMoney(incM));
        safeSetText('totalExpense', formatMoney(expM));

        // View Toggle
        document.querySelectorAll('.view-section').forEach(s => s.classList.toggle('active', s.id === appState.ui.currentView + 'View'));
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.id === 'tab' + appState.ui.currentView.charAt(0).toUpperCase() + appState.ui.currentView.slice(1)));

        // Theme Manager (Fix)
        document.body.dataset.theme = appState.settings.theme;
        safeSetText('themeToggle', appState.settings.theme === 'dark' ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>', true);

        if (appState.ui.currentView === 'dashboard') renderDashboard();
        else renderSavingsView();

        // Populate Selects
        const wSel = document.getElementById('targetWallet');
        if (wSel) {
            const oldW = wSel.value;
            // Only update if wallet list changed length to avoid losing selection on re-render (basic handling)
            // Ideally we check content hash, but for now re-rendering options is safer state sync
            wSel.innerHTML = appState.wallets.map(w => `<option value="${w.id}">${w.name} (${formatMoney(w.balance)})</option>`).join('');
            if (oldW && appState.wallets.some(w => w.id === oldW)) wSel.value = oldW;
        }

        // Populate Categories Datalist (Fix)
        const catList = document.getElementById('catList');
        if (catList) {
            const allCats = [...appState.categories];
            // remove duplicates
            const uniqueCats = [...new Set(allCats)];
            catList.innerHTML = uniqueCats.map(c => `<option value="${c}"></option>`).join('');
        }

        // Translation Updates (Partial)
        safeSetText('tabDashboard', t('dashboard'), true); // true = allow HTML (for icons)
        // Note: Keeping icons requires innerHTML or careful text node updates.
        // For simplicity in this script, we assume static HTML structure for tabs mostly.

        lucide.createIcons();

    } catch (err) {
        console.error("Render Error:", err);
    }
}

function safeSetText(id, text, isHtml = false) {
    const el = document.getElementById(id);
    if (el) {
        if (isHtml) el.innerHTML = text;
        else el.textContent = text;
    }
}

function renderDashboard() {
    const tbody = document.getElementById('transactionBody');
    if (!tbody) return;

    const query = appState.ui.searchQuery.toLowerCase();
    const filtered = appState.transactions.filter(tx =>
        (tx.notes || '').toLowerCase().includes(query) ||
        (tx.category || '').toLowerCase().includes(query)
    );

    tbody.innerHTML = filtered.length ? filtered.slice(0, 10).map(tx => `
        <tr>
            <td>${formatDate(tx.date)}</td>
            <td><span class="type-badge type-in">${tx.category}</span></td>
            <td>${tx.notes || '-'}</td>
            <td><span style="color:${tx.type === 'in' ? 'var(--success)' : 'var(--danger)'}">${tx.type === 'in' ? '+' : '-'}${formatMoney(tx.amount)}</span></td>
            <td>
                <button onclick="editTx('${tx.id}')" class="btn btn-outline btn-icon"><i data-lucide="edit-3" style="width:14px"></i></button>
                <button onclick="delTx('${tx.id}')" class="btn btn-outline btn-icon" style="color:var(--danger)"><i data-lucide="trash-2" style="width:14px"></i></button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center; padding:2rem">${t('noData')}</td></tr>`;

    renderChart();
}

function renderSavingsView() {
    const wGrid = document.getElementById('walletsGrid');
    if (wGrid) {
        wGrid.innerHTML = appState.wallets.map(w => `
            <div class="glass-card account-card">
                <div class="account-header">
                    <span style="font-weight:800; color:var(--text-muted)">${w.name}</span>
                    <div style="display:flex; gap:0.5rem">
                        <button onclick="delWallet('${w.id}')" class="btn btn-outline btn-icon" style="color:var(--danger)"><i data-lucide="trash-2" style="width:14px"></i></button>
                    </div>
                </div>
                <div class="account-balance">${formatMoney(w.balance)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted)">Created ${formatDate(w.createdAt)}</div>
                <div style="font-size:0.7rem; margin-top:0.5rem; color:var(--text-muted)">ID: ...${w.id.slice(-4)}</div>
            </div>
        `).join('');
    }
}

function renderChart() {
    const ctx = document.getElementById('expenseChart')?.getContext('2d');
    if (!ctx) return;
    // Only render chart if visible (optimization)
    if (appState.ui.currentView !== 'dashboard') return;

    const totals = {};
    appState.transactions.filter(t => t.type === 'out').forEach(tx => totals[tx.category] = (totals[tx.category] || 0) + tx.amount);

    if (mainChart) mainChart.destroy();

    // Check if there is data
    if (Object.keys(totals).length === 0) return;

    mainChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { color: '#fff', font: { weight: '600' } } } } }
    });
}

// --- 4. Handlers ---
// Helper to safely attach
function attach(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el[event] = handler;
}

attach('newTransactionBtn', 'onclick', () => {
    document.getElementById('transactionForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('targetDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionModal').style.display = 'flex';
});
attach('closeModal', 'onclick', () => document.getElementById('transactionModal').style.display = 'none');

attach('newWalletBtn', 'onclick', () => {
    document.getElementById('walletForm').reset();
    document.getElementById('walletEditId').value = '';
    document.getElementById('walletModal').style.display = 'flex';
});
window.closeWalletModal = () => document.getElementById('walletModal').style.display = 'none';

attach('transactionForm', 'onsubmit', (e) => {
    e.preventDefault();
    const d = {
        type: document.getElementById('targetType').value,
        walletId: document.getElementById('targetWallet').value,
        category: document.getElementById('targetCategory').value,
        amount: parseFloat(document.getElementById('targetAmount').value),
        date: document.getElementById('targetDate').value,
        notes: document.getElementById('targetNotes').value
    };
    const id = document.getElementById('editId').value;
    if (id) updateTransaction(id, d); else addTransaction(d);
    document.getElementById('transactionModal').style.display = 'none';
});

attach('walletForm', 'onsubmit', (e) => {
    e.preventDefault();
    addWallet(document.getElementById('walletName').value, document.getElementById('walletBalance').value);
    closeWalletModal();
});

// Global Window functions for inline HTML calls
window.editTx = (id) => {
    const tx = appState.transactions.find(t => t.id === id);
    if (!tx) return;
    document.getElementById('editId').value = id;
    document.getElementById('targetType').value = tx.type;
    document.getElementById('targetWallet').value = tx.walletId;
    document.getElementById('targetCategory').value = tx.category;
    document.getElementById('targetAmount').value = tx.amount;
    document.getElementById('targetDate').value = tx.date;
    document.getElementById('targetNotes').value = tx.notes;
    document.getElementById('transactionModal').style.display = 'flex';
};

window.delTx = (id) => { Swal.fire({ title: t('deleteConfirm'), icon: 'warning', showCancelButton: true }).then(r => r.isConfirmed && deleteTransaction(id)); };
window.delWallet = (id) => { if (id === 'main') return; Swal.fire({ title: t('deleteConfirm'), icon: 'warning', showCancelButton: true }).then(r => r.isConfirmed && deleteWallet(id)); };

attach('searchInput', 'oninput', (e) => {
    setState(prev => ({ ...prev, ui: { ...prev.ui, searchQuery: e.target.value } }));
});

attach('langToggle', 'onclick', () => setState(prev => ({ ...prev, settings: { ...prev.settings, language: prev.settings.language === 'id' ? 'en' : 'id' } })));
attach('currToggle', 'onclick', () => setState(prev => ({ ...prev, settings: { ...prev.settings, currency: prev.settings.currency === 'USD' ? 'IDR' : 'USD' } })));
attach('themeToggle', 'onclick', () => {
    const newTheme = appState.settings.theme === 'dark' ? 'light' : 'dark';
    setState(prev => ({ ...prev, settings: { ...prev.settings, theme: newTheme } }));
});

// --- 5. Data Management Logic ---

// Export/Import JSON (Backup/Restore)
attach('exportBtn', 'onclick', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "finapex_backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

attach('importBtn', 'onclick', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.transactions && data.wallets) {
                    setState(() => data);
                    Swal.fire({ title: 'Success', text: 'Data restored successfully!', icon: 'success' });
                } else {
                    Swal.fire({ title: 'Error', text: 'Invalid backup file format.', icon: 'error' });
                }
            } catch (err) {
                Swal.fire({ title: 'Error', text: 'Failed to parse file.', icon: 'error' });
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// CSV Export
attach('exportCsvBtn', 'onclick', () => {
    const headers = ["Date", "Category", "Amount", "Type", "Notes", "Wallet"];
    const rows = appState.transactions.map(t => {
        const wName = appState.wallets.find(w => w.id === t.walletId)?.name || 'Unknown';
        // CSV escaping
        const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
        return [
            t.date,
            escape(t.category),
            t.amount,
            t.type,
            escape(t.notes),
            escape(wName)
        ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finapex_transactions_" + new Date().toISOString().split('T')[0] + ".csv");
    document.body.appendChild(link); // required for firefox
    link.click();
    link.remove();
});

// Initial Render
renderApp();
