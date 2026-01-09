'use client'

import { useEffect, useState, useRef } from 'react'
import { Search, Package } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

interface IngredientSuggestion {
  id: string
  name: string
  sku: string | null
  unit: string
  cost_price: number | null
  quantity_on_hand: number | null
  relevance_score: number
}

interface IngredientSuggestionsProps {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: IngredientSuggestion) => void
  placeholder?: string
  className?: string
}

export function IngredientSuggestions({
  value,
  onChange,
  onSelect,
  placeholder = 'Search ingredients...',
  className,
}: IngredientSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!isOpen) return

      setIsLoading(true)
      try {
        const params = new URLSearchParams({ query: value, limit: '10' })
        const response = await apiClient.get<IngredientSuggestion[]>(
          `/production/ingredients/suggestions?${params}`
        )
        setSuggestions(response.data)
      } catch (err) {
        console.error('Failed to fetch suggestions:', err)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(fetchSuggestions, 200)
    return () => clearTimeout(debounce)
  }, [value, isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleSelect = (suggestion: IngredientSuggestion) => {
    onSelect(suggestion)
    onChange(suggestion.name)
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-muted-foreground text-sm">Loading suggestions...</div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground text-sm">
              {value ? 'No matching products found' : 'Start typing to search products'}
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={cn(
                  'w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-muted transition-colors',
                  index === selectedIndex && 'bg-muted'
                )}
              >
                <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{suggestion.name}</div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {suggestion.sku && <span>SKU: {suggestion.sku}</span>}
                    {suggestion.cost_price !== null && (
                      <span>Cost: R {suggestion.cost_price.toFixed(2)}</span>
                    )}
                    {suggestion.quantity_on_hand !== null && (
                      <span
                        className={
                          suggestion.quantity_on_hand > 0 ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        Stock: {suggestion.quantity_on_hand}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default IngredientSuggestions
