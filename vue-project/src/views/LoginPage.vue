<script setup>
import LoginForm from '@/components/LoginForm.vue'
</script>

<template>
  <div class="app-root">
    <header class="app-header glass">
      <h1>BWWS Cashbook & Inventory</h1>
      <span class="login-status">Not logged in</span>
    </header>
    <div class="content-backdrop">
      <LoginForm />
      <div class="login-logo">
        <img src="/bww-logo.png" alt="BWWS Logo" />
      </div>
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

@media (max-width: 768px) {
  .login-logo {
    margin-top: 1.5rem;
    padding: 0.75rem;
  }
  .login-logo img {
    max-width: 200px;
  }
}

@media (max-width: 480px) {
  .login-logo {
    margin-top: 1rem;
    padding: 0.5rem;
  }
  .login-logo img {
    max-width: 160px;
  }
}
</style>
