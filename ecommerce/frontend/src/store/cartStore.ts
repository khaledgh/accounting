import { create } from 'zustand'
import apiClient from '@/api/client'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  totalItems: number
  totalAmount: number
  isLoading: boolean
  fetchCart: () => Promise<void>
  addItem: (productId: string, quantity: number, variantId?: string) => Promise<void>
  updateItem: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  totalItems: 0,
  totalAmount: 0,
  isLoading: false,

  fetchCart: async () => {
    try {
      set({ isLoading: true })
      const res = await apiClient.get('/store/cart')
      const data = res.data.data
      set({
        items: data.items || [],
        totalItems: data.total_items || 0,
        totalAmount: data.total_amount || 0,
      })
    } catch {
      // Not logged in or cart empty
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (productId, quantity, variantId) => {
    await apiClient.post('/store/cart/items', {
      product_id: productId,
      quantity,
      variant_id: variantId,
    })
    const res = await apiClient.get('/store/cart')
    const data = res.data.data
    set({
      items: data.items || [],
      totalItems: data.total_items || 0,
      totalAmount: data.total_amount || 0,
    })
  },

  updateItem: async (itemId, quantity) => {
    await apiClient.put(`/store/cart/items/${itemId}`, { quantity })
    const res = await apiClient.get('/store/cart')
    const data = res.data.data
    set({
      items: data.items || [],
      totalItems: data.total_items || 0,
      totalAmount: data.total_amount || 0,
    })
  },

  removeItem: async (itemId) => {
    await apiClient.delete(`/store/cart/items/${itemId}`)
    const res = await apiClient.get('/store/cart')
    const data = res.data.data
    set({
      items: data.items || [],
      totalItems: data.total_items || 0,
      totalAmount: data.total_amount || 0,
    })
  },

  clearCart: async () => {
    await apiClient.delete('/store/cart')
    set({ items: [], totalItems: 0, totalAmount: 0 })
  },
}))
