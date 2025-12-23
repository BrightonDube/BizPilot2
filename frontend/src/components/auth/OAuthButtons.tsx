'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'

interface OAuthButtonsProps {
  onSuccess?: () => void
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

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
        className="w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/30"
      >
        {loading ? (
          'Connecting to Google…'
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            <span>Continue with Google</span>
          </div>
        )}
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
