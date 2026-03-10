import { create } from 'zustand'
import apiClient from '@/api/client'
import type { User, Company, Branch } from '@/types'

interface AuthState {
  user: User | null
  company: Company | null
  branch: Branch | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  fetchProfile: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  first_name: string
  last_name: string
  company_name: string
  company_code: string
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  branch: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const response = await apiClient.post('/auth/login', { email, password })
      const { user, tokens } = response.data.data
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true })
    try {
      const response = await apiClient.post('/auth/register', data)
      const { user, company, branch, tokens } = response.data.data
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      set({ user, company, branch, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, company: null, branch: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  fetchProfile: async () => {
    try {
      const response = await apiClient.get('/profile')
      const user = response.data.data
      set({ user, company: user.company, branch: user.branch, isAuthenticated: true })
    } catch {
      set({ user: null, isAuthenticated: false })
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  },
}))
