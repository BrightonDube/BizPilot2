'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginWithGoogle } = useAuth()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Completing authentication…')

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    const run = async () => {
      if (error) {
        setStatus('error')
        setMessage(errorDescription || error)
        return
      }

      if (!code) {
        setStatus('error')
        setMessage('Missing authorization code.')
        return
      }

      try {
        await loginWithGoogle(code)
        setStatus('success')
        setMessage('Authentication successful! Redirecting…')
        router.push('/dashboard')
      } catch {
        setStatus('error')
        setMessage('Authentication failed. Please try again.')
      }
    }

    run()
  }, [loginWithGoogle, router, searchParams])

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-gray-950 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-md w-full text-center">
        <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-8">
          {status === 'success' ? (
            <CheckCircle className="h-8 w-8 mx-auto text-green-400 mb-4" />
          ) : status === 'error' ? (
            <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-4" />
          ) : (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
            />
          )}

          <p className="text-gray-200">{message}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default AuthCallback
