import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import {
  MapPin, Plus, CreditCard, Check, ChevronRight,
  ShoppingBag, Loader2, ArrowLeft, CheckCircle2, Package
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import type { Address, CartItem } from '@/types'
import { formatCurrency, getImageUrl } from '@/lib/utils'

type Step = 'shipping' | 'review' | 'confirmation'

interface NewAddressForm {
  first_name: string
  last_name: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  postal_code: string
  country: string
  label: string
  is_default: boolean
}

const emptyAddress: NewAddressForm = {
  first_name: '', last_name: '', phone: '', address1: '', address2: '',
  city: '', state: '', postal_code: '', country: 'US', label: 'home', is_default: false,
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string; icon: typeof MapPin }[] = [
    { key: 'shipping', label: 'Shipping', icon: MapPin },
    { key: 'review', label: 'Review & Pay', icon: CreditCard },
    { key: 'confirmation', label: 'Confirmation', icon: CheckCircle2 },
  ]
  const currentIdx = steps.findIndex(s => s.key === current)

  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const Icon = s.icon
        return (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-8 md:w-16 h-px ${done || active ? 'bg-gray-900' : 'bg-gray-200'}`} />
            )}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition
                ${done ? 'bg-green-500 text-white' : active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${active ? 'text-gray-900' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CartSummary({ items, totalAmount }: { items: CartItem[]; totalAmount: number }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-500">Order Summary</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-gray-100 shrink-0">
              {item.product_image ? (
                <img src={getImageUrl(item.product_image)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-gray-300" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.product_name}</p>
              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(item.product_price * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="border-t pt-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Shipping</span>
          <span className="text-green-600">Free</span>
        </div>
        <div className="flex justify-between font-bold text-base pt-1 border-t">
          <span>Total</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { items, totalAmount, totalItems, fetchCart } = useCartStore()

  const [step, setStep] = useState<Step>('shipping')
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [form, setForm] = useState<NewAddressForm>(emptyAddress)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [savingAddr, setSavingAddr] = useState(false)
  const [orderResult, setOrderResult] = useState<{
    order_id: string; order_number: string; total_amount: number
  } | null>(null)

  // Load cart + addresses
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    Promise.all([
      fetchCart(),
      apiClient.get('/store/addresses').then(r => {
        const addrs: Address[] = r.data.data || []
        setAddresses(addrs)
        const def = addrs.find(a => a.is_default) || addrs[0]
        if (def) setSelectedAddressId(def.id)
        if (addrs.length === 0) setShowNewForm(true)
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [isAuthenticated, navigate, fetchCart])

  const updateField = (key: keyof NewAddressForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSaveAddress = async () => {
    if (!form.first_name || !form.address1 || !form.city || !form.postal_code) {
      toast.error('Please fill in first name, address, city, and postal code')
      return
    }
    setSavingAddr(true)
    try {
      const r = await apiClient.post('/store/addresses', { ...form, is_default: addresses.length === 0 })
      const addr: Address = r.data.data
      setAddresses(prev => [...prev, addr])
      setSelectedAddressId(addr.id)
      setShowNewForm(false)
      setForm(emptyAddress)
      toast.success('Address saved')
    } catch {
      toast.error('Failed to save address')
    }
    setSavingAddr(false)
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) { toast.error('Please select a shipping address'); return }
    setPlacing(true)
    try {
      const r = await apiClient.post('/store/checkout', {
        shipping_address_id: selectedAddressId,
        notes,
        payment_method: paymentMethod,
      })
      setOrderResult(r.data.data)
      setStep('confirmation')
      await fetchCart()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to place order'
      toast.error(msg)
    }
    setPlacing(false)
  }

  const selectedAddress = addresses.find(a => a.id === selectedAddressId)

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 mx-auto text-gray-300 animate-spin" />
      </div>
    )
  }

  if (totalItems === 0 && step !== 'confirmation') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Helmet><title>Checkout — Bazarkon</title></Helmet>
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-200 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
        <Link to="/products" className="text-blue-600 hover:underline">Browse Products</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Helmet><title>Checkout — Bazarkon</title></Helmet>

      <StepIndicator current={step} />

      {/* ───────── STEP 1: SHIPPING ───────── */}
      {step === 'shipping' && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="grid md:grid-cols-5 gap-8">
          <div className="md:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Shipping Address</h2>
              {addresses.length > 0 && !showNewForm && (
                <button onClick={() => setShowNewForm(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add New
                </button>
              )}
            </div>

            {/* Saved addresses */}
            {!showNewForm && addresses.length > 0 && (
              <div className="space-y-3">
                {addresses.map(addr => (
                  <button key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                      selectedAddressId === addr.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{addr.first_name} {addr.last_name}</span>
                          {addr.is_default && (
                            <span className="text-[10px] font-bold uppercase bg-gray-900 text-white px-2 py-0.5 rounded-full">Default</span>
                          )}
                          <span className="text-[10px] font-medium uppercase text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{addr.label}</span>
                        </div>
                        <p className="text-sm text-gray-600">{addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}</p>
                        <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.postal_code}, {addr.country}</p>
                        {addr.phone && <p className="text-xs text-gray-400 mt-1">{addr.phone}</p>}
                      </div>
                      {selectedAddressId === addr.id && (
                        <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* New address form */}
            {showNewForm && (
              <div className="border border-gray-200 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold">New Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="First name *" value={form.first_name} onChange={e => updateField('first_name', e.target.value)} className={inputCls} />
                  <input placeholder="Last name" value={form.last_name} onChange={e => updateField('last_name', e.target.value)} className={inputCls} />
                </div>
                <input placeholder="Phone" value={form.phone} onChange={e => updateField('phone', e.target.value)} className={inputCls} />
                <input placeholder="Street address *" value={form.address1} onChange={e => updateField('address1', e.target.value)} className={inputCls} />
                <input placeholder="Apartment, suite, etc." value={form.address2} onChange={e => updateField('address2', e.target.value)} className={inputCls} />
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="City *" value={form.city} onChange={e => updateField('city', e.target.value)} className={inputCls} />
                  <input placeholder="State" value={form.state} onChange={e => updateField('state', e.target.value)} className={inputCls} />
                  <input placeholder="Postal code *" value={form.postal_code} onChange={e => updateField('postal_code', e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.country} onChange={e => updateField('country', e.target.value)} className={inputCls}>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                  </select>
                  <select value={form.label} onChange={e => updateField('label', e.target.value)} className={inputCls}>
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleSaveAddress} disabled={savingAddr}
                    className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
                    {savingAddr && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Address
                  </button>
                  {addresses.length > 0 && (
                    <button onClick={() => { setShowNewForm(false); setForm(emptyAddress) }}
                      className="px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Order Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Special delivery instructions..."
                className={inputCls + ' resize-none'} />
            </div>

            {/* Continue */}
            <div className="flex gap-3">
              <Link to="/cart"
                className="px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition flex items-center gap-2 border border-gray-200">
                <ArrowLeft className="w-4 h-4" /> Back to Cart
              </Link>
              <button onClick={() => {
                if (!selectedAddressId) { toast.error('Please select or add a shipping address'); return }
                setStep('review')
              }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2">
                Continue to Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <CartSummary items={items} totalAmount={totalAmount} />
          </div>
        </motion.div>
      )}

      {/* ───────── STEP 2: REVIEW & PAY ───────── */}
      {step === 'review' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid md:grid-cols-5 gap-8">
          <div className="md:col-span-3 space-y-6">
            <h2 className="text-xl font-bold">Review Your Order</h2>

            {/* Shipping info */}
            {selectedAddress && (
              <div className="border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" /> Shipping To
                  </h3>
                  <button onClick={() => setStep('shipping')} className="text-xs text-blue-600 hover:underline">Change</button>
                </div>
                <p className="text-sm font-medium">{selectedAddress.first_name} {selectedAddress.last_name}</p>
                <p className="text-sm text-gray-600">{selectedAddress.address1}{selectedAddress.address2 ? `, ${selectedAddress.address2}` : ''}</p>
                <p className="text-sm text-gray-600">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}, {selectedAddress.country}</p>
                {selectedAddress.phone && <p className="text-xs text-gray-400 mt-1">{selectedAddress.phone}</p>}
              </div>
            )}

            {/* Items */}
            <div className="border border-gray-200 rounded-2xl p-5">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-gray-400" /> Items ({totalItems})
              </h3>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                      {item.product_image ? (
                        <img src={getImageUrl(item.product_image)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-gray-300" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.product_price)} × {item.quantity}</p>
                    </div>
                    <span className="font-semibold text-sm">{formatCurrency(item.product_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div className="border border-gray-200 rounded-2xl p-5">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4 text-gray-400" /> Payment Method
              </h3>
              <div className="space-y-2">
                {[
                  { value: 'cod', label: 'Cash on Delivery', desc: 'Pay when you receive your order' },
                  { value: 'bank_transfer', label: 'Bank Transfer', desc: 'Transfer to our bank account' },
                ].map(pm => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition ${
                      paymentMethod === pm.value ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{pm.label}</p>
                        <p className="text-xs text-gray-500">{pm.desc}</p>
                      </div>
                      {paymentMethod === pm.value && (
                        <div className="w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes preview */}
            {notes && (
              <div className="border border-gray-200 rounded-2xl p-5">
                <h3 className="font-semibold text-sm mb-2">Order Notes</h3>
                <p className="text-sm text-gray-600">{notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setStep('shipping')}
                className="px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition flex items-center gap-2 border border-gray-200">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handlePlaceOrder} disabled={placing}
                className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                {placing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                {placing ? 'Placing Order...' : `Place Order — ${formatCurrency(totalAmount)}`}
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <CartSummary items={items} totalAmount={totalAmount} />
          </div>
        </motion.div>
      )}

      {/* ───────── STEP 3: CONFIRMATION ───────── */}
      {step === 'confirmation' && orderResult && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto text-center py-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-8">Thank you for your order. We'll send you updates on your delivery status.</p>

          <div className="bg-gray-50 rounded-2xl p-6 text-left mb-8 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order Number</span>
              <span className="font-bold">{orderResult.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Amount</span>
              <span className="font-bold">{formatCurrency(orderResult.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment Method</span>
              <span className="font-medium capitalize">{paymentMethod === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full" /> Pending
              </span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Link to="/account"
              className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition">
              View My Orders
            </Link>
            <Link to="/products"
              className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition">
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
