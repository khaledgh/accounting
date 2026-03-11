import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Package, MapPin, User } from 'lucide-react'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import type { Order, Address } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function AccountPage() {
  const { customer, isAuthenticated, loadProfile } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [tab, setTab] = useState<'orders' | 'addresses' | 'profile'>('orders')

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile()
      apiClient.get('/store/orders?page_size=10').then(r => setOrders(r.data.data?.items || []))
      apiClient.get('/store/addresses').then(r => setAddresses(r.data.data || []))
    }
  }, [isAuthenticated, loadProfile])

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Please sign in</h2>
        <Link to="/login" className="text-blue-600 hover:underline">Sign In</Link>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Helmet>
        <title>My Account — Store</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <h1 className="text-3xl font-bold mb-2">My Account</h1>
      {customer && <p className="text-gray-500 mb-8">{customer.first_name} {customer.last_name} &middot; {customer.email}</p>}

      <div className="flex gap-4 border-b mb-8">
        {[
          { key: 'orders' as const, label: 'Orders', icon: Package },
          { key: 'addresses' as const, label: 'Addresses', icon: MapPin },
          { key: 'profile' as const, label: 'Profile', icon: User },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No orders yet</p>
              <Link to="/products" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Start Shopping</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold">{order.order_number}</span>
                      <span className="text-sm text-gray-500 ml-3">{formatDate(order.order_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {order.status}
                      </span>
                      <span className="font-bold">{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <p className="text-sm text-gray-500">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'addresses' && (
        <div>
          {addresses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No saved addresses</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {addresses.map(addr => (
                <div key={addr.id} className="border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{addr.label || 'Address'}</span>
                    {addr.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-sm text-gray-600">
                    {addr.first_name} {addr.last_name}<br />
                    {addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}<br />
                    {addr.city}, {addr.state} {addr.postal_code}<br />
                    {addr.country}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'profile' && customer && (
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Name</label>
            <p className="font-medium">{customer.first_name} {customer.last_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Email</label>
            <p className="font-medium">{customer.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Phone</label>
            <p className="font-medium">{customer.phone || 'Not set'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
