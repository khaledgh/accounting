import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShoppingCart, ShoppingBag, Heart } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import type { Product } from '@/types'
import { formatCurrency, getImageUrl } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  onAuthRequired?: () => void
}

export default function ProductCard({ product, onAuthRequired }: ProductCardProps) {
  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const { isFavorited, toggleFavorite } = useFavoritesStore()
  const identifier = product.slug || product.id
  const favorited = isFavorited(product.id)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      onAuthRequired?.()
      return
    }
    try {
      await addItem(product.id, 1)
      toast.success(`${product.name} added to cart`)
    } catch {
      toast.error('Failed to add to cart')
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      onAuthRequired?.()
      return
    }
    try {
      const nowFavorited = await toggleFavorite(product.id)
      toast.success(nowFavorited ? 'Added to favorites' : 'Removed from favorites')
    } catch {
      toast.error('Failed to update favorites')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Link to={`/products/${identifier}`} className="block">
        <div className="relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-100/80 hover:border-gray-200 hover:shadow-xl hover:shadow-gray-200/40 transition-all duration-500">
          {/* Image */}
          <div className="aspect-square relative overflow-hidden">
            {product.image_url ? (
              <img src={getImageUrl(product.image_url)} alt={product.name} loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <ShoppingBag className="w-12 h-12 text-gray-300" />
              </div>
            )}

            {/* Discount badge */}
            {product.on_sale && product.discount_percentage > 0 && (
              <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/25">
                -{product.discount_percentage}%
              </div>
            )}

            {/* Favorite button — top right of image, always visible */}
            <button onClick={handleToggleFavorite}
              className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-200 shadow-sm cursor-pointer ${
                favorited
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-white/80 backdrop-blur-sm text-gray-500 hover:bg-white hover:text-red-500'
              }`}>
              <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Info */}
          <div className="p-4">
            {product.category && (
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{product.category.name}</span>
            )}
            <h3 className="font-semibold text-sm mt-1 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors duration-200">
              {product.name}
            </h3>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-gray-900">{formatCurrency(product.price)}</span>
                {product.on_sale && (
                  <span className="text-xs text-gray-400 line-through">{formatCurrency(product.original_price)}</span>
                )}
              </div>
              <button onClick={handleAddToCart}
                className="relative z-10 p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 active:scale-95 transition-all duration-150 shadow-sm cursor-pointer"
                title="Add to cart">
                <ShoppingCart className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
