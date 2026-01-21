const apiBase = '';
let authToken = null;
let currentUser = null;

function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  const roleSpan = document.getElementById('currentUserRole');
  const logoutBtn = document.getElementById('logoutBtn');
  const mainContent = document.getElementById('mainContent');
  const authSection = document.querySelector('.auth-section');

  if (token && user) {
    roleSpan.textContent = `${user.role} (${user.username})`;
    logoutBtn.style.display = 'inline-flex';
    mainContent.style.display = 'block';
    authSection.style.display = 'none'; // Hide login form when logged in
  } else {
    roleSpan.textContent = 'Not logged in';
    logoutBtn.style.display = 'none';
    mainContent.style.display = 'none';
    authSection.style.display = 'block'; // Show login form when logged out
    clearLoginForm(); // Clear any credentials when showing login form
  }
}

function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  headers['Content-Type'] = 'application/json';
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  });
}

function apiFetchBlob(path, options = {}) {
  const headers = options.headers || {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });
}

// Clear login form
function clearLoginForm() {
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginMessage').textContent = '';
  document.getElementById('loginMessage').className = 'message';
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMessage');
  msg.textContent = '';
  msg.className = 'message';
  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuth(data.token, data.user);
    msg.textContent = 'Login successful';
    msg.classList.add('success');
    clearLoginForm(); // Clear credentials after successful login
    loadInitialData();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
    // Clear password field on error for security
    document.getElementById('loginPassword').value = '';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  setAuth(null, null);
  clearLoginForm(); // Clear credentials on logout
});

// Tabs
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Auto-sum income amounts when inputs change
function updateTotalAmount() {
  const inputs = document.querySelectorAll('.income-amount-input');
  let total = 0;
  inputs.forEach((input) => {
    const checkbox = document.querySelector(`input[data-income-type="${input.dataset.incomeType}"]`);
    if (checkbox && checkbox.checked) {
      total += Number(input.value || 0);
    }
  });
  document.getElementById('cbAmount').value = total.toFixed(2);
}

// Add event listeners to income amount inputs
document.querySelectorAll('.income-amount-input').forEach((input) => {
  input.addEventListener('input', updateTotalAmount);
});

// Update checkboxes to trigger total recalculation
document.querySelectorAll('input[name="cbIncomeType"]').forEach((checkbox) => {
  checkbox.addEventListener('change', updateTotalAmount);
});

// Load and display real-time balances
async function loadRealTimeBalances() {
  const month = document.getElementById('cbMonth').value;
  if (!month) return;
  
  try {
    const data = await apiFetch(`/api/cashbook/balances?month=${month}`);
    const tbody = document.getElementById('balanceTableBody');
    tbody.innerHTML = '';
    
    Object.keys(data.balances).forEach((type) => {
      const balance = data.balances[type];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${type}</strong></td>
        <td style="text-align: right; color: ${balance.availableBalance >= 0 ? '#bbf7d0' : '#fecaca'};">
          ${balance.availableBalance.toLocaleString()} UGX
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading balances:', err);
    document.getElementById('balanceTableBody').innerHTML = '<tr><td colspan="2">Error loading balances</td></tr>';
  }
}

// Load balances when month changes
document.getElementById('cbMonth').addEventListener('change', loadRealTimeBalances);

// Quick Deposit Form
document.getElementById('depositForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('depositMessage');
  msg.textContent = '';
  msg.className = 'message';

  const incomeType = document.getElementById('depositIncomeType').value;
  const amount = Number(document.getElementById('depositAmount').value || 0);
  const month = document.getElementById('depositMonth').value;
  const date = document.getElementById('depositDate').value;
  const ref = document.getElementById('depositRef').value || `Deposit to ${incomeType}`;

  if (!incomeType || !amount || amount <= 0) {
    msg.textContent = 'Please select income type and enter a valid amount';
    msg.classList.add('error');
    return;
  }

  try {
    await apiFetch('/api/cashbook', {
      method: 'POST',
      body: JSON.stringify({
        month,
        date,
        incomeType,
        incomeTypes: [incomeType],
        amount,
        amountsByType: { [incomeType]: amount },
        ref,
        operationalCosts: `Deposit: ${ref}`,
        expenses: 0,
      }),
    });

    msg.textContent = `Deposit of ${amount.toLocaleString()} UGX to ${incomeType} successful`;
    msg.classList.add('success');

    // Clear deposit form
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositRef').value = '';

    // Refresh balances and cashbook
    loadRealTimeBalances();
    refreshCashbook();
  } catch (err) {
    msg.textContent = err.message || 'Error processing deposit';
    msg.classList.add('error');
  }
});

// Sync deposit date/month with cashbook form
document.getElementById('cbDate').addEventListener('change', () => {
  document.getElementById('depositDate').value = document.getElementById('cbDate').value;
});

document.getElementById('cbMonth').addEventListener('change', () => {
  document.getElementById('depositMonth').value = document.getElementById('cbMonth').value;
});

document.getElementById('depositDate').addEventListener('change', () => {
  document.getElementById('cbDate').value = document.getElementById('depositDate').value;
});

document.getElementById('depositMonth').addEventListener('change', () => {
  document.getElementById('cbMonth').value = document.getElementById('depositMonth').value;
  loadRealTimeBalances();
});

// Show balance when deposit income type is selected
document.getElementById('depositIncomeType').addEventListener('change', async () => {
  const type = document.getElementById('depositIncomeType').value;
  const display = document.getElementById('depositBalanceDisplay');
  
  if (!type) {
    display.textContent = '';
    return;
  }

  const month = document.getElementById('depositMonth').value;
  if (!month) {
    display.textContent = 'Select month to see balance';
    return;
  }

  try {
    const data = await apiFetch(`/api/cashbook/balances?month=${month}`);
    const balance = data.balances[type];
    if (balance) {
      const color = balance.availableBalance >= 0 ? '#bbf7d0' : '#fecaca';
      display.innerHTML = `Current Balance: <span style="color: ${color};">${balance.availableBalance.toLocaleString()} UGX</span>`;
    }
  } catch (err) {
    display.textContent = 'Unable to load balance';
  }
});

// Update deposit balance display when month changes
document.getElementById('depositMonth').addEventListener('change', () => {
  const type = document.getElementById('depositIncomeType').value;
  if (type) {
    document.getElementById('depositIncomeType').dispatchEvent(new Event('change'));
  }
});

// Load daily totals when date changes
document.getElementById('cbDate').addEventListener('change', async () => {
  const date = document.getElementById('cbDate').value;
  if (!date) return;
  loadRealTimeBalances(); // Also refresh balances
});

// Cashbook form
document.getElementById('cashbookForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('cashbookMessage');
  msg.textContent = '';
  msg.className = 'message';

  // Get selected income types and their individual amounts
  const incomeTypeCheckboxes = document.querySelectorAll('input[name="cbIncomeType"]:checked');
  const incomeTypes = [];
  const amountsByType = new Map();
  
  incomeTypeCheckboxes.forEach((checkbox) => {
    const type = checkbox.value;
    const amountInput = document.querySelector(`.income-amount-input[data-income-type="${type}"]`);
    const amount = Number(amountInput?.value || 0);
    
    if (amount > 0) {
      incomeTypes.push(type);
      amountsByType.set(type, amount);
    }
  });
  
  const singleIncomeType = incomeTypes.length === 1 ? incomeTypes[0] : null;
  const totalAmount = Array.from(amountsByType.values()).reduce((sum, amt) => sum + amt, 0);

  const payload = {
    month: document.getElementById('cbMonth').value,
    date: document.getElementById('cbDate').value,
    incomeType: singleIncomeType,
    incomeTypes: incomeTypes,
    amount: totalAmount,
    amountsByType: Object.fromEntries(amountsByType),
    ref: document.getElementById('cbRef').value || null,
    operationalCosts: document.getElementById('cbOperationalCosts').value || null,
    transactionCharges: Number(document.getElementById('cbTransactionCharges').value || 0),
    recyclables: document.getElementById('cbRecyclables').value || null,
    op: document.getElementById('cbOp').value || null,
    sector: document.getElementById('cbSector').value || null,
    expenses: Number(document.getElementById('cbExpenses').value || 0),
    balance: Number(document.getElementById('cbBalance').value || 0),
    methodOfPayment: document.getElementById('cbMethodOfPayment').value || null,
    wagesCategory: document.getElementById('cbWagesCategory').value || 'NONE',
    name: document.getElementById('cbName').value || null,
    paymentTier: document.getElementById('cbPaymentTier').value || 'NONE',
    salaryAmount: Number(document.getElementById('cbSalaryAmount').value || 0),
    advance: Number(document.getElementById('cbAdvance').value || 0),
    allowance: Number(document.getElementById('cbAllowance').value || 0),
    expenseIncomeType: document.getElementById('cbExpenseIncomeType').value || 'NONE',
  };

  try {
    await apiFetch('/api/cashbook', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    msg.textContent = 'Entry saved';
    msg.classList.add('success');
    
    // Clear income type inputs
    document.querySelectorAll('.income-amount-input').forEach((input) => {
      input.value = '';
      const checkbox = document.querySelector(`input[data-income-type="${input.dataset.incomeType}"]`);
      if (checkbox) checkbox.checked = false;
    });
    document.getElementById('cbAmount').value = '';
    
    refreshCashbook();
    loadRealTimeBalances();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
  }
});

// Internal transfer handler
document.getElementById('cbTransferBtn').addEventListener('click', async () => {
  const fromType = document.getElementById('cbTransferFrom').value;
  const toType = document.getElementById('cbTransferTo').value;
  const amount = Number(document.getElementById('cbTransferAmount').value || 0);
  const date = document.getElementById('cbDate').value;
  const month = document.getElementById('cbMonth').value;
  const msg = document.getElementById('transferMessage');
  
  msg.textContent = '';
  msg.className = 'message';

  if (!fromType || !toType) {
    msg.textContent = 'Please select both From and To income types';
    msg.classList.add('error');
    return;
  }

  if (fromType === toType) {
    msg.textContent = 'Cannot transfer to the same income type';
    msg.classList.add('error');
    return;
  }

  if (!amount || amount <= 0) {
    msg.textContent = 'Please enter a valid amount';
    msg.classList.add('error');
    return;
  }

  if (!date || !month) {
    msg.textContent = 'Please select date and month';
    msg.classList.add('error');
    return;
  }

  try {
    const result = await apiFetch('/api/cashbook/internal-transfer', {
      method: 'POST',
      body: JSON.stringify({
        fromIncomeType: fromType,
        toIncomeType: toType,
        amount: amount,
        date: date,
        month: month,
      }),
    });
    
    msg.textContent = result.message || 'Transfer completed successfully';
    msg.classList.add('success');
    
    // Clear transfer form
    document.getElementById('cbTransferFrom').value = '';
    document.getElementById('cbTransferTo').value = '';
    document.getElementById('cbTransferAmount').value = '';
    
    // Refresh cashbook and balances
    refreshCashbook();
    loadRealTimeBalances();
    const dateInput = document.getElementById('cbDate');
    if (dateInput.value) {
      dateInput.dispatchEvent(new Event('change'));
    }
  } catch (err) {
    msg.textContent = err.message || 'Error processing transfer';
    msg.classList.add('error');
  }
});

// Cashbook filter & print
document.getElementById('cbFilterBtn').addEventListener('click', () => {
  refreshCashbook();
});

document.getElementById('cbPrintBtn').addEventListener('click', () => {
  window.print();
});

document.getElementById('cbPdfBtn').addEventListener('click', async () => {
  const month = document.getElementById('cbFilterMonth').value;
  if (!month) {
    alert('Select a month to export');
    return;
  }
  try {
    const res = await apiFetchBlob(`/api/reports/cashbook/pdf?month=${encodeURIComponent(month)}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to download PDF');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashbook-${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

async function refreshCashbook() {
  const month = document.getElementById('cbFilterMonth').value;
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  try {
    const rows = await apiFetch(`/api/cashbook?${params.toString()}`);
    renderCashbookTable(rows);
    if (month) {
      const summary = await apiFetch(`/api/cashbook/summary?month=${month}`);
      document.getElementById('cbTotalAmount').textContent =
        summary.summary?.totalAmount?.toLocaleString() || '0';
      document.getElementById('cbTotalExpenses').textContent =
        summary.summary?.totalExpenses?.toLocaleString() || '0';
      document.getElementById('cbTotalBalance').textContent =
        (summary.summary?.totalAmount - summary.summary?.totalExpenses || 0).toLocaleString();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderCashbookTable(rows) {
  const tbody = document.querySelector('#cashbookTable tbody');
  tbody.innerHTML = '';

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    function tdText(text) {
      const td = document.createElement('td');
      td.textContent = text;
      return td;
    }

    const date = row.date ? new Date(row.date).toISOString().slice(0, 10) : '';
    tr.appendChild(tdText(date));
    
    // Show income type(s) or transfer info
    let incomeTypeDisplay = '';
    if (row.internalTransfer) {
      incomeTypeDisplay = row.internalTransfer;
    } else if (row.incomeTypes && row.incomeTypes.length > 0) {
      incomeTypeDisplay = row.incomeTypes.join(', ');
    } else if (row.incomeType) {
      incomeTypeDisplay = row.incomeType;
    }
    tr.appendChild(tdText(incomeTypeDisplay));
    
    tr.appendChild(tdText(row.amount?.toLocaleString() || '0'));
    tr.appendChild(tdText(row.expenses?.toLocaleString() || '0'));
    tr.appendChild(tdText(row.balance?.toLocaleString() || '0'));
    tr.appendChild(tdText(row.methodOfPayment || ''));
    tr.appendChild(tdText(row.wagesCategory || ''));
    tr.appendChild(tdText(row.name || ''));
    tr.appendChild(tdText(row.paymentTier || ''));
    tr.appendChild(tdText(row.wildExpenditure ? 'wild expenditure' : ''));

    const actionsTd = document.createElement('td');
    if (currentUser?.role === 'ADMIN') {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'btn secondary';
      delBtn.style.fontSize = '0.7rem';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        try {
          await apiFetch(`/api/cashbook/${row._id}`, { method: 'DELETE' });
          refreshCashbook();
        } catch (err) {
          alert(err.message);
        }
      });
      actionsTd.appendChild(delBtn);
    } else {
      actionsTd.textContent = '-';
    }
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

// Auto-calculate purchase price total = unit cost × qtyKg
function calculatePurchaseTotal() {
  const unitCost = Number(document.getElementById('invUnitCost').value || 0);
  const qtyKg = Number(document.getElementById('invQtyKg').value || 0);
  const total = unitCost * qtyKg;
  document.getElementById('invPurchaseTotal').value = total.toFixed(2);
}

document.getElementById('invUnitCost').addEventListener('input', calculatePurchaseTotal);
document.getElementById('invQtyKg').addEventListener('input', calculatePurchaseTotal);

// Inventory BUY
document.getElementById('invBuyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('invBuyMessage');
  msg.textContent = '';
  msg.className = 'message';
  const unitCost = Number(document.getElementById('invUnitCost').value || 0);
  const qtyKg = Number(document.getElementById('invQtyKg').value || 0);
  const payload = {
    month: document.getElementById('invBuyMonth').value,
    dateOfPurchase: document.getElementById('invBuyDate').value,
    supplierName: document.getElementById('invSupplierName').value,
    supplierPhone: document.getElementById('invSupplierPhone').value || null,
    supplierLocation: document.getElementById('invSupplierLocation').value || null,
    itemType: document.getElementById('invItemType').value,
    qtyKg: qtyKg,
    unitCost: unitCost,
    purchasePriceTotal: unitCost * qtyKg,
    methodOfPayment: document.getElementById('invBuyMethodOfPayment').value || null,
  };
  try {
    await apiFetch('/api/inventory/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    msg.textContent = 'Purchase saved';
    msg.classList.add('success');
    refreshInvBuy();
    loadRealTimeBalances(); // Refresh balances after purchase
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
  }
});

document.getElementById('invBuyFilterBtn').addEventListener('click', () => {
  refreshInvBuy();
});

document.getElementById('invBuyPrintBtn').addEventListener('click', () => {
  window.print();
});

document.getElementById('invBuyPdfBtn').addEventListener('click', async () => {
  const month = document.getElementById('invBuyFilterMonth').value;
  if (!month) {
    alert('Select a month to export');
    return;
  }
  try {
    const res = await apiFetchBlob(
      `/api/reports/inventory/pdf?month=${encodeURIComponent(month)}`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to download PDF');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

async function refreshInvBuy() {
  const month = document.getElementById('invBuyFilterMonth').value;
  const supplier = document.getElementById('invBuyFilterSupplier').value.trim();
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (supplier) params.append('supplierName', supplier);
  try {
    const rows = await apiFetch(`/api/inventory/purchases?${params.toString()}`);
    renderInvBuyTable(rows);
    if (month) {
      const summary = await apiFetch(`/api/inventory/purchases/summary?month=${month}`);
      const totalKg = summary.overall?.totalKg || 0;
      document.getElementById('invBuyTotalKg').textContent = totalKg.toLocaleString();
      document.getElementById('invBuyTotalTons').textContent = (totalKg / 1000).toFixed(2);
      document.getElementById('invBuyTotalAmount').textContent =
        summary.overall?.totalPurchase?.toLocaleString() || '0';
    }
  } catch (err) {
    console.error(err);
  }
}

function renderInvBuyTable(rows) {
  const tbody = document.querySelector('#invBuyTable tbody');
  tbody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const date = row.dateOfPurchase ? new Date(row.dateOfPurchase).toISOString().slice(0, 10) : '';
    const tons = (row.qtyKg || 0) / 1000;
    tr.innerHTML = `
      <td>${date}</td>
      <td>${row.supplierName || ''}</td>
      <td>${row.itemType || ''}</td>
      <td>${(row.qtyKg || 0).toLocaleString()}</td>
      <td>${tons.toFixed(2)}</td>
      <td>${(row.purchasePriceTotal || 0).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Auto-calc Inventory SELL total = unit cost × qtyKg
function calculateSellTotal() {
  const unitCost = Number(document.getElementById('invSellUnitCost').value || 0);
  const qtyKg = Number(document.getElementById('invSellQtyKg').value || 0);
  const total = unitCost * qtyKg;
  document.getElementById('invSellTotalAmount').value = total.toFixed(2);
}

document.getElementById('invSellUnitCost').addEventListener('input', calculateSellTotal);
document.getElementById('invSellQtyKg').addEventListener('input', calculateSellTotal);

// Inventory SELL
document.getElementById('invSellForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('invSellMessage');
  msg.textContent = '';
  msg.className = 'message';
  const unitCost = Number(document.getElementById('invSellUnitCost').value || 0);
  const qtyKg = Number(document.getElementById('invSellQtyKg').value || 0);
  const payload = {
    month: document.getElementById('invSellMonth').value,
    dateOfSale: document.getElementById('invSellDate').value,
    companyName: document.getElementById('invSellCompany').value,
    itemType: document.getElementById('invSellItemType').value,
    qtyKg,
    unitCost,
    totalAmount: unitCost * qtyKg,
    methodOfPayment: document.getElementById('invSellMethod').value,
  };
  try {
    await apiFetch('/api/inventory/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    msg.textContent = 'Sale saved';
    msg.classList.add('success');
    refreshInvSell();
    loadRealTimeBalances(); // Refresh balances after sale
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
  }
});

document.getElementById('invSellFilterBtn').addEventListener('click', () => {
  refreshInvSell();
});

document.getElementById('invSellPrintBtn').addEventListener('click', () => {
  window.print();
});

document.getElementById('invSellPdfBtn').addEventListener('click', async () => {
  const month = document.getElementById('invSellFilterMonth').value;
  if (!month) {
    alert('Select a month to export');
    return;
  }
  try {
    const res = await apiFetchBlob(
      `/api/reports/inventory/pdf?month=${encodeURIComponent(month)}`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to download PDF');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

async function refreshInvSell() {
  const month = document.getElementById('invSellFilterMonth').value;
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  try {
    const rows = await apiFetch(`/api/inventory/sales?${params.toString()}`);
    renderInvSellTable(rows);
    if (month) {
      const summary = await apiFetch(`/api/inventory/sales/summary?month=${month}`);
      const totalKg = summary.overall?.totalKg || 0;
      document.getElementById('invSellTotalKg').textContent = totalKg.toLocaleString();
      document.getElementById('invSellTotalTons').textContent = (totalKg / 1000).toFixed(2);
      document.getElementById('invSellTotalAmount').textContent =
        summary.overall?.totalSales?.toLocaleString() || '0';
    }
  } catch (err) {
    console.error(err);
  }
}

function renderInvSellTable(rows) {
  const tbody = document.querySelector('#invSellTable tbody');
  tbody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const date = row.dateOfSale ? new Date(row.dateOfSale).toISOString().slice(0, 10) : '';
    const tons = (row.qtyKg || 0) / 1000;
    tr.innerHTML = `
      <td>${date}</td>
      <td>${row.companyName || ''}</td>
      <td>${row.itemType || ''}</td>
      <td>${(row.qtyKg || 0).toLocaleString()}</td>
      <td>${tons.toFixed(2)}</td>
      <td>${(row.totalAmount || 0).toLocaleString()}</td>
      <td>${row.methodOfPayment || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function loadInitialData() {
  refreshCashbook();
  refreshInvBuy();
  refreshInvSell();
  loadRealTimeBalances(); // Load balances on initial load
}

