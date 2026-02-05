<script setup>
import LoginForm from '@/components/LoginForm.vue'
</script>

<template>
  <div class="app-root">
    <header class="app-header glass">
      <h1>BWWS Cashbook & Inventory</h1>
      <span class="login-status">Not logged in</span>
    </header>
    <LoginForm />
    <div class="login-logo">
      <img src="/bww-logo.png" alt="BWWS Logo" />
    </div>
  </div>
</template>

<style scoped>
.login-logo {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
  padding: 1rem;
}
.login-logo img {
  max-width: 280px;
  height: auto;
  display: block;
}
</style>
