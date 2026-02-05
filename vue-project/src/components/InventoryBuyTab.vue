<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'

const { isAdmin, currentUser } = useAuth()
const { getInventoryPurchases, createInventoryPurchase, approvePurchase, downloadInventoryPdf } = useApi()

// Form refs
const invBuyMonth = ref('')
const invBuyDate = ref('')
const invSupplierName = ref('')
const invSupplierPhone = ref('')
const invSupplierLocation = ref('')
const invItemType = ref('')
const invQtyKg = ref('')
const invUnitCost = ref('')
const invPurchaseTotal = ref('')
const invBuyMethodOfPayment = ref('')
const invBuyMessage = ref('')
const invBuyMessageType = ref('')

// Filter refs
const invBuyFilterMonth = ref('')
const invBuyFilterSupplier = ref('')

// Data
const purchases = ref([])

// Computed totals (only approved)
const approvedPurchases = computed(() => 
  purchases.value.filter(row => row.approvalStatus === 'APPROVED')
)
const totalKg = computed(() => 
  approvedPurchases.value.reduce((sum, row) => sum + (row.qtyKg || 0), 0)
)
const totalTons = computed(() => totalKg.value / 1000)
const totalAmount = computed(() => 
  approvedPurchases.value.reduce((sum, row) => sum + (row.purchasePriceTotal || 0), 0)
)

// Auto-calculate purchase total
watch([invUnitCost, invQtyKg], () => {
  const unitCost = Number(invUnitCost.value || 0)
  const qtyKg = Number(invQtyKg.value || 0)
  invPurchaseTotal.value = (unitCost * qtyKg).toFixed(2)
})

// Refresh purchases
async function refreshInvBuy() {
  try {
    const rows = await getInventoryPurchases(invBuyFilterMonth.value, invBuyFilterSupplier.value.trim())
    purchases.value = rows
  } catch (err) {
    console.error(err)
  }
}

// Handle purchase submit
async function handleSubmit() {
  invBuyMessage.value = ''
  invBuyMessageType.value = ''

  const unitCost = Number(invUnitCost.value || 0)
  const qtyKg = Number(invQtyKg.value || 0)
  const payload = {
    month: invBuyMonth.value,
    dateOfPurchase: invBuyDate.value,
    supplierName: invSupplierName.value,
    supplierPhone: invSupplierPhone.value || null,
    supplierLocation: invSupplierLocation.value || null,
    itemType: invItemType.value,
    qtyKg: qtyKg,
    unitCost: unitCost,
    purchasePriceTotal: unitCost * qtyKg,
    methodOfPayment: invBuyMethodOfPayment.value || null,
  }

  try {
    const purchase = await createInventoryPurchase(payload)
    
    if (purchase.approvalStatus === 'APPROVED') {
      invBuyMessage.value = 'Purchase processed and approved successfully'
      invBuyMessageType.value = 'success'
    } else {
      invBuyMessage.value = 'Purchase submitted. Waiting for admin approval before processing.'
      invBuyMessageType.value = 'success'
    }
    
    refreshInvBuy()
  } catch (err) {
    invBuyMessage.value = err.message
    invBuyMessageType.value = 'error'
  }
}

// Approve or reject purchase
async function handleApprove(purchaseId, approve) {
  if (!isAdmin.value) {
    alert('Only admins can approve purchases')
    return
  }
  
  if (!confirm(approve ? 'Approve this purchase?' : 'Reject this purchase?')) {
    return
  }
  
  try {
    await approvePurchase(purchaseId, approve ? 'APPROVED' : 'REJECTED')
    refreshInvBuy()
    if (approve) {
      alert('Purchase approved and processed successfully. Cashbook entry created.')
    } else {
      alert('Purchase rejected successfully')
    }
  } catch (err) {
    alert(err.message || 'Error updating purchase status')
  }
}

// Print
function printInvBuy() {
  document.body.classList.add('print-invbuy')
  window.print()
  setTimeout(() => document.body.classList.remove('print-invbuy'), 1500)
}

// Download PDF
async function downloadPdf() {
  if (!invBuyFilterMonth.value) {
    alert('Select a month to export')
    return
  }
  try {
    const blob = await downloadInventoryPdf(invBuyFilterMonth.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-${invBuyFilterMonth.value}.pdf`
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

// Get status class
function getStatusClass(status) {
  if (status === 'APPROVED') return 'status-badge status-approved'
  if (status === 'REJECTED') return 'status-badge status-rejected'
  return 'status-badge status-pending'
}

onMounted(() => {
  refreshInvBuy()
})
</script>

<template>
  <section id="inventoryBuyTab" class="tab-content">
    <!-- Inventory Buying Form -->
    <div class="card glass">
      <h2>Inventory Buying</h2>
      <form @submit.prevent="handleSubmit" class="form-grid">
        <div class="form-control">
          <label for="invBuyMonth">Month (YYYY-MM)</label>
          <input id="invBuyMonth" v-model="invBuyMonth" type="month" required />
        </div>
        <div class="form-control">
          <label for="invBuyDate">Date of Purchase</label>
          <input id="invBuyDate" v-model="invBuyDate" type="date" required />
        </div>
        <div class="form-control">
          <label for="invSupplierName">Supplier Name</label>
          <input id="invSupplierName" v-model="invSupplierName" type="text" required />
        </div>
        <div class="form-control">
          <label for="invSupplierPhone">Supplier Phone</label>
          <input id="invSupplierPhone" v-model="invSupplierPhone" type="text" />
        </div>
        <div class="form-control">
          <label for="invSupplierLocation">Supplier Location</label>
          <input id="invSupplierLocation" v-model="invSupplierLocation" type="text" />
        </div>
        <div class="form-control">
          <label for="invItemType">Purchased Item</label>
          <select id="invItemType" v-model="invItemType" required>
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
          <label for="invQtyKg">Qty (Kgs)</label>
          <input id="invQtyKg" v-model="invQtyKg" type="number" min="0" step="0.01" required />
        </div>
        <div class="form-control">
          <label for="invUnitCost">Unit Cost (UGX per Kg)</label>
          <input id="invUnitCost" v-model="invUnitCost" type="number" min="0" step="0.01" />
        </div>
        <div class="form-control">
          <label for="invPurchaseTotal">Purchase Price Total (UGX)</label>
          <input id="invPurchaseTotal" v-model="invPurchaseTotal" type="number" min="0" step="0.01" required readonly />
        </div>
        <div class="form-control">
          <label for="invBuyMethodOfPayment">Method of Payment</label>
          <select id="invBuyMethodOfPayment" v-model="invBuyMethodOfPayment">
            <option value="">-- Select --</option>
            <option value="CASH">Cash</option>
            <option value="MM-AIRTEL">MM-AIRTEL</option>
            <option value="MM-MTN">MM-MTN</option>
            <option value="BANK">Bank</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">Process Purchase</button>
        </div>
        <p v-if="invBuyMessage" class="message" :class="invBuyMessageType">{{ invBuyMessage }}</p>
      </form>
    </div>

    <!-- Purchases Table -->
    <div class="card glass">
      <div class="card-header">
        <h2>Inventory Purchases</h2>
        <div class="card-actions">
          <label>
            Filter Month:
            <input v-model="invBuyFilterMonth" type="month" />
          </label>
          <label>
            Supplier:
            <input v-model="invBuyFilterSupplier" type="text" />
          </label>
          <button @click="refreshInvBuy" class="btn secondary">Filter</button>
          <button @click="printInvBuy" class="btn secondary">Print</button>
          <button @click="downloadPdf" class="btn secondary">Download PDF</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table id="invBuyTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Item</th>
              <th>Qty (Kg)</th>
              <th>Qty (Tons)</th>
              <th>Purchase Total</th>
              <th>Status</th>
              <th v-if="isAdmin">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in purchases" :key="row._id">
              <td>{{ formatDate(row.dateOfPurchase) }}</td>
              <td>{{ row.supplierName || '' }}</td>
              <td>{{ row.itemType || '' }}</td>
              <td>{{ (row.qtyKg || 0).toLocaleString() }}</td>
              <td>{{ ((row.qtyKg || 0) / 1000).toFixed(2) }}</td>
              <td>{{ (row.purchasePriceTotal || 0).toLocaleString() }}</td>
              <td><span :class="getStatusClass(row.approvalStatus)">{{ row.approvalStatus || 'PENDING' }}</span></td>
              <td v-if="isAdmin">
                <template v-if="row.approvalStatus === 'PENDING'">
                  <button @click="handleApprove(row._id, true)" class="btn btn-sm btn-success" style="margin-right: 5px;">Approve</button>
                  <button @click="handleApprove(row._id, false)" class="btn btn-sm btn-danger">Reject</button>
                </template>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Monthly Totals</td>
              <td>{{ totalKg.toLocaleString() }}</td>
              <td>{{ totalTons.toFixed(2) }}</td>
              <td>{{ totalAmount.toLocaleString() }}</td>
              <td></td>
              <td v-if="isAdmin"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>
