<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import CashbookTab from '@/components/CashbookTab.vue'
import InventoryBuyTab from '@/components/InventoryBuyTab.vue'
import InventorySellTab from '@/components/InventorySellTab.vue'

const { currentUser, canAccessCashbook, canAccessInventory, logout } = useAuth()

const activeTab = ref('cashbook')
let balanceInterval = null

const roleDisplay = computed(() => {
  if (!currentUser.value) return 'Not logged in'
  return `${currentUser.value.role} (${currentUser.value.username})`
})

function handleLogout() {
  logout()
  activeTab.value = 'cashbook'
}

function setTab(tab) {
  activeTab.value = tab
}

onMounted(() => {
  if (canAccessCashbook.value) activeTab.value = 'cashbook'
  else if (canAccessInventory.value) activeTab.value = 'inventoryBuy'
})

onUnmounted(() => {
  if (balanceInterval) {
    clearInterval(balanceInterval)
  }
})
</script>

<template>
  <div class="app-root">
    <header class="app-header glass">
      <h1>BWWS Cashbook & Inventory</h1>
      <div class="login-status">
        <span>{{ roleDisplay }}</span>
        <button @click="handleLogout" class="btn secondary">Logout</button>
      </div>
    </header>

    <main id="mainContent">
      <nav class="tabs glass">
        <button 
          v-if="canAccessCashbook" 
          class="tab" 
          :class="{ active: activeTab === 'cashbook' }"
          @click="setTab('cashbook')"
        >
          Cashbook
        </button>
        <button 
          v-if="canAccessInventory" 
          class="tab" 
          :class="{ active: activeTab === 'inventoryBuy' }"
          @click="setTab('inventoryBuy')"
        >
          Inventory Buying
        </button>
        <button 
          v-if="canAccessInventory" 
          class="tab" 
          :class="{ active: activeTab === 'inventorySell' }"
          @click="setTab('inventorySell')"
        >
          Inventory Selling
        </button>
      </nav>

      <CashbookTab v-if="canAccessCashbook && activeTab === 'cashbook'" />
      <InventoryBuyTab v-if="canAccessInventory && activeTab === 'inventoryBuy'" />
      <InventorySellTab v-if="canAccessInventory && activeTab === 'inventorySell'" />
    </main>
  </div>
</template>
