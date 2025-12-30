'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/common/Logo'
import { useAuth } from '@/hooks/useAuth'
import { AuthTabs, type AuthMode } from './AuthTabs'
import { EmailAuthForm } from './EmailAuthForm'
import { OAuthButtons } from './OAuthButtons'

export function AuthForm() {
  const router = useRouter()
  const { isAuthenticated, isInitialized, isLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('signin')

  useEffect(() => {
    if (isInitialized && !isLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, isInitialized, isLoading, router])

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center text-gray-300">Checking authentication…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex justify-center">
            <Logo width={48} height={48} />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-100">
            {mode === 'signup'
              ? 'Create your account'
              : mode === 'reset'
                ? 'Reset your password'
                : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-sm text-gray-400">Welcome to BizPilot</p>
        </div>

        <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-8">
          <AuthTabs mode={mode} onModeChange={setMode} />

          {mode !== 'reset' && (
            <>
              <OAuthButtons onSuccess={() => router.push('/dashboard')} />
              <div className="mt-6">
                <EmailAuthForm mode={mode} onModeChange={setMode} onSuccess={() => router.push('/dashboard')} />
              </div>
            </>
          )}

          {mode === 'reset' && <EmailAuthForm mode={mode} onModeChange={setMode} />}

          <div className="mt-6 text-center text-sm">
            {mode === 'signin' && (
              <p className="text-gray-400">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Sign up here
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-gray-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Sign in here
                </button>
              </p>
            )}
            <p className="mt-4">
              <Link href={isAuthenticated ? '/dashboard' : '/'} className="text-gray-500 hover:text-gray-400">
                Back
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default AuthForm
