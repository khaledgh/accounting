import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ShoppingCart, Heart, Minus, Plus, ShoppingBag, Star, Check, Package, RefreshCcw, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import type { Product } from '@/types'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'

export default function ProductDetailPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [reviewSummary, setReviewSummary] = useState({ average_rating: 0, total_reviews: 0 })
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const { addItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const { isFavorited, toggleFavorite } = useFavoritesStore()
  const { openLoginModal } = useUIStore()
  const favorited = product ? isFavorited(product.id) : false

  const handleToggleFavorite = async () => {
    if (!product) return
    if (!isAuthenticated) { openLoginModal(); return }
    try {
      const nowFav = await toggleFavorite(product.id)
      toast.success(nowFav ? 'Added to favorites' : 'Removed from favorites')
    } catch {
      toast.error('Failed to update favorites')
    }
  }

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    apiClient.get(`/store/products/${slug}`)
      .then(r => {
        setProduct(r.data.data.product)
        setReviewSummary(r.data.data.reviews || { average_rating: 0, total_reviews: 0 })
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [slug])

  const handleAddToCart = async () => {
    if (!product) return
    if (!isAuthenticated) { openLoginModal(); return }
    setAdding(true)
    try {
      await addItem(product.id, quantity)
      toast.success(`${product.name} added to cart`)
      setQuantity(1)
    } catch {
      toast.error('Failed to add item to cart')
    }
    setAdding(false)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
          <div className="space-y-4 py-4">
            <div className="h-4 bg-gray-100 rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-gray-100 rounded w-3/4 animate-pulse" />
            <div className="h-8 bg-gray-100 rounded w-1/3 animate-pulse" />
            <div className="h-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-14 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Product not found</h2>
        <Link to="/products" className="text-blue-600 hover:underline">Back to products</Link>
      </div>
    )
  }

  const discount = product.compare_price > product.price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0
  const inStock = !product.track_stock || product.stock_quantity > 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Helmet>
        <title>{product.meta_title || product.name} — Store</title>
        <meta name="description" content={product.meta_description || product.description || `Buy ${product.name} at the best price.`} />
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description || product.name} />
        <meta property="og:type" content="product" />
        {product.image_url && <meta property="og:image" content={getImageUrl(product.image_url)} />}
        <link rel="canonical" href={`/products/${product.slug || product.id}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "Product", name: product.name,
          description: product.description, sku: product.sku,
          offers: { "@type": "Offer", price: product.price, priceCurrency: product.currency_code || "USD", availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
        })}</script>
      </Helmet>

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 flex-wrap">
          <li><Link to="/" className="hover:text-blue-600">Home</Link></li>
          <li className="text-gray-300">/</li>
          <li><Link to="/products" className="hover:text-blue-600">Products</Link></li>
          {product.category && (
            <>
              <li className="text-gray-300">/</li>
              <li><Link to={`/products?category_id=${product.category.id}`} className="hover:text-blue-600">{product.category.name}</Link></li>
            </>
          )}
          <li className="text-gray-300">/</li>
          <li className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</li>
        </ol>
      </nav>

      <div className="grid md:grid-cols-2 gap-10 lg:gap-14">
        {/* Image */}
        <div className="sticky top-24 self-start">
          <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
            {product.image_url ? (
              <img src={getImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-24 h-24 text-gray-200" />
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div>
          {product.category && (
            <Link to={`/products?category_id=${product.category.id}`}
              className="inline-block text-xs font-medium uppercase tracking-wider text-blue-600 hover:text-blue-700 mb-3">
              {product.category.name}
            </Link>
          )}

          <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">{product.name}</h1>

          {/* Rating */}
          {reviewSummary.total_reviews > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(reviewSummary.average_rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">{reviewSummary.average_rating.toFixed(1)} ({reviewSummary.total_reviews} reviews)</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-4xl font-extrabold">{formatCurrency(product.price)}</span>
            {discount > 0 && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatCurrency(product.compare_price)}</span>
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full">-{discount}%</span>
              </>
            )}
          </div>

          {/* Description */}
          {(product.short_desc || product.description) && (
            <div className="mb-6 space-y-2">
              {product.short_desc && (
                <p className="text-gray-800 font-medium leading-relaxed">{product.short_desc}</p>
              )}
              {product.description && (
                <p className="text-gray-600 leading-relaxed text-[15px] whitespace-pre-line">{product.description}</p>
              )}
            </div>
          )}

          {/* Stock */}
          <div className="mb-6">
            {product.track_stock ? (
              <div className={`inline-flex items-center gap-1.5 text-sm font-medium ${inStock ? 'text-emerald-600' : 'text-red-600'}`}>
                {inStock ? <Check className="w-4 h-4" /> : null}
                {inStock ? `${product.stock_quantity} in stock` : 'Out of stock'}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check className="w-4 h-4" /> Available
              </div>
            )}
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2.5">Variants</h3>
              <div className="flex flex-wrap gap-2">
                {product.variants.map(v => (
                  <span key={v.id} className="px-4 py-2 border-2 border-gray-200 hover:border-blue-500 rounded-xl text-sm font-medium cursor-pointer transition">{v.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Add to Cart */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center border-2 border-gray-200 rounded-xl">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 hover:bg-gray-50 rounded-l-xl transition" aria-label="Decrease quantity">
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-5 font-semibold tabular-nums">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-3 hover:bg-gray-50 rounded-r-xl transition" aria-label="Increase quantity">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {isAuthenticated ? (
              <button onClick={handleAddToCart} disabled={adding || !inStock}
                className="flex-1 bg-blue-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/20">
                <ShoppingCart className="w-5 h-5" />
                {adding ? 'Adding...' : 'Add to Cart'}
              </button>
            ) : (
              <Link to="/login" className="flex-1 bg-blue-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-blue-700 text-center shadow-lg shadow-blue-600/20">
                Sign in to add to cart
              </Link>
            )}

            <button onClick={handleToggleFavorite}
              className={`p-3.5 border-2 rounded-xl transition ${favorited ? 'border-red-300 bg-red-50 text-red-500' : 'border-gray-200 hover:border-red-300 hover:bg-red-50'}`}
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}>
              <Heart className={`w-5 h-5 ${favorited ? 'fill-current text-red-500' : ''}`} />
            </button>
          </div>

          {/* Product promises */}
          <div className="grid grid-cols-3 gap-3 border-t pt-6 mb-6">
            {[
              { icon: Package, label: 'Free Shipping' },
              { icon: RefreshCcw, label: '30-Day Returns' },
              { icon: Shield, label: 'Secure Payment' },
            ].map(p => (
              <div key={p.label} className="flex flex-col items-center text-center gap-1.5">
                <p.icon className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{p.label}</span>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="border-t pt-6 text-sm text-gray-500 space-y-1.5">
            <p><span className="font-medium text-gray-700">SKU:</span> {product.sku}</p>
            {product.weight > 0 && <p><span className="font-medium text-gray-700">Weight:</span> {product.weight} {product.unit || 'kg'}</p>}
            {product.category && <p><span className="font-medium text-gray-700">Category:</span> {product.category.name}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
