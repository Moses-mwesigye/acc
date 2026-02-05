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
  </div>
</template>
