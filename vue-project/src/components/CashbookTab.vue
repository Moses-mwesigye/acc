<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'

const { isAdmin } = useAuth()
const { 
  getCashbook, 
  createCashbookEntry, 
  deleteCashbookEntry,
  getCashbookBalances,
  createInternalTransfer,
  downloadCashbookPdf
} = useApi()

// Form refs
const depositMonth = ref('')
const depositDate = ref('')
const depositIncomeType = ref('')
const depositAmount = ref('')
const depositRef = ref('')
const depositMessage = ref('')
const depositMessageType = ref('')
const depositBalanceDisplay = ref('')

const cbMonth = ref('')
const cbDate = ref('')
const cbAmount = ref('')
const cbRef = ref('')
const cbOperationalCosts = ref('')
const cbTransactionCharges = ref('')
const cbRecyclables = ref('')
const cbOp = ref('')
const cbSector = ref('')
const cbExpenses = ref('')
const cbExpenseIncomeType = ref('NONE')
const cbBalance = ref('')
const cbMethodOfPayment = ref('')
const cbWagesCategory = ref('NONE')
const cbName = ref('')
const cbPaymentTier = ref('NONE')
const cbSalaryAmount = ref('')
const cbAdvance = ref('')
const cbAllowance = ref('')
const cashbookMessage = ref('')
const cashbookMessageType = ref('')

// Transfer refs
const cbTransferFrom = ref('')
const cbTransferTo = ref('')
const cbTransferAmount = ref('')
const transferMessage = ref('')
const transferMessageType = ref('')

// Filter refs
const cbFilterMonth = ref('')

// UI state
const showWagesSection = ref(false)
const showInternalTransfers = ref(false)

// Data
const balances = ref({})
const cashbookEntries = ref([])
const internalTransfers = ref([])

// Totals
const totalAmount = computed(() => 
  cashbookEntries.value.reduce((sum, row) => sum + (row.amount || 0), 0)
)
const totalExpenses = computed(() => 
  cashbookEntries.value.reduce((sum, row) => sum + (row.expenses || 0), 0)
)
const totalBalance = computed(() => totalAmount.value - totalExpenses.value)

// Load balances
async function loadRealTimeBalances() {
  if (!cbMonth.value) return
  try {
    const data = await getCashbookBalances(cbMonth.value)
    balances.value = data.balances
  } catch (err) {
    console.error('Error loading balances:', err)
  }
}

// Refresh cashbook
async function refreshCashbook() {
  try {
    const rows = await getCashbook(cbFilterMonth.value)
    cashbookEntries.value = rows
    internalTransfers.value = rows.filter(row => row.internalTransfer)
  } catch (err) {
    console.error(err)
  }
}

// Handle deposit
async function handleDeposit() {
  depositMessage.value = ''
  depositMessageType.value = ''

  if (!depositIncomeType.value || !depositAmount.value || Number(depositAmount.value) <= 0) {
    depositMessage.value = 'Please select income type and enter a valid amount'
    depositMessageType.value = 'error'
    return
  }

  try {
    await createCashbookEntry({
      month: depositMonth.value,
      date: depositDate.value,
      incomeType: depositIncomeType.value,
      incomeTypes: [depositIncomeType.value],
      amount: Number(depositAmount.value),
      amountsByType: { [depositIncomeType.value]: Number(depositAmount.value) },
      ref: depositRef.value || `Deposit to ${depositIncomeType.value}`,
      operationalCosts: `Deposit: ${depositRef.value || 'Deposit'}`,
      expenses: 0,
    })

    depositMessage.value = `Deposit of ${Number(depositAmount.value).toLocaleString()} UGX to ${depositIncomeType.value} successful`
    depositMessageType.value = 'success'
    depositAmount.value = ''
    depositRef.value = ''
    loadRealTimeBalances()
    refreshCashbook()
  } catch (err) {
    depositMessage.value = err.message || 'Error processing deposit'
    depositMessageType.value = 'error'
  }
}

// Handle cashbook entry
async function handleCashbookSubmit() {
  cashbookMessage.value = ''
  cashbookMessageType.value = ''

  const payload = {
    month: cbMonth.value,
    date: cbDate.value,
    incomeType: null,
    incomeTypes: [],
    amount: Number(cbAmount.value || 0),
    amountsByType: {},
    ref: cbRef.value || null,
    operationalCosts: cbOperationalCosts.value || null,
    transactionCharges: Number(cbTransactionCharges.value || 0),
    recyclables: cbRecyclables.value || null,
    op: cbOp.value || null,
    sector: cbSector.value || null,
    expenses: Number(cbExpenses.value || 0),
    balance: Number(cbBalance.value || 0),
    methodOfPayment: cbMethodOfPayment.value || null,
    wagesCategory: cbWagesCategory.value || 'NONE',
    name: cbName.value || null,
    paymentTier: cbPaymentTier.value || 'NONE',
    salaryAmount: Number(cbSalaryAmount.value || 0),
    advance: Number(cbAdvance.value || 0),
    allowance: Number(cbAllowance.value || 0),
    expenseIncomeType: cbExpenseIncomeType.value || 'NONE',
  }

  try {
    await createCashbookEntry(payload)
    cashbookMessage.value = 'Entry saved'
    cashbookMessageType.value = 'success'
    cbAmount.value = ''
    refreshCashbook()
    loadRealTimeBalances()
  } catch (err) {
    cashbookMessage.value = err.message
    cashbookMessageType.value = 'error'
  }
}

// Handle internal transfer
async function handleTransfer() {
  transferMessage.value = ''
  transferMessageType.value = ''

  if (!cbTransferFrom.value || !cbTransferTo.value) {
    transferMessage.value = 'Please select both From and To income types'
    transferMessageType.value = 'error'
    return
  }

  if (cbTransferFrom.value === cbTransferTo.value) {
    transferMessage.value = 'Cannot transfer to the same income type'
    transferMessageType.value = 'error'
    return
  }

  if (!cbTransferAmount.value || Number(cbTransferAmount.value) <= 0) {
    transferMessage.value = 'Please enter a valid amount'
    transferMessageType.value = 'error'
    return
  }

  if (!cbDate.value || !cbMonth.value) {
    transferMessage.value = 'Please select date and month'
    transferMessageType.value = 'error'
    return
  }

  try {
    const result = await createInternalTransfer({
      fromIncomeType: cbTransferFrom.value,
      toIncomeType: cbTransferTo.value,
      amount: Number(cbTransferAmount.value),
      date: cbDate.value,
      month: cbMonth.value,
    })
    
    transferMessage.value = result.message || 'Transfer completed successfully'
    transferMessageType.value = 'success'
    cbTransferFrom.value = ''
    cbTransferTo.value = ''
    cbTransferAmount.value = ''
    refreshCashbook()
    loadRealTimeBalances()
  } catch (err) {
    transferMessage.value = err.message || 'Error processing transfer'
    transferMessageType.value = 'error'
  }
}

// Delete entry (admin only)
async function handleDelete(id) {
  if (!confirm('Delete this entry?')) return
  try {
    await deleteCashbookEntry(id)
    refreshCashbook()
  } catch (err) {
    alert(err.message)
  }
}

// Print
function printCashbook() {
  document.body.classList.add('print-cashbook')
  window.print()
  setTimeout(() => document.body.classList.remove('print-cashbook'), 1500)
}

// Download PDF
async function downloadPdf() {
  if (!cbFilterMonth.value) {
    alert('Select a month to export')
    return
  }
  try {
    const blob = await downloadCashbookPdf(cbFilterMonth.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashbook-${cbFilterMonth.value}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    alert(err.message)
  }
}

// Format date
function formatDate(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : ''
}

// Sync dates
watch(cbDate, (val) => { depositDate.value = val })
watch(cbMonth, (val) => { 
  depositMonth.value = val
  loadRealTimeBalances()
})
watch(depositDate, (val) => { cbDate.value = val })
watch(depositMonth, (val) => { 
  cbMonth.value = val
  loadRealTimeBalances()
})

// Load balance when deposit income type changes
watch(depositIncomeType, async () => {
  if (!depositIncomeType.value) {
    depositBalanceDisplay.value = ''
    return
  }
  if (!depositMonth.value) {
    depositBalanceDisplay.value = 'Select month to see balance'
    return
  }
  try {
    const data = await getCashbookBalances(depositMonth.value)
    const balance = data.balances[depositIncomeType.value]
    if (balance) {
      const color = balance.availableBalance >= 0 ? '#bbf7d0' : '#fecaca'
      depositBalanceDisplay.value = `Current Balance: ${balance.availableBalance.toLocaleString()} UGX`
    }
  } catch (err) {
    depositBalanceDisplay.value = 'Unable to load balance'
  }
})

onMounted(() => {
  refreshCashbook()
})
</script>

<template>
  <section id="cashbookTab" class="tab-content active">
    <!-- Quick Deposit -->
    <div class="card glass">
      <h2>Quick Deposit</h2>
      <form @submit.prevent="handleDeposit" class="form-grid">
        <div class="form-control">
          <label for="depositMonth">Month (YYYY-MM)</label>
          <input id="depositMonth" v-model="depositMonth" type="month" required />
        </div>
        <div class="form-control">
          <label for="depositDate">Date</label>
          <input id="depositDate" v-model="depositDate" type="date" required />
        </div>
        <div class="form-control">
          <label for="depositIncomeType">Income Type</label>
          <select id="depositIncomeType" v-model="depositIncomeType" required>
            <option value="">-- Select --</option>
            <option value="MM-AIRTEL">MM-AIRTEL</option>
            <option value="MM-MTN">MM-MTN</option>
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
            <option value="BUSINESSPROFIT">BUSINESS profit (recyclables)</option>
          </select>
          <small v-if="depositBalanceDisplay" style="color: #cbd5f5; font-size: 0.75rem; margin-top: 0.25rem; display: block;">
            {{ depositBalanceDisplay }}
          </small>
        </div>
        <div class="form-control">
          <label for="depositAmount">Deposit Amount (UGX)</label>
          <input id="depositAmount" v-model="depositAmount" type="number" min="0" step="0.01" required />
        </div>
        <div class="form-control">
          <label for="depositRef">Reference/Description</label>
          <input id="depositRef" v-model="depositRef" type="text" placeholder="e.g., Cash deposit, Payment received" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Deposit</button>
        </div>
        <p v-if="depositMessage" class="message" :class="depositMessageType">{{ depositMessage }}</p>
      </form>
    </div>

    <!-- Cashbook Entry -->
    <div class="card glass">
      <h2>Cashbook Entry</h2>
      <form @submit.prevent="handleCashbookSubmit" class="form-grid">
        <div class="form-control">
          <label for="cbMonth">Month (YYYY-MM)</label>
          <input id="cbMonth" v-model="cbMonth" type="month" required />
        </div>
        <div class="form-control">
          <label for="cbDate">Date</label>
          <input id="cbDate" v-model="cbDate" type="date" required />
        </div>
        <div class="form-control">
          <label for="cbAmount">Amount (UGX)</label>
          <input id="cbAmount" v-model="cbAmount" type="number" min="0" step="0.01" />
        </div>
        
        <!-- Balance Table -->
        <div class="form-control" style="grid-column: 1 / -1;">
          <label>Real-Time Balance by Income Type</label>
          <div class="table-wrapper" style="margin-top: 0.5rem;">
            <table style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th>Income Type</th>
                  <th>Available Balance (UGX)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="Object.keys(balances).length === 0">
                  <td colspan="2">Select a month to view balances</td>
                </tr>
                <tr v-for="(balance, type) in balances" :key="type">
                  <td><strong>{{ type }}</strong></td>
                  <td :style="{ textAlign: 'right', color: balance.availableBalance >= 0 ? '#bbf7d0' : '#fecaca' }">
                    {{ balance.availableBalance.toLocaleString() }} UGX
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="form-control">
          <label for="cbRef">REF</label>
          <input id="cbRef" v-model="cbRef" type="text" />
        </div>
        <div class="form-control">
          <label for="cbOperationalCosts">Operational Costs</label>
          <input id="cbOperationalCosts" v-model="cbOperationalCosts" type="text" />
        </div>

        <!-- Internal Transfer -->
        <div class="form-control form-control-full" style="grid-column: 1 / -1;">
          <label class="section-label">Internal Transfer</label>
          <div class="transfer-grid">
            <div>
              <label for="cbTransferFrom" style="font-size: 0.8rem;">From</label>
              <select id="cbTransferFrom" v-model="cbTransferFrom" style="width: 100%;">
                <option value="">-- Select --</option>
                <option value="MM-AIRTEL">MM-AIRTEL</option>
                <option value="MM-MTN">MM-MTN</option>
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="BUSINESSPROFIT">BUSINESS profit</option>
              </select>
            </div>
            <div>
              <label for="cbTransferTo" style="font-size: 0.8rem;">To</label>
              <select id="cbTransferTo" v-model="cbTransferTo" style="width: 100%;">
                <option value="">-- Select --</option>
                <option value="MM-AIRTEL">MM-AIRTEL</option>
                <option value="MM-MTN">MM-MTN</option>
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="BUSINESSPROFIT">BUSINESS profit</option>
              </select>
            </div>
            <div>
              <label for="cbTransferAmount" style="font-size: 0.8rem;">Amount (UGX)</label>
              <input id="cbTransferAmount" v-model="cbTransferAmount" type="number" min="0" step="0.01" style="width: 100%;" />
            </div>
            <button type="button" @click="handleTransfer" class="btn secondary" style="height: fit-content;">Transfer</button>
          </div>
          <p v-if="transferMessage" class="message" :class="transferMessageType" style="margin-top: 0.5rem;">{{ transferMessage }}</p>
        </div>

        <div class="form-control">
          <label for="cbTransactionCharges">Transaction Charges (UGX)</label>
          <input id="cbTransactionCharges" v-model="cbTransactionCharges" type="number" min="0" step="0.01" />
        </div>
        <div class="form-control">
          <label for="cbRecyclables">Recyclables</label>
          <input id="cbRecyclables" v-model="cbRecyclables" type="text" />
        </div>
        <div class="form-control">
          <label for="cbOp">OP</label>
          <input id="cbOp" v-model="cbOp" type="text" />
        </div>
        <div class="form-control">
          <label for="cbSector">Sector</label>
          <select id="cbSector" v-model="cbSector">
            <option value="">-- Select --</option>
            <option value="BUYING">Buying recyclables</option>
            <option value="CLEANING">Cleaning recyclables</option>
            <option value="TRANSPORT">Transport</option>
          </select>
        </div>
        <div class="form-control">
          <label for="cbExpenses">Expenses (UGX)</label>
          <input id="cbExpenses" v-model="cbExpenses" type="number" min="0" step="0.01" />
        </div>
        <div class="form-control">
          <label for="cbExpenseIncomeType">Expense Income Type</label>
          <select id="cbExpenseIncomeType" v-model="cbExpenseIncomeType">
            <option value="NONE">-- Select --</option>
            <option value="MM-AIRTEL">MM-AIRTEL</option>
            <option value="MM-MTN">MM-MTN</option>
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
            <option value="BUSINESSPROFIT">BUSINESS profit (recyclables)</option>
          </select>
        </div>
        <div class="form-control">
          <label for="cbBalance">Balance (UGX)</label>
          <input id="cbBalance" v-model="cbBalance" type="number" min="0" step="0.01" />
        </div>
        <div class="form-control">
          <label for="cbMethodOfPayment">Method of Payment</label>
          <select id="cbMethodOfPayment" v-model="cbMethodOfPayment">
            <option value="">-- Select --</option>
            <option value="CASH">Cash</option>
            <option value="MM-AIRTEL">Mobile Money AIRTEL</option>
            <option value="MM-MTN">Mobile Money MTN</option>
            <option value="BANK">Bank</option>
          </select>
        </div>

        <!-- Wages Toggle -->
        <div class="form-control form-control-full" style="grid-column: 1 / -1;">
          <label class="section-label">Wages & Allowances</label>
          <button type="button" @click="showWagesSection = !showWagesSection" class="btn secondary small">
            {{ showWagesSection ? 'Hide' : 'Show' }} wages & allowances
          </button>
        </div>

        <!-- Wages Section -->
        <div v-if="showWagesSection" class="collapsible-section" style="grid-column: 1 / -1;">
          <div class="form-grid">
            <div class="form-control">
              <label for="cbWagesCategory">Wages Category</label>
              <select id="cbWagesCategory" v-model="cbWagesCategory">
                <option value="NONE">None</option>
                <option value="CASUAL">Casual workers</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>
            <div class="form-control">
              <label for="cbName">Name</label>
              <input id="cbName" v-model="cbName" type="text" />
            </div>
            <div class="form-control">
              <label for="cbPaymentTier">Payment Tier</label>
              <select id="cbPaymentTier" v-model="cbPaymentTier">
                <option value="NONE">None</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div class="form-control">
              <label for="cbSalaryAmount">Salary Amount (UGX)</label>
              <input id="cbSalaryAmount" v-model="cbSalaryAmount" type="number" min="0" step="0.01" />
            </div>
            <div class="form-control">
              <label for="cbAdvance">Advance (UGX)</label>
              <input id="cbAdvance" v-model="cbAdvance" type="number" min="0" step="0.01" />
            </div>
            <div class="form-control">
              <label for="cbAllowance">Allowance / Overtime (UGX)</label>
              <input id="cbAllowance" v-model="cbAllowance" type="number" min="0" step="0.01" />
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Save Entry</button>
        </div>
        <p v-if="cashbookMessage" class="message" :class="cashbookMessageType">{{ cashbookMessage }}</p>
      </form>
    </div>

    <!-- Cashbook Table -->
    <div class="card glass">
      <div class="card-header">
        <h2>Cashbook Table</h2>
        <div class="card-actions">
          <label>
            Filter Month:
            <input id="cbFilterMonth" v-model="cbFilterMonth" type="month" />
          </label>
          <button @click="refreshCashbook" class="btn secondary">Filter</button>
          <button @click="printCashbook" class="btn secondary">Print</button>
          <button @click="downloadPdf" class="btn secondary">Download PDF</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table id="cashbookTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Income Type</th>
              <th>Amount</th>
              <th>Expenses</th>
              <th>Balance</th>
              <th>Method</th>
              <th>Wages</th>
              <th>Name</th>
              <th>Tier</th>
              <th>Salary</th>
              <th>Allowance / OT</th>
              <th>Wild Exp.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cashbookEntries" :key="row._id">
              <td>{{ formatDate(row.date) }}</td>
              <td>{{ row.internalTransfer || (row.incomeTypes?.join(', ') || row.incomeType || '') }}</td>
              <td>{{ (row.amount || 0).toLocaleString() }}</td>
              <td>{{ (row.expenses || 0).toLocaleString() }}</td>
              <td>{{ (row.balance || 0).toLocaleString() }}</td>
              <td>{{ row.methodOfPayment || '' }}</td>
              <td>{{ row.wagesCategory || '' }}</td>
              <td>{{ row.name || '' }}</td>
              <td>{{ row.paymentTier || '' }}</td>
              <td>{{ (row.salaryAmount || 0).toLocaleString() }}</td>
              <td>{{ (row.allowance || 0).toLocaleString() }}</td>
              <td>{{ row.wildExpenditure ? 'wild expenditure' : '' }}</td>
              <td>
                <button v-if="isAdmin" @click="handleDelete(row._id)" class="btn secondary" style="font-size: 0.7rem;">
                  Delete
                </button>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Totals</td>
              <td>{{ totalAmount.toLocaleString() }}</td>
              <td>{{ totalExpenses.toLocaleString() }}</td>
              <td>{{ totalBalance.toLocaleString() }}</td>
              <td colspan="8"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Internal Transfers Table -->
    <div class="card glass">
      <div class="card-header">
        <h2>Internal Transfers</h2>
        <div class="card-actions">
          <button type="button" @click="showInternalTransfers = !showInternalTransfers" class="btn secondary small">
            {{ showInternalTransfers ? 'Hide' : 'Show' }} internal transfers
          </button>
        </div>
      </div>
      <div v-if="showInternalTransfers" id="internalTransfersSection" class="collapsible-section">
        <div class="table-wrapper">
          <table id="internalTransfersTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Amount (UGX)</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in internalTransfers" :key="row._id">
                <td>{{ formatDate(row.date) }}</td>
                <td>{{ row.internalTransfer?.startsWith('FROM ') ? row.internalTransfer.replace('FROM ', '') : '' }}</td>
                <td>{{ row.internalTransfer?.startsWith('TO ') ? row.internalTransfer.replace('TO ', '') : '' }}</td>
                <td>{{ (row.internalTransfer?.startsWith('TO ') ? (row.amount || 0) : (row.expenses || 0)).toLocaleString() }}</td>
                <td>{{ row.ref || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
