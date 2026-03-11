import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, getImageUrl } from '@/lib/utils'

export default function CartPage() {
  const { items, totalAmount, totalItems, fetchCart, updateItem, removeItem, isLoading } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) fetchCart()
  }, [isAuthenticated, fetchCart])

  const handleUpdate = async (itemId: string, qty: number) => {
    try {
      await updateItem(itemId, qty)
    } catch {
      toast.error('Failed to update item')
    }
  }

  const handleRemove = async (itemId: string) => {
    try {
      await removeItem(itemId)
      toast.success('Item removed from cart')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Helmet><title>Cart — Store</title></Helmet>
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your cart</h2>
        <Link to="/login" className="text-blue-600 hover:underline">Sign In</Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Helmet>
        <title>{`Shopping Cart (${totalItems}) — Bazarkon`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 className="text-3xl font-bold mb-8">Shopping Cart ({totalItems})</h1>

      {(!items || items.length === 0) ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <Link to="/products" className="text-blue-600 hover:underline">Continue Shopping</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            {items.map(item => (
              <div key={item.id} className="flex gap-4 p-4 border border-gray-100 rounded-2xl hover:border-gray-200 transition">
                <Link to={`/products/${item.product_slug || item.product_id}`} className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                  {item.product_image ? (
                    <img src={getImageUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/products/${item.product_id}`} className="font-medium hover:text-blue-600 line-clamp-1">
                    {item.product_name}
                  </Link>
                  <p className="text-sm text-gray-500">{formatCurrency(item.product_price)} each</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border rounded-lg">
                      <button onClick={() => handleUpdate(item.id, item.quantity - 1)} className="p-1.5 hover:bg-gray-50 rounded-l-lg transition">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 text-sm font-medium tabular-nums">{item.quantity}</span>
                      <button onClick={() => handleUpdate(item.id, item.quantity + 1)} className="p-1.5 hover:bg-gray-50 rounded-r-lg transition">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => handleRemove(item.id)} className="text-red-400 hover:text-red-600 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="font-bold text-sm">
                  {formatCurrency(item.product_price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-6 h-fit sticky top-24">
            <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal ({totalItems} items)</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
            </div>
            <div className="border-t mt-4 pt-4 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <Link to="/checkout"
              className="mt-6 block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-medium hover:bg-blue-700">
              Proceed to Checkout
            </Link>
            <Link to="/products" className="mt-3 block text-center text-sm text-blue-600 hover:underline">
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
