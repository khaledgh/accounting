import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { LogOut, Bell, AlertTriangle, XCircle } from 'lucide-react'
import apiClient from '@/api/client'

interface Notification {
  type: string
  product_id: string
  sku: string
  name: string
  stock: number
  alert: number
}

export function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications')
      setNotifications(res.data.data?.notifications || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const count = notifications.length

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {user?.company?.name || 'ERP System'}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={panelRef}>
          <Button variant="ghost" size="icon" className="relative" onClick={() => setShowPanel(!showPanel)}>
            <Bell size={18} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Button>

          {showPanel && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-background shadow-lg z-50">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">Stock Alerts</p>
                <p className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''} need attention</p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">No alerts</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.product_id}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => { setShowPanel(false); navigate('/ecommerce/inventory') }}
                    >
                      {n.type === 'out_of_stock' ? (
                        <XCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                      ) : (
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange-500" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{n.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {n.type === 'out_of_stock' ? 'Out of stock' : `Low stock: ${n.stock} left (alert: ${n.alert})`}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {count > 0 && (
                <div className="border-t px-4 py-2">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setShowPanel(false); navigate('/ecommerce/inventory') }}>
                    View Inventory
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={logout} title="Logout">
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  )
}
