import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import LoginPage from '@/views/LoginPage.vue'
import AppMain from '@/components/AppMain.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginPage, meta: { guest: true } },
  { path: '/', name: 'home', component: AppMain, meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const { isLoggedIn } = useAuth()
  if (to.meta.requiresAuth && !isLoggedIn.value) {
    next({ name: 'login' })
  } else if (to.meta.guest && isLoggedIn.value) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
