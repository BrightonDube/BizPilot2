'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export function AuthInitializer() {
  const fetchUser = useAuthStore((s) => s.fetchUser)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  useEffect(() => {
    const oauthLoadingTime = window.localStorage.getItem('oauth_loading_time')
    if (oauthLoadingTime) {
      const timeDiff = Date.now() - Number(oauthLoadingTime)
      if (Number.isFinite(timeDiff) && timeDiff > 30000) {
        window.localStorage.removeItem('oauth_loading_time')
      }
    }

    if (!isInitialized) {
      fetchUser()
    }
  }, [fetchUser, isInitialized])

  return null
}

export default AuthInitializer
