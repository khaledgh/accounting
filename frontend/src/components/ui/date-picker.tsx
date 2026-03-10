import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISO(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatDisplay(s: string): string {
  const d = parseISO(s)
  if (!d) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date...',
  className,
  disabled = false,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selected = parseISO(value)
  const today = new Date()
  const todayISO = toISO(today)

  const [viewYear, setViewYear] = React.useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = React.useState(selected?.getMonth() ?? today.getMonth())

  React.useEffect(() => {
    if (open && selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    } else if (open) {
      setViewYear(today.getFullYear())
      setViewMonth(today.getMonth())
    }
  }, [open])

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const selectDate = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    onChange(toISO(d))
    setOpen(false)
  }

  const goToday = () => {
    onChange(todayISO)
    setOpen(false)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'hover:bg-accent/50',
          open && 'ring-2 ring-ring ring-offset-2'
        )}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {clearable && value && (
            <span
              role="button"
              className="rounded-sm p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
            >
              <X size={14} className="text-muted-foreground" />
            </span>
          )}
          <Calendar size={14} className="text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border border-input bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="h-8" />
              }
              const iso = toISO(new Date(viewYear, viewMonth, day))
              const isSelected = iso === value
              const isToday = iso === todayISO
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    'flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                    isToday && !isSelected && 'border border-primary/50 font-semibold text-primary'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <button
              type="button"
              onClick={goToday}
              className="text-xs font-medium text-primary hover:underline"
            >
              Today
            </button>
            {value && (
              <span className="text-xs text-muted-foreground">
                {formatDisplay(value)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
