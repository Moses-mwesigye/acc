<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '@/composables/useApi'

const { getInventorySales, createInventorySale, downloadInventoryPdf } = useApi()

// Form refs
const invSellMonth = ref('')
const invSellDate = ref('')
const invSellCompany = ref('')
const invSellItemType = ref('')
const invSellQtyKg = ref('')
const invSellUnitCost = ref('')
const invSellTotalAmount = ref('')
const invSellMethod = ref('')
const invSellMessage = ref('')
const invSellMessageType = ref('')

// Filter refs
const invSellFilterMonth = ref('')

// Data
const sales = ref([])

// Computed totals
const totalKg = computed(() => 
  sales.value.reduce((sum, row) => sum + (row.qtyKg || 0), 0)
)
const totalTons = computed(() => totalKg.value / 1000)
const totalAmount = computed(() => 
  sales.value.reduce((sum, row) => sum + (row.totalAmount || 0), 0)
)

// Auto-calculate sale total
watch([invSellUnitCost, invSellQtyKg], () => {
  const unitCost = Number(invSellUnitCost.value || 0)
  const qtyKg = Number(invSellQtyKg.value || 0)
  invSellTotalAmount.value = (unitCost * qtyKg).toFixed(2)
})

// Refresh sales
async function refreshInvSell() {
  try {
    const rows = await getInventorySales(invSellFilterMonth.value)
    sales.value = rows
  } catch (err) {
    console.error(err)
  }
}

// Handle sale submit
async function handleSubmit() {
  invSellMessage.value = ''
  invSellMessageType.value = ''

  const unitCost = Number(invSellUnitCost.value || 0)
  const qtyKg = Number(invSellQtyKg.value || 0)
  const payload = {
    month: invSellMonth.value,
    dateOfSale: invSellDate.value,
    companyName: invSellCompany.value,
    itemType: invSellItemType.value,
    qtyKg,
    unitCost,
    totalAmount: unitCost * qtyKg,
    methodOfPayment: invSellMethod.value,
  }

  try {
    await createInventorySale(payload)
    invSellMessage.value = 'Sale saved'
    invSellMessageType.value = 'success'
    refreshInvSell()
  } catch (err) {
    invSellMessage.value = err.message
    invSellMessageType.value = 'error'
  }
}

// Print
function printInvSell() {
  document.body.classList.add('print-invsell')
  window.print()
  setTimeout(() => document.body.classList.remove('print-invsell'), 1500)
}

// Download PDF
async function downloadPdf() {
  if (!invSellFilterMonth.value) {
    alert('Select a month to export')
    return
  }
  try {
    const blob = await downloadInventoryPdf(invSellFilterMonth.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-${invSellFilterMonth.value}.pdf`
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

onMounted(() => {
  refreshInvSell()
})
</script>

<template>
  <section id="inventorySellTab" class="tab-content">
    <!-- Inventory Selling Form -->
    <div class="card glass">
      <h2>Inventory Selling</h2>
      <form @submit.prevent="handleSubmit" class="form-grid">
        <div class="form-control">
          <label for="invSellMonth">Month (YYYY-MM)</label>
          <input id="invSellMonth" v-model="invSellMonth" type="month" required />
        </div>
        <div class="form-control">
          <label for="invSellDate">Date of Sale</label>
          <input id="invSellDate" v-model="invSellDate" type="date" required />
        </div>
        <div class="form-control">
          <label for="invSellCompany">Offtaker Company</label>
          <input id="invSellCompany" v-model="invSellCompany" type="text" required />
        </div>
        <div class="form-control">
          <label for="invSellItemType">Item</label>
          <select id="invSellItemType" v-model="invSellItemType" required>
            <option value="">-- Select --</option>
            <option value="SOFT">Soft</option>
            <option value="BOTTLES">Bottles</option>
            <option value="HD">HD</option>
            <option value="STEEL">Steel</option>
            <option value="SACKS">Sacks</option>
            <option value="JCNS">Jcns</option>
            <option value="PLASTICS">Plastics (Bafu)</option>
            <option value="BOX">Box</option>
            <option value="CUPS">Cups</option>
          </select>
        </div>
        <div class="form-control">
          <label for="invSellQtyKg">Qty (Kgs)</label>
          <input id="invSellQtyKg" v-model="invSellQtyKg" type="number" min="0" step="0.01" required />
        </div>
        <div class="form-control">
          <label for="invSellUnitCost">Unit Cost (UGX per Kg)</label>
          <input id="invSellUnitCost" v-model="invSellUnitCost" type="number" min="0" step="0.01" required />
        </div>
        <div class="form-control">
          <label for="invSellTotalAmount">Total Amount (UGX)</label>
          <input id="invSellTotalAmount" v-model="invSellTotalAmount" type="number" min="0" step="0.01" required readonly />
        </div>
        <div class="form-control">
          <label for="invSellMethod">Method of Payment</label>
          <select id="invSellMethod" v-model="invSellMethod" required>
            <option value="">-- Select --</option>
            <option value="CASH">Cash</option>
            <option value="MM-AIRTEL">MM-AIRTEL</option>
            <option value="MM-MTN">MM-MTN</option>
            <option value="BANK">Bank</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Save Sale</button>
        </div>
        <p v-if="invSellMessage" class="message" :class="invSellMessageType">{{ invSellMessage }}</p>
      </form>
    </div>

    <!-- Sales Table -->
    <div class="card glass">
      <div class="card-header">
        <h2>Inventory Sales</h2>
        <div class="card-actions">
          <label>
            Filter Month:
            <input v-model="invSellFilterMonth" type="month" />
          </label>
          <button @click="refreshInvSell" class="btn secondary">Filter</button>
          <button @click="printInvSell" class="btn secondary">Print</button>
          <button @click="downloadPdf" class="btn secondary">Download PDF</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table id="invSellTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Item</th>
              <th>Qty (Kg)</th>
              <th>Qty (Tons)</th>
              <th>Amount</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sales" :key="row._id">
              <td>{{ formatDate(row.dateOfSale) }}</td>
              <td>{{ row.companyName || '' }}</td>
              <td>{{ row.itemType || '' }}</td>
              <td>{{ (row.qtyKg || 0).toLocaleString() }}</td>
              <td>{{ ((row.qtyKg || 0) / 1000).toFixed(2) }}</td>
              <td>{{ (row.totalAmount || 0).toLocaleString() }}</td>
              <td>{{ row.methodOfPayment || '' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Monthly Totals</td>
              <td>{{ totalKg.toLocaleString() }}</td>
              <td>{{ totalTons.toFixed(2) }}</td>
              <td>{{ totalAmount.toLocaleString() }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>
