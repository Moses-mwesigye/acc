import { ref, computed } from 'vue'

// Initialize from localStorage if available
const storedToken = localStorage.getItem('authToken')
const storedUser = localStorage.getItem('currentUser')

const authToken = ref(storedToken || null)
const currentUser = ref(storedUser ? JSON.parse(storedUser) : null)

export function useAuth() {
  const isLoggedIn = computed(() => !!authToken.value && !!currentUser.value)
  const isAdmin = computed(() => currentUser.value?.role === 'ADMIN')
  const isManager = computed(() => currentUser.value?.role === 'MANAGER')
  const isInventory = computed(() => currentUser.value?.role === 'INVENTORY')
  const isViewer = computed(() => currentUser.value?.role === 'VIEWER')
  // VIEWER has view-only access - cannot create, edit, or delete
  const isViewOnly = computed(() => currentUser.value?.role === 'VIEWER')
  const canAccessCashbook = computed(() => ['ADMIN', 'MANAGER', 'VIEWER'].includes(currentUser.value?.role))
  const canAccessInventory = computed(() => 
    ['ADMIN', 'MANAGER', 'INVENTORY', 'VIEWER'].includes(currentUser.value?.role)
  )

  function setAuth(token, user) {
    authToken.value = token
    currentUser.value = user
    // Persist to localStorage
    localStorage.setItem('authToken', token)
    localStorage.setItem('currentUser', JSON.stringify(user))
  }

  function logout() {
    authToken.value = null
    currentUser.value = null
    // Clear from localStorage
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
  }

  function getToken() {
    return authToken.value
  }

  function getUser() {
    return currentUser.value
  }

  return {
    authToken,
    currentUser,
    isLoggedIn,
    isAdmin,
    isManager,
    isInventory,
    isViewer,
    isViewOnly,
    canAccessCashbook,
    canAccessInventory,
    setAuth,
    logout,
    getToken,
    getUser
  }
}
