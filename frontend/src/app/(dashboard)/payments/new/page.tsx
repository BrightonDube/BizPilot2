'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  DollarSign,
  CreditCard,
  Building2,
  Smartphone,
  Banknote,
  Receipt,
  Loader2,
  AlertTriangle,
  Check
} from 'lucide-react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { apiClient } from '@/lib/api'

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  total: number
  amount_paid: number
  status: string
}

interface Customer {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, description: 'Physical cash payment' },
  { value: 'card', label: 'Card', icon: CreditCard, description: 'Credit or debit card' },
  { value: 'bank_transfer', label: 'Bank Transfer / EFT', icon: Building2, description: 'Direct bank transfer' },
  { value: 'payfast', label: 'PayFast', icon: Receipt, description: 'PayFast gateway' },
  { value: 'yoco', label: 'Yoco', icon: CreditCard, description: 'Yoco card machine' },
  { value: 'snapscan', label: 'SnapScan', icon: Smartphone, description: 'QR code payment' },
]

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function NewPaymentPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchInvoice, setSearchInvoice] = useState('')
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false)
  
  const [formData, setFormData] = useState({
    invoice_id: '',
    customer_id: '',
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  })
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [invoicesRes, customersRes] = await Promise.all([
        apiClient.get('/invoices/unpaid?per_page=100'),
        apiClient.get('/customers?per_page=100'),
      ])
      setInvoices(invoicesRes.data.items || [])
      setCustomers(customersRes.data.items || [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(searchInvoice.toLowerCase()) ||
    inv.customer_name?.toLowerCase().includes(searchInvoice.toLowerCase())
  )

  const handleSelectInvoice = (invoice: Invoice) => {
    const total = toNumber(invoice.total, 0)
    const paid = toNumber(invoice.amount_paid, 0)
    const due = Math.max(0, total - paid)

    setSelectedInvoice(invoice)
    setFormData(prev => ({
      ...prev,
      invoice_id: invoice.id,
      customer_id: '', // Will be set from invoice
      amount: Number.isFinite(due) ? due.toFixed(2) : '0.00',
    }))
    setSearchInvoice(invoice.invoice_number)
    setShowInvoiceDropdown(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = toNumber(formData.amount, 0)
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      
      await apiClient.post('/payments', {
        invoice_id: formData.invoice_id || null,
        customer_id: formData.customer_id || null,
        amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        reference: formData.reference || null,
        notes: formData.notes || null,
        status: 'completed',
      })
      
      setSuccess(true)
      setTimeout(() => {
        router.push('/payments')
      }, 1500)
    } catch (err: unknown) {
      console.error('Failed to record payment:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to record payment'
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh]"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4"
        >
          <Check className="h-10 w-10 text-green-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Payment Recorded!</h2>
        <p className="text-gray-400">Redirecting to payments...</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-6 max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/payments">
          <Button variant="outline" size="sm" className="border-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Record Payment</h1>
          <p className="text-gray-400">Record a new payment transaction</p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{error}</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Selection */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-400" />
              Link to Invoice (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Search invoices by number or customer..."
                value={searchInvoice}
                onChange={(e) => {
                  setSearchInvoice(e.target.value)
                  setShowInvoiceDropdown(true)
                }}
                onFocus={() => setShowInvoiceDropdown(true)}
                className="bg-gray-900 border-gray-600"
              />
              {showInvoiceDropdown && filteredInvoices.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredInvoices.map(invoice => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => handleSelectInvoice(invoice)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-700 border-b border-gray-700 last:border-0"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-white">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-400">{invoice.customer_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white">{formatCurrency(invoice.total)}</p>
                          <p className="text-sm text-gray-400">
                            Due: {formatCurrency(invoice.total - invoice.amount_paid)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedInvoice && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">{selectedInvoice.invoice_number}</p>
                    <p className="text-sm text-gray-400">{selectedInvoice.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Amount Due</p>
                    <p className="font-bold text-lg text-blue-400">
                      {formatCurrency(selectedInvoice.total - selectedInvoice.amount_paid)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className="bg-gray-900 border-gray-600 pl-8"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => handleInputChange('payment_date', e.target.value)}
                  className="bg-gray-900 border-gray-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => handleInputChange('payment_method', method.value)}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      formData.payment_method === method.value
                        ? 'bg-blue-900/30 border-blue-500 text-white'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <method.icon className={`h-5 w-5 mb-2 ${
                      formData.payment_method === method.value ? 'text-blue-400' : 'text-gray-500'
                    }`} />
                    <p className="font-medium text-sm">{method.label}</p>
                    <p className="text-xs text-gray-500">{method.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reference / Transaction ID
              </label>
              <Input
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                className="bg-gray-900 border-gray-600"
                placeholder="e.g., Bank reference, card auth code..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Additional notes about this payment..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/payments">
            <Button variant="outline" className="border-gray-600">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Record Payment
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}
