import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Calculator,
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Truck,
  BarChart3,
  Settings,
  CreditCard,
  Warehouse,
  Tags,
  Receipt,
  Link2,
  Landmark,
  Banknote,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  children?: NavItem[]
}

const accountingNav: NavItem[] = [
  { label: 'Dashboard', href: '/accounting', icon: <LayoutDashboard size={18} /> },
  { label: 'Chart of Accounts', href: '/accounting/accounts', icon: <BookOpen size={18} /> },
  { label: 'Journal Entries', href: '/accounting/journals', icon: <FileText size={18} /> },
  { label: 'Financial Years', href: '/accounting/financial-years', icon: <Calculator size={18} /> },
  { label: 'Currencies', href: '/accounting/currencies', icon: <DollarSign size={18} /> },
  { label: 'Expenses', href: '/accounting/expenses', icon: <Receipt size={18} /> },
  { label: 'Banking', href: '/accounting/bank-accounts', icon: <Landmark size={18} /> },
  { label: 'Payments', href: '/accounting/payments', icon: <Banknote size={18} /> },
  { label: 'Purchase Invoices', href: '/accounting/purchase-invoices', icon: <FileText size={18} /> },
  {
    label: 'Reports',
    icon: <BarChart3 size={18} />,
    children: [
      { label: 'General Ledger', href: '/accounting/reports/general-ledger', icon: <FileText size={16} /> },
      { label: 'Trial Balance', href: '/accounting/reports/trial-balance', icon: <FileText size={16} /> },
      { label: 'Balance Sheet', href: '/accounting/reports/balance-sheet', icon: <FileText size={16} /> },
      { label: 'Profit & Loss', href: '/accounting/reports/profit-loss', icon: <FileText size={16} /> },
      { label: 'Cash Flow', href: '/accounting/reports/cash-flow', icon: <FileText size={16} /> },
    ],
  },
]

const ecommerceNav: NavItem[] = [
  { label: 'Dashboard', href: '/ecommerce', icon: <LayoutDashboard size={18} /> },
  { label: 'Products', href: '/ecommerce/products', icon: <Package size={18} /> },
  { label: 'Categories', href: '/ecommerce/categories', icon: <Tags size={18} /> },
  { label: 'Orders', href: '/ecommerce/orders', icon: <ShoppingCart size={18} /> },
  { label: 'Customers', href: '/ecommerce/customers', icon: <Users size={18} /> },
  { label: 'Suppliers', href: '/ecommerce/suppliers', icon: <Truck size={18} /> },
  { label: 'Inventory', href: '/ecommerce/inventory', icon: <Warehouse size={18} /> },
  { label: 'Invoices', href: '/ecommerce/invoices', icon: <Receipt size={18} /> },
  { label: 'Payments', href: '/ecommerce/payments', icon: <CreditCard size={18} /> },
]

const systemNav: NavItem[] = [
  { label: 'Integration', href: '/integration', icon: <Link2 size={18} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
]

function getAllHrefs(items: NavItem[]): string[] {
  const hrefs: string[] = []
  for (const item of items) {
    if (item.href) hrefs.push(item.href)
    if (item.children) hrefs.push(...getAllHrefs(item.children))
  }
  return hrefs
}

function isRouteInSection(pathname: string, items: NavItem[]): boolean {
  const hrefs = getAllHrefs(items)
  return hrefs.some((h) => pathname === h || pathname.startsWith(h + '/'))
}

function CollapsibleSection({
  title,
  icon,
  items,
  defaultOpen,
}: {
  title: string
  icon: React.ReactNode
  items: NavItem[]
  defaultOpen: boolean
}) {
  const location = useLocation()
  const hasActiveChild = isRouteInSection(location.pathname, items)
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveChild)

  if (hasActiveChild && !isOpen) {
    setIsOpen(true)
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors',
          'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          hasActiveChild && 'text-sidebar-foreground'
        )}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          size={14}
          className={cn(
            'transition-transform duration-200',
            !isOpen && '-rotate-90'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <nav className="space-y-0.5 px-2 pb-2 pt-1">
          {items.map((item) => (
            <NavItemComponent key={item.label} item={item} />
          ))}
        </nav>
      </div>
    </div>
  )
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        {title}
      </h3>
      <nav className="space-y-0.5 px-2">
        {items.map((item) => (
          <NavItemComponent key={item.label} item={item} />
        ))}
      </nav>
    </div>
  )
}

function NavItemComponent({ item }: { item: NavItem }) {
  const location = useLocation()

  const isChildActive = item.children
    ? item.children.some((child) =>
        child.href ? location.pathname === child.href || location.pathname.startsWith(child.href + '/') : false
      )
    : false

  const [isOpen, setIsOpen] = useState(isChildActive)

  if (isChildActive && !isOpen) {
    setIsOpen(true)
  }

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            isChildActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            size={14}
            className={cn(
              'transition-transform duration-200',
              !isOpen && '-rotate-90'
            )}
          />
        </button>
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="ml-4 mt-1 space-y-0.5">
            {item.children.map((child) => (
              <NavItemComponent key={child.label} item={child} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <NavLink
      to={item.href!}
      end={item.href === '/accounting' || item.href === '/ecommerce'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
        )
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          E
        </div>
        <span className="text-lg font-bold text-sidebar-primary">ERP System</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2">
        <CollapsibleSection
          title="Accounting"
          icon={<Calculator size={16} />}
          items={accountingNav}
          defaultOpen={true}
        />
        <CollapsibleSection
          title="eCommerce"
          icon={<ShoppingCart size={16} />}
          items={ecommerceNav}
          defaultOpen={false}
        />
        <div className="mt-2 px-1">
          <NavSection title="System" items={systemNav} />
        </div>
      </div>
    </aside>
  )
}
