import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('store_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem('store_refresh_token')
        if (!refreshToken) throw new Error('No refresh token')
        const response = await axios.post(`${API_BASE}/store/auth/refresh`, { refresh_token: refreshToken })
        const { access_token, refresh_token } = response.data.data.tokens
        localStorage.setItem('store_access_token', access_token)
        localStorage.setItem('store_refresh_token', refresh_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch {
        localStorage.removeItem('store_access_token')
        localStorage.removeItem('store_refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
