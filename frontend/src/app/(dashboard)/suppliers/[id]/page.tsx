'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, Truck, Loader2, AlertTriangle, Mail, Phone, MapPin } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Badge, Button, Card, CardContent, PageHeader } from '@/components/ui'

interface SupplierResponse {
  id: string
  business_id: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  tax_number?: string | null
  website?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  notes?: string | null
  tags: string[]
  display_name: string
  full_address: string
  created_at: string
  updated_at: string
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

type ApiErrorShape = {
  response?: {
    data?: {
      detail?: string
    }
  }
}

export default function SupplierDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supplierId = params.id as string

  const [supplier, setSupplier] = useState<SupplierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function fetchSupplier() {
      try {
        setLoading(true)
        setError(null)

        const resp = await apiClient.get<SupplierResponse>(`/suppliers/${supplierId}`)
        setSupplier(resp.data)
      } catch (err: unknown) {
        const detail = (err as ApiErrorShape)?.response?.data?.detail
        setError(detail || 'Failed to load supplier')
      } finally {
        setLoading(false)
      }
    }

    if (supplierId) {
      fetchSupplier()
    }
  }, [supplierId])

  const title = useMemo(() => {
    if (!supplier) return 'Supplier'
    return supplier.display_name || supplier.name || 'Supplier'
  }, [supplier])

  const handleDelete = async () => {
    if (!supplier) return
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await apiClient.delete(`/suppliers/${supplierId}`)
      router.push('/suppliers')
    } catch (err) {
      console.error('Error deleting supplier:', err)
      setError('Failed to delete supplier')
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-400">Loading supplier...</p>
        </div>
      </div>
    )
  }

  if (error || !supplier) {
    return (
      <div className="text-center py-12">
        <Truck className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-100 mb-2">Supplier not found</h3>
        <p className="text-gray-400 mb-6">{error || 'The supplier you are looking for does not exist.'}</p>
        <Link href="/suppliers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Suppliers
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={supplier.contact_name ? `Contact: ${supplier.contact_name}` : 'Supplier details'}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/suppliers">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400">
                  <Truck className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white truncate">{title}</h2>
                    {supplier.tags?.length ? <Badge variant="secondary">{supplier.tags.length} tags</Badge> : null}
                  </div>
                  {supplier.tax_number ? <p className="text-sm text-gray-400">Tax: {supplier.tax_number}</p> : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Contact</h3>
                  {supplier.email ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300 min-w-0">
                      <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No email</p>
                  )}
                  {supplier.phone ? (
                    <div className="flex items-center gap-2 text-sm text-gray-300 min-w-0">
                      <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="truncate">{supplier.phone}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No phone</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Address</h3>
                  {supplier.full_address ? (
                    <div className="flex items-start gap-2 text-sm text-gray-300">
                      <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-gray-200 leading-relaxed">{supplier.full_address}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No address</p>
                  )}
                </div>
              </div>

              {supplier.notes ? (
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
                  <p className="text-gray-200 whitespace-pre-wrap text-sm">{supplier.notes}</p>
                </div>
              ) : null}

              {supplier.tags?.length ? (
                <div className="pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-white mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {supplier.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-yellow-900/10 border-yellow-500/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div className="text-sm text-gray-200">
                <p className="font-medium">Supplier orders</p>
                <p className="text-gray-400">Outbound supplier orders will be linked here once the orders split UI is enabled.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Supplier ID</span>
                  <span className="text-gray-200 font-mono text-xs truncate" title={supplier.id}>
                    {supplier.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Created</span>
                  <span className="text-gray-200">{formatDate(supplier.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Updated</span>
                  <span className="text-gray-200">{formatDate(supplier.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
