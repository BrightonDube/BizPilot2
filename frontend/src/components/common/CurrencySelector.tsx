'use client'

import React from 'react'
import { useCurrency } from '@/hooks/useCurrency'

interface CurrencySelectorProps {
  className?: string
  showLabel?: boolean
  onChange?: (currencyCode: string) => void
  value?: string
}

export function CurrencySelector({
  className = '',
  showLabel = true,
  onChange,
  value,
}: CurrencySelectorProps) {
  const currencyState = useCurrency()
  const currency = value || currencyState.currency
  const config = currencyState.availableCurrencies.find((c) => c.code === currency) || currencyState.config
  const [isOpen, setIsOpen] = React.useState(false)

  const availableCurrencies = currencyState.availableCurrencies

  const handleCurrencyChange = (currencyCode: string) => {
    if (!value) {
      currencyState.setCurrency(currencyCode)
    }
    onChange?.(currencyCode)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 hover:bg-gray-700/60 rounded-lg transition-all text-gray-200 w-full border border-gray-700"
        aria-label="Select Currency"
        type="button"
      >
        <span className="text-sm font-medium">{config.symbol}</span>
        {showLabel && (
          <>
            <span className="flex-1 text-left text-sm">{config.name || currency}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="absolute bottom-full mb-2 left-0 right-0 w-full min-w-[220px] bg-gray-900 rounded-lg shadow-xl border border-gray-700 z-20 max-h-80 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Select Currency
              </div>

              <div className="mb-2">
                <div className="px-3 py-1 text-xs text-gray-500">Popular</div>
                {['ZAR', 'USD', 'EUR', 'GBP'].map((code) => {
                  const curr = availableCurrencies.find((c) => c.code === code)
                  if (!curr) return null

                  return (
                    <button
                      key={code}
                      onClick={() => handleCurrencyChange(code)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-all ${
                        currency === code
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">
                          <span className="font-medium">{curr.symbol} {curr.code}</span>
                          <span className="text-gray-400 ml-1 text-xs">{curr.name}</span>
                        </span>
                        {currency === code && (
                          <span className="text-blue-200 flex-shrink-0">✓</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div>
                <div className="px-3 py-1 text-xs text-gray-500">All Currencies</div>
                {availableCurrencies
                  .filter((c) => !['ZAR', 'USD', 'EUR', 'GBP'].includes(c.code))
                  .map((curr) => (
                    <button
                      key={curr.code}
                      onClick={() => handleCurrencyChange(curr.code)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-all ${
                        currency === curr.code
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">
                          <span className="font-medium">{curr.symbol} {curr.code}</span>
                          <span className="text-gray-400 ml-1 text-xs">{curr.name}</span>
                        </span>
                        {currency === curr.code && (
                          <span className="text-blue-200 flex-shrink-0">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CurrencySelector
