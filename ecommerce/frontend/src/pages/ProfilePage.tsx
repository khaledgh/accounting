import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { User, Mail, Shield, ShieldCheck, Clock, Package, MapPin, Loader2, Send, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/api/client'
import { formatCurrency } from '@/lib/utils'
import type { Order, Address } from '@/types'

const RESEND_COOLDOWN = 60

export default function ProfilePage() {
  const { isAuthenticated, customer, loadProfile } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'profile' | 'orders' | 'addresses'>('profile')
  const [orders, setOrders] = useState<Order[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [resendTimer, setResendTimer] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return }
    loadProfile()
    Promise.all([
      apiClient.get('/store/orders').then(r => setOrders(r.data.data?.items || r.data.data || [])).catch(() => {}),
      apiClient.get('/store/addresses').then(r => setAddresses(r.data.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [isAuthenticated, navigate, loadProfile])

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  const handleResendVerification = async () => {
    if (resendTimer > 0 || resending) return
    setResending(true)
    try {
      await apiClient.post('/store/auth/resend-verification', { email: customer?.email })
      toast.success('Verification email sent!')
      setResendTimer(RESEND_COOLDOWN)
    } catch {
      toast.error('Failed to resend verification')
    }
    setResending(false)
  }

  if (!customer) return null

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'orders' as const, label: 'Orders', icon: Package },
    { id: 'addresses' as const, label: 'Addresses', icon: MapPin },
  ]

  return (
    <div className="min-h-screen bg-gray-50/40">
      <Helmet>
        <title>My Profile — Bazarkon</title>
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0">
            {customer.first_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.first_name} {customer.last_name}</h1>
            <p className="text-sm text-gray-500">{customer.email}</p>
          </div>
        </motion.div>

        {/* Verification Banner */}
        {!customer.email_verified && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-900 text-sm">Verify your email</p>
                <p className="text-xs text-amber-700/80">Check your inbox for a verification link to unlock all features.</p>
              </div>
            </div>
            <button onClick={handleResendVerification} disabled={resendTimer > 0 || resending}
              className="shrink-0 bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition flex items-center gap-2">
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : resendTimer > 0 ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Email'}
            </button>
          </motion.div>
        )}

        {customer.email_verified && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-green-50 border border-green-200/60 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900 text-sm">Email verified</p>
              <p className="text-xs text-green-700/80">Your account is fully verified and secured.</p>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'profile' && <ProfileTab customer={customer} />}
            {tab === 'orders' && <OrdersTab orders={orders} />}
            {tab === 'addresses' && <AddressesTab addresses={addresses} />}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function ProfileTab({ customer }: { customer: NonNullable<ReturnType<typeof useAuthStore.getState>['customer']> }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
      {[
        { label: 'First Name', value: customer.first_name, icon: User },
        { label: 'Last Name', value: customer.last_name, icon: User },
        { label: 'Email', value: customer.email, icon: Mail },
        { label: 'Verification', value: customer.email_verified ? 'Verified' : 'Not verified', icon: customer.email_verified ? ShieldCheck : Shield },
      ].map(row => (
        <div key={row.label} className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
            <row.icon className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium">{row.label}</p>
            <p className="text-sm font-medium text-gray-900 truncate">{row.value || '—'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function OrdersTab({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No orders yet</p>
        <p className="text-sm text-gray-400 mt-1">Your order history will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Order #{order.order_number}</p>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${
                order.status === 'delivered' ? 'bg-green-50 text-green-700' :
                order.status === 'shipped' ? 'bg-blue-50 text-blue-700' :
                order.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                'bg-gray-50 text-gray-600'
              }`}>
                {order.status === 'delivered' && <CheckCircle2 className="w-3 h-3" />}
                {order.status?.charAt(0).toUpperCase()}{order.status?.slice(1)}
              </span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
          {order.items && order.items.length > 0 && (
            <div className="text-xs text-gray-500">
              {order.items.length} item{order.items.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AddressesTab({ addresses }: { addresses: Address[] }) {
  if (addresses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No saved addresses</p>
        <p className="text-sm text-gray-400 mt-1">Add a shipping address at checkout</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {addresses.map(addr => (
        <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{addr.first_name} {addr.last_name}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}<br />
                {addr.city}, {addr.state} {addr.postal_code}<br />
                {addr.country}
              </p>
              {addr.is_default && (
                <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Default</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
