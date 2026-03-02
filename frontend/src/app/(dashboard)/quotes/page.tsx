'use client'

/**
 * Proforma Invoices (Quotes) Management Page
 *
 * Lists all quotes with status badges, totals, and action buttons.
 * Supports creating new quotes, approving, rejecting, and converting to invoices.
 *
 * Why "quotes" URL instead of "proforma-invoices"?
 * The API endpoint is /quotes and the shorter URL is more user-friendly
 * in the browser address bar.  The page title clarifies the formal term.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  Search,
  Eye,
  X,
  Trash2,
} from 'lucide-react'

import { apiClient } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  PageHeader,
  LoadingSpinner,
  Badge,
  Input,
} from '@/components/ui'

/* ── Types ─────────────────────────────────────────────────────────── */

interface Quote {
  id: string
  business_id: string
  customer_id: string | null
  quote_number: string
  status: string
  issue_date: string | null
  expiry_date: string | null
  validity_days: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  notes: string | null
  terms: string | null
  converted_invoice_id: string | null
  created_at: string
}

interface QuoteListResponse {
  items: Quote[]
  total: number
  page: number
  per_page: number
  pages: number
}

/* ── Status styling ────────────────────────────────────────────────── */

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  sent: 'bg-blue-500/20 text-blue-300',
  viewed: 'bg-indigo-500/20 text-indigo-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  expired: 'bg-yellow-500/20 text-yellow-300',
  converted: 'bg-purple-500/20 text-purple-300',
  cancelled: 'bg-gray-500/20 text-gray-400',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
  cancelled: 'Cancelled',
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  /* ── Create form state ────────────────────────────────────────── */
  const [showForm, setShowForm] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [formTerms, setFormTerms] = useState('')
  const [formValidity, setFormValidity] = useState('30')
  const [formItems, setFormItems] = useState([
    { description: '', quantity: '1', unit_price: '', tax_rate: '15', discount_pct: '0' },
  ])
  const [isSaving, setIsSaving] = useState(false)

  /* ── Detail view state ────────────────────────────────────────── */
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)

  /* ── Fetch quotes ─────────────────────────────────────────────── */

  const fetchQuotes = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (statusFilter) params.append('status', statusFilter)
      const res = await apiClient.get<QuoteListResponse>(`/quotes?${params}`)
      setQuotes(res.data.items)
      setTotalPages(res.data.pages)
    } catch (err) {
      setError('Failed to load quotes')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  /* ── Actions ──────────────────────────────────────────────────── */

  const handleCreate = async () => {
    if (formItems.every((i) => !i.description.trim())) return
    setIsSaving(true)
    try {
      await apiClient.post('/quotes', {
        validity_days: parseInt(formValidity) || 30,
        notes: formNotes || null,
        terms: formTerms || null,
        items: formItems
          .filter((i) => i.description.trim())
          .map((i) => ({
            description: i.description.trim(),
            quantity: parseFloat(i.quantity) || 1,
            unit_price: parseFloat(i.unit_price) || 0,
            tax_rate: parseFloat(i.tax_rate) || 15,
            discount_pct: parseFloat(i.discount_pct) || 0,
          })),
      })
      setShowForm(false)
      setFormItems([{ description: '', quantity: '1', unit_price: '', tax_rate: '15', discount_pct: '0' }])
      setFormNotes('')
      setFormTerms('')
      fetchQuotes()
    } catch (err) {
      console.error('Failed to create quote:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await apiClient.patch(`/quotes/${id}/approve`)
      fetchQuotes()
      setSelectedQuote(null)
    } catch (err) {
      console.error('Failed to approve:', err)
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm('Reject this quote?')) return
    try {
      await apiClient.patch(`/quotes/${id}/reject`)
      fetchQuotes()
      setSelectedQuote(null)
    } catch (err) {
      console.error('Failed to reject:', err)
    }
  }

  const handleConvert = async (id: string) => {
    if (!confirm('Convert this quote to an invoice? This cannot be undone.')) return
    try {
      await apiClient.post(`/quotes/${id}/convert`)
      fetchQuotes()
      setSelectedQuote(null)
    } catch (err) {
      console.error('Failed to convert:', err)
    }
  }

  /* ── Add / remove line items ──────────────────────────────────── */

  const addLineItem = () => {
    setFormItems([
      ...formItems,
      { description: '', quantity: '1', unit_price: '', tax_rate: '15', discount_pct: '0' },
    ])
  }

  const removeLineItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: string, value: string) => {
    const updated = [...formItems]
    updated[index] = { ...updated[index], [field]: value }
    setFormItems(updated)
  }

  /* ── Filter ───────────────────────────────────────────────────── */

  const filtered = search
    ? quotes.filter(
        (q) =>
          q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
          (q.notes && q.notes.toLowerCase().includes(search.toLowerCase()))
      )
    : quotes

  /* ── Render ───────────────────────────────────────────────────── */

  if (isLoading && quotes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Proforma Invoices"
        description="Create and manage quotes for customers"
        actions={
          <Button variant="gradient" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Quote
          </Button>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">All Status</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="mb-6 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">New Quote</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Line Items */}
            <div className="space-y-3 mb-4">
              <label className="block text-sm text-gray-400">Line Items</label>
              {formItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Price</label>}
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Tax %</label>}
                    <Input
                      type="number"
                      value={item.tax_rate}
                      onChange={(e) => updateLineItem(i, 'tax_rate', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Disc %</label>}
                    <Input
                      type="number"
                      value={item.discount_pct}
                      onChange={(e) => updateLineItem(i, 'discount_pct', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    {formItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(i)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Validity (days)</label>
                <Input
                  type="number"
                  value={formValidity}
                  onChange={(e) => setFormValidity(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Terms</label>
                <Input
                  value={formTerms}
                  onChange={(e) => setFormTerms(e.target.value)}
                  placeholder="Payment terms"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="gradient" onClick={handleCreate} disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Quote'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedQuote && (
        <Card className="mb-6 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedQuote.quote_number}
                </h3>
                <Badge className={statusColors[selectedQuote.status]}>
                  {statusLabels[selectedQuote.status] || selectedQuote.status}
                </Badge>
              </div>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-400">Subtotal</span>
                <p className="text-white font-medium">R {Number(selectedQuote.subtotal).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-400">Tax</span>
                <p className="text-white font-medium">R {Number(selectedQuote.tax_amount).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-400">Discount</span>
                <p className="text-white font-medium">R {Number(selectedQuote.discount_amount).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-400">Total</span>
                <p className="text-white text-lg font-bold">R {Number(selectedQuote.total).toFixed(2)}</p>
              </div>
            </div>

            {selectedQuote.notes && (
              <p className="text-sm text-gray-400 mb-2">
                <strong>Notes:</strong> {selectedQuote.notes}
              </p>
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-700">
              {['draft', 'sent', 'viewed'].includes(selectedQuote.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApprove(selectedQuote.id)}
                  className="text-green-400 border-green-400/50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
              )}
              {['draft', 'sent', 'viewed'].includes(selectedQuote.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(selectedQuote.id)}
                  className="text-red-400 border-red-400/50"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              )}
              {selectedQuote.status === 'approved' && (
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => handleConvert(selectedQuote.id)}
                >
                  <ArrowRightCircle className="h-4 w-4 mr-1" /> Convert to Invoice
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quote List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No quotes yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first proforma invoice to start quoting customers.
            </p>
            <Button variant="gradient" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Card
              key={q.id}
              className="hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => setSelectedQuote(q)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-semibold">{q.quote_number}</span>
                      <Badge className={statusColors[q.status]}>
                        {statusLabels[q.status] || q.status}
                      </Badge>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-400">
                      <span>Issued: {q.issue_date || '—'}</span>
                      <span>Expires: {q.expiry_date || '—'}</span>
                      {q.converted_invoice_id && (
                        <span className="text-purple-400">Converted</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">
                      R {Number(q.total).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      excl. R {Number(q.tax_amount).toFixed(2)} tax
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
