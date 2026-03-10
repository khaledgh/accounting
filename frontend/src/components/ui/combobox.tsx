import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Search, Check, X, Loader2 } from 'lucide-react'

export interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
}

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options?: ComboboxOption[]
  onSearch?: (query: string) => void
  isLoading?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
}

export function Combobox({
  value,
  onChange,
  options = [],
  onSearch,
  isLoading = false,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  className,
  disabled = false,
  clearable = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [highlightIndex, setHighlightIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null)

  const selectedOption = options.find((o) => o.value === value)

  const filtered = React.useMemo(() => {
    if (onSearch) return options
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    )
  }, [options, search, onSearch])

  React.useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length, search])

  React.useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setSearch(q)
    if (onSearch) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onSearch(q), 300)
    }
  }

  const handleSelect = (optValue: string) => {
    onChange(optValue)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      scrollToHighlighted(Math.min(highlightIndex + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
      scrollToHighlighted(Math.max(highlightIndex - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex].value)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const scrollToHighlighted = (index: number) => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combobox-item]')
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' })
      }
    }
  }

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
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
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
          <ChevronDown
            size={14}
            className={cn(
              'text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {isLoading && <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />}
          </div>

          <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {isLoading ? 'Loading...' : emptyMessage}
              </div>
            ) : (
              filtered.map((option, index) => (
                <div
                  key={option.value}
                  data-combobox-item
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors',
                    index === highlightIndex && 'bg-accent text-accent-foreground',
                    option.value === value && 'font-medium'
                  )}
                >
                  <Check
                    size={14}
                    className={cn(
                      'shrink-0',
                      option.value === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{option.label}</div>
                    {option.sublabel && (
                      <div className="truncate text-xs text-muted-foreground">{option.sublabel}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
