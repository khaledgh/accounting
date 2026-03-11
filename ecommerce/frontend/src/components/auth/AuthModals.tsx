import { useState } from 'react'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const registerSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

interface AuthModalsProps {
  mode: 'login' | 'register' | null
  onClose: () => void
  onSwitch: (mode: 'login' | 'register') => void
}

export default function AuthModals({ mode, onClose, onSwitch }: AuthModalsProps) {
  return (
    <>
      <Dialog open={mode === 'login'} onOpenChange={open => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome back</DialogTitle>
            <DialogDescription>Sign in to your Bazarkon account</DialogDescription>
          </DialogHeader>
          <LoginForm onClose={onClose} onSwitch={() => onSwitch('register')} />
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'register'} onOpenChange={open => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create account</DialogTitle>
            <DialogDescription>Join Bazarkon for the best deals</DialogDescription>
          </DialogHeader>
          <RegisterForm onClose={onClose} onSwitch={() => onSwitch('login')} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function LoginForm({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = loginSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach(err => { fieldErrors[err.path[0] as string] = err.message })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      onClose()
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error || 'Invalid email or password'
      setErrors({ _root: msg })
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._root && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{errors._root}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm"
          placeholder="you@example.com" />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm"
            placeholder="••••••••" />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Sign In
      </button>
      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-blue-600 font-medium hover:underline">Create one</button>
      </p>
    </form>
  )
}

function RegisterForm({ onClose, onSwitch }: { onClose: () => void; onSwitch: () => void }) {
  const [form, setForm] = useState<RegisterForm>({ first_name: '', last_name: '', email: '', password: '', confirm_password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = registerSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach(err => { fieldErrors[err.path[0] as string] = err.message })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      await register({ email: form.email, password: form.password, first_name: form.first_name, last_name: form.last_name })
      toast.success('Account created! Check your email to verify.')
      onClose()
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error || 'Registration failed'
      setErrors({ _root: msg })
    }
    setLoading(false)
  }

  const update = (key: keyof RegisterForm, value: string) => setForm(f => ({ ...f, [key]: value }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._root && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{errors._root}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
          <input type="text" value={form.first_name} onChange={e => update('first_name', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm" />
          {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
          <input type="text" value={form.last_name} onChange={e => update('last_name', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm" />
          {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm"
          placeholder="you@example.com" />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} value={form.password}
            onChange={e => update('password', e.target.value)}
            className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm"
            placeholder="Min. 8 characters" />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
        <input type="password" value={form.confirm_password}
          onChange={e => update('confirm_password', e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition text-sm" />
        {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password}</p>}
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Account
      </button>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-blue-600 font-medium hover:underline">Sign in</button>
      </p>
    </form>
  )
}
