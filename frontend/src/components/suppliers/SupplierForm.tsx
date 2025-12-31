'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'

import { apiClient } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from '@/components/ui'

type Mode = 'create' | 'edit'

type ApiErrorShape = {
  response?: {
    data?: {
      detail?:
        | string
        | Array<{
            msg?: string
          }>
    }
  }
}

interface SupplierApiResponse {
  id: string
  business_id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  tax_number: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  notes: string | null
  tags: string[]
  display_name: string
  full_address: string
  created_at: string
  updated_at: string
}

type SupplierUpsertPayload = {
  name: string
  contact_name?: string
  email?: string
  phone?: string
  tax_number?: string
  website?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  notes?: string
  tags?: string[]
}

function getApiErrorMessage(err: unknown, fallback: string) {
  const anyErr = err as ApiErrorShape
  const detail = anyErr.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const msg = first?.msg
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export function SupplierForm({ mode, supplierId }: { mode: Mode; supplierId?: string }) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(mode === 'edit')
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    tax_number: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    notes: '',
    tags: '',
  })

  useEffect(() => {
    if (mode !== 'edit' || !supplierId) return

    async function fetchSupplier() {
      try {
        setIsFetching(true)
        setError(null)

        const response = await apiClient.get<SupplierApiResponse>(`/suppliers/${supplierId}`)
        const supplier = response.data

        setFormData({
          name: supplier.name || '',
          contact_name: supplier.contact_name || '',
          email: supplier.email || '',
          phone: supplier.phone || '',
          tax_number: supplier.tax_number || '',
          website: supplier.website || '',
          address_line1: supplier.address_line1 || '',
          address_line2: supplier.address_line2 || '',
          city: supplier.city || '',
          state: supplier.state || '',
          postal_code: supplier.postal_code || '',
          country: supplier.country || '',
          notes: supplier.notes || '',
          tags: (supplier.tags || []).join(', '),
        })
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to load supplier. Please try again.'))
      } finally {
        setIsFetching(false)
      }
    }

    fetchSupplier()
  }, [mode, supplierId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const payload: SupplierUpsertPayload = {
        name: formData.name.trim(),
        contact_name: formData.contact_name.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        tax_number: formData.tax_number.trim() || undefined,
        website: formData.website.trim() || undefined,
        address_line1: formData.address_line1.trim() || undefined,
        address_line2: formData.address_line2.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        postal_code: formData.postal_code.trim() || undefined,
        country: formData.country.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      }

      if (mode === 'create') {
        await apiClient.post('/suppliers', payload)
        router.push('/suppliers')
      } else {
        await apiClient.put(`/suppliers/${supplierId}`, payload)
        router.push(`/suppliers/${supplierId}`)
      }
    } catch (err) {
      setError(getApiErrorMessage(err, mode === 'create' ? 'Failed to create supplier.' : 'Failed to update supplier.'))
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500 mx-auto" />
          <p className="mt-2 text-gray-400">Loading supplier...</p>
        </div>
      </div>
    )
  }

  const title = mode === 'create' ? 'Add Supplier' : 'Edit Supplier'
  const description = mode === 'create' ? 'Create a new supplier record' : 'Update supplier details'
  const backHref = mode === 'create' ? '/suppliers' : `/suppliers/${supplierId}`

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link href={backHref}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {mode === 'create' ? 'Back to Suppliers' : 'Back to Supplier'}
            </Button>
          </Link>
        }
      />

      {error && <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Supplier Name *</label>
                  <Input name="name" value={formData.name} onChange={handleChange} placeholder="Enter supplier name" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contact Name</label>
                  <Input name="contact_name" value={formData.contact_name} onChange={handleChange} placeholder="Contact person" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="supplier@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                    <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="+27 00 000 0000" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tax Number</label>
                    <Input name="tax_number" value={formData.tax_number} onChange={handleChange} placeholder="VAT123456" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
                    <Input name="website" value={formData.website} onChange={handleChange} placeholder="https://example.com" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Address Line 1</label>
                  <Input name="address_line1" value={formData.address_line1} onChange={handleChange} placeholder="123 Main Street" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Address Line 2</label>
                  <Input name="address_line2" value={formData.address_line2} onChange={handleChange} placeholder="Suite 100" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                    <Input name="city" value={formData.city} onChange={handleChange} placeholder="Cape Town" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                    <Input name="state" value={formData.state} onChange={handleChange} placeholder="WC" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Postal Code</label>
                    <Input name="postal_code" value={formData.postal_code} onChange={handleChange} placeholder="8001" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                    <Input name="country" value={formData.country} onChange={handleChange} placeholder="South Africa" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Internal notes about this supplier"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tags (comma-separated)</label>
                <Input name="tags" value={formData.tags} onChange={handleChange} placeholder="wholesale, preferred" />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" variant="gradient" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving...' : mode === 'create' ? 'Save Supplier' : 'Update Supplier'}
              </Button>
              <Link href={backHref}>
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
