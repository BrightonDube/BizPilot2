'use client'

import { useParams } from 'next/navigation'
import { SupplierForm } from '@/components/suppliers/SupplierForm'

export default function EditSupplierPage() {
  const params = useParams()
  const supplierId = params.id as string

  return <SupplierForm mode="edit" supplierId={supplierId} />
}
