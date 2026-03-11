import { create } from 'zustand'
import apiClient from '@/api/client'

interface FavoritesState {
  favoriteIds: Set<string>
  isLoading: boolean
  fetchFavoriteIds: () => Promise<void>
  toggleFavorite: (productId: string) => Promise<boolean>
  isFavorited: (productId: string) => boolean
  clear: () => void
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: new Set(),
  isLoading: false,

  fetchFavoriteIds: async () => {
    const token = localStorage.getItem('store_access_token')
    if (!token) return
    set({ isLoading: true })
    try {
      const r = await apiClient.get('/store/favorites/ids')
      const ids: string[] = r.data.data || []
      set({ favoriteIds: new Set(ids) })
    } catch {
      // silent fail
    }
    set({ isLoading: false })
  },

  toggleFavorite: async (productId: string) => {
    const token = localStorage.getItem('store_access_token')
    if (!token) throw new Error('Not authenticated')

    const prev = new Set(get().favoriteIds)
    const wasFavorited = prev.has(productId)

    // Optimistic update
    const next = new Set(prev)
    if (wasFavorited) next.delete(productId)
    else next.add(productId)
    set({ favoriteIds: next })

    try {
      const r = await apiClient.post('/store/favorites/toggle', { product_id: productId })
      return r.data.data?.favorited ?? !wasFavorited
    } catch {
      // Revert on error
      set({ favoriteIds: prev })
      throw new Error('Failed to toggle favorite')
    }
  },

  isFavorited: (productId: string) => get().favoriteIds.has(productId),

  clear: () => set({ favoriteIds: new Set() }),
}))
