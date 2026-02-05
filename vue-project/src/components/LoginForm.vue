<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'

const router = useRouter()
const { setAuth } = useAuth()
const { login } = useApi()

const username = ref('')
const password = ref('')
const message = ref('')
const messageType = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  message.value = ''
  messageType.value = ''
  isLoading.value = true

  try {
    const data = await login(username.value.trim(), password.value)
    setAuth(data.token, data.user)
    message.value = 'Login successful'
    messageType.value = 'success'
    username.value = ''
    password.value = ''
    router.push('/')
  } catch (err) {
    message.value = err.message
    messageType.value = 'error'
    password.value = ''
    console.error('Login failed:', err.message)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <section class="auth-section glass">
    <h2>Manager / Admin Login</h2>
    <form @submit.prevent="handleSubmit" class="form-grid" autocomplete="off">
      <div class="form-control">
        <label for="loginUsername">Username</label>
        <input 
          id="loginUsername" 
          v-model="username"
          type="text" 
          autocomplete="off" 
          required 
        />
      </div>
      <div class="form-control">
        <label for="loginPassword">Password</label>
        <input 
          id="loginPassword" 
          v-model="password"
          type="password" 
          autocomplete="new-password" 
          required 
        />
      </div>
      <button type="submit" class="btn primary full" :disabled="isLoading">
        {{ isLoading ? 'Logging in...' : 'Login' }}
      </button>
      <p v-if="message" class="message" :class="messageType">{{ message }}</p>
    </form>
  </section>
</template>
