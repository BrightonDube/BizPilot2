'use client'

import { useCallback, useMemo, useState } from 'react'

export interface CurrencyConfig {
  code: string
  name: string
  symbol: string
}

const STORAGE_KEY = 'bizpilot_currency'

const CURRENCIES: CurrencyConfig[] = [
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P' },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
]

export function getAvailableCurrencies() {
  return CURRENCIES
}

export function getCurrencyConfig(code: string | null | undefined) {
  const normalized = (code || '').toUpperCase()
  return CURRENCIES.find((c) => c.code === normalized) || CURRENCIES[0]
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'ZAR'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? stored.toUpperCase() : 'ZAR'
  })

  const setCurrency = useCallback((currencyCode: string) => {
    const normalized = currencyCode.toUpperCase()
    setCurrencyState(normalized)
    window.localStorage.setItem(STORAGE_KEY, normalized)
  }, [])

  const availableCurrencies = useMemo(() => getAvailableCurrencies(), [])
  const config = useMemo(() => getCurrencyConfig(currency), [currency])

  return {
    currency,
    config,
    setCurrency,
    availableCurrencies,
  }
}

export default useCurrency
