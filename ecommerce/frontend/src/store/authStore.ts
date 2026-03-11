import { create } from 'zustand'
import apiClient from '@/api/client'
import type { Customer } from '@/types'

interface AuthState {
  customer: Customer | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>
  logout: () => void
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  customer: null,
  isAuthenticated: !!localStorage.getItem('store_access_token'),
  isLoading: false,

  login: async (email, password) => {
    const res = await apiClient.post('/store/auth/login', { email, password })
    const { customer, tokens } = res.data.data
    localStorage.setItem('store_access_token', tokens.access_token)
    localStorage.setItem('store_refresh_token', tokens.refresh_token)
    set({ customer, isAuthenticated: true })
  },

  register: async (data) => {
    const res = await apiClient.post('/store/auth/register', data)
    const { customer, tokens } = res.data.data
    localStorage.setItem('store_access_token', tokens.access_token)
    localStorage.setItem('store_refresh_token', tokens.refresh_token)
    set({ customer, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('store_access_token')
    localStorage.removeItem('store_refresh_token')
    set({ customer: null, isAuthenticated: false })
  },

  loadProfile: async () => {
    try {
      set({ isLoading: true })
      const res = await apiClient.get('/store/profile')
      set({ customer: res.data.data, isAuthenticated: true })
    } catch {
      set({ customer: null, isAuthenticated: false })
    } finally {
      set({ isLoading: false })
    }
  },
}))
