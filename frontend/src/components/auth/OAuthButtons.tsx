'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'

interface OAuthButtonsProps {
  onSuccess?: () => void
}

export function OAuthButtons({ onSuccess }: OAuthButtonsProps) {
  const router = useRouter()
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const googleClientRef = useRef<{ requestCode: () => void } | null>(null)
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    script.onerror = () => {
      setError('Google sign-in is unavailable right now (failed to load Google script).')
      setGoogleReady(false)
    }

    script.onload = () => {
      const initGoogle = async () => {
        let clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

        // Debug logging for production troubleshooting
        if (process.env.NODE_ENV === 'development' || !clientId) {
          console.log('[OAuth] Build-time NEXT_PUBLIC_GOOGLE_CLIENT_ID:', clientId ? 'present' : 'missing')
        }

        // Fallback: fetch client_id from backend if it wasn't embedded at build time
        // (common when Docker build-time env isn't injected in production builds).
        if (!clientId) {
          try {
            console.log('[OAuth] Fetching client_id from backend...')
            const resp = await apiClient.get('/oauth/google/url')
            clientId = resp.data?.client_id
            console.log('[OAuth] Backend client_id:', clientId ? 'received' : 'missing')
          } catch (err) {
            console.error('[OAuth] Failed to fetch client_id from backend:', err)
          }
        }

        if (!window.google) {
          console.error('[OAuth] Google Identity Services not loaded')
          setError('Google sign-in script failed to load. Please refresh the page.')
          setGoogleReady(false)
          return
        }

        if (!clientId) {
          console.error('[OAuth] No Google client_id available')
          setError('Google sign-in is not configured. Please contact support.')
          setGoogleReady(false)
          return
        }

        try {
          googleClientRef.current = window.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: 'email profile openid',
            ux_mode: 'popup',
            callback: async (response: { code?: string; error?: string; error_description?: string }) => {
              console.log('[OAuth] Google callback received:', response.error || 'code present')
              if (response.error) {
                const errorMsg = response.error === 'access_denied' 
                  ? 'Google sign-in was cancelled.'
                  : `Google sign-in error: ${response.error_description || response.error}`
                setError(errorMsg)
                setLoading(false)
                return
              }
              if (response.code) {
                setLoading(true)
                setError(null)
                try {
                  await loginWithGoogle(response.code)
                  onSuccess?.()
                  router.push('/dashboard')
                } catch (err) {
                  console.error('[OAuth] Backend login failed:', err)
                  setError('Google sign-in failed. Please try again.')
                } finally {
                  setLoading(false)
                }
              }
            },
          })
          console.log('[OAuth] Google client initialized successfully')
          setGoogleReady(true)
        } catch (err) {
          console.error('[OAuth] Failed to initialize Google client:', err)
          setError('Failed to initialize Google sign-in. Please refresh.')
          setGoogleReady(false)
        }
      }

      void initGoogle()
    }

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogle = () => {
    if (!googleClientRef.current || !googleReady) return
    setLoading(true)
    setError(null)
    googleClientRef.current.requestCode()
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">{error}</div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading || !googleReady}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Connecting to Google…' : 'Continue with Google'}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-950 text-gray-500">or</span>
        </div>
      </div>
    </div>
  )
}

export default OAuthButtons
