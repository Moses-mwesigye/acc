import { ref, computed } from 'vue'

const authToken = ref(null)
const currentUser = ref(null)

export function useAuth() {
  const isLoggedIn = computed(() => !!authToken.value && !!currentUser.value)
  const isAdmin = computed(() => currentUser.value?.role === 'ADMIN')
  const isManager = computed(() => currentUser.value?.role === 'MANAGER')
  const isInventory = computed(() => currentUser.value?.role === 'INVENTORY')
  const canAccessCashbook = computed(() => currentUser.value?.role === 'ADMIN')
  const canAccessInventory = computed(() => 
    ['ADMIN', 'MANAGER', 'INVENTORY'].includes(currentUser.value?.role)
  )

  function setAuth(token, user) {
    authToken.value = token
    currentUser.value = user
  }

  function logout() {
    authToken.value = null
    currentUser.value = null
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
    canAccessCashbook,
    canAccessInventory,
    setAuth,
    logout,
    getToken,
    getUser
  }
}
