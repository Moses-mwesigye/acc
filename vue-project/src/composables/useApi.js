import { useAuth } from './useAuth'

// API Base URL - Configure for your backend
// In development: Vite proxy handles /v1 requests
// In production: Set VITE_API_BASE_URL environment variable or use same domain
const apiBase = import.meta.env.VITE_API_BASE_URL || ''

export function useApi() {
  const { getToken } = useAuth()

  async function apiFetch(path, options = {}) {
    const headers = options.headers || {}
    headers['Content-Type'] = 'application/json'
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const url = `${apiBase}${path}`
    console.log('API Request:', url)

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.message || data?.error || `Request failed (${res.status})`
        throw new Error(msg)
      }
      return data
    } catch (err) {
      console.error('API Error:', err.message, 'URL:', url)
      if (err.message === 'Failed to fetch') {
        throw new Error(
          `Cannot reach API at ${url}. Check: (1) API is running, (2) CORS allows this origin, (3) SSL certificate is valid. Edit config.js to set the correct backend URL.`
        )
      }
      throw err
    }
  }

  async function apiFetchBlob(path, options = {}) {
    const headers = options.headers || {}
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    })
  }

  // Auth
  async function login(username, password) {
    return apiFetch('/v1/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  }

  // Cashbook
  async function getCashbook(month) {
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    return apiFetch(`/v1/cashbook?${params.toString()}`)
  }

  async function createCashbookEntry(payload) {
    return apiFetch('/v1/cashbook', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async function deleteCashbookEntry(id) {
    return apiFetch(`/v1/cashbook/${id}`, { method: 'DELETE' })
  }

  async function getCashbookBalances(month) {
    return apiFetch(`/v1/cashbook/balances?month=${month}`)
  }

  async function createInternalTransfer(payload) {
    return apiFetch('/v1/cashbook/internal-transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async function downloadCashbookPdf(month) {
    const res = await apiFetchBlob(`/v1/reports/cashbook/pdf?month=${encodeURIComponent(month)}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Failed to download PDF')
    }
    return res.blob()
  }

  // Inventory Purchases
  async function getInventoryPurchases(month, supplierName) {
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    if (supplierName) params.append('supplierName', supplierName)
    return apiFetch(`/v1/inventory/purchases?${params.toString()}`)
  }

  async function createInventoryPurchase(payload) {
    return apiFetch('/v1/inventory/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async function approvePurchase(id, status) {
    return apiFetch(`/v1/inventory/purchases/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  async function downloadInventoryPdf(month) {
    const res = await apiFetchBlob(`/v1/reports/inventory/pdf?month=${encodeURIComponent(month)}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Failed to download PDF')
    }
    return res.blob()
  }

  // Inventory Sales
  async function getInventorySales(month) {
    const params = new URLSearchParams()
    if (month) params.append('month', month)
    return apiFetch(`/v1/inventory/sales?${params.toString()}`)
  }

  async function createInventorySale(payload) {
    return apiFetch('/v1/inventory/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // Stock Levels
  async function getStockLevels() {
    return apiFetch('/v1/inventory/stock')
  }

  return {
    apiFetch,
    apiFetchBlob,
    login,
    getCashbook,
    createCashbookEntry,
    deleteCashbookEntry,
    getCashbookBalances,
    createInternalTransfer,
    downloadCashbookPdf,
    getInventoryPurchases,
    createInventoryPurchase,
    approvePurchase,
    downloadInventoryPdf,
    getInventorySales,
    createInventorySale,
    getStockLevels,
  }
}
