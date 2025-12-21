import { Suspense } from 'react'

import { AuthErrorPage } from '@/components/auth'

export default function AuthErrorRoutePage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorPage />
    </Suspense>
  )
}
