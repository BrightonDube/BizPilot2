'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import type { AuthMode } from './AuthTabs'

interface EmailAuthFormProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSuccess?: () => void
}

export function EmailAuthForm({ mode, onModeChange, onSuccess }: EmailAuthFormProps) {
  const router = useRouter()
  const { login, register, forgotPassword, isLoading, error, clearError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [show2FA, setShow2FA] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const validate = () => {
    setLocalError(null)

    if (!email.trim()) {
      setLocalError('Email is required')
      return false
    }

    if (mode !== 'reset' && !password) {
      setLocalError('Password is required')
      return false
    }

    if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setLocalError('First name and last name are required')
        return false
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setSuccessMessage(null)

    if (!validate()) return

    try {
      if (mode === 'signin') {
        try {
          await login(email, password, show2FA ? twoFactorCode : undefined)
          onSuccess?.()
          router.push('/dashboard')
        } catch (err: unknown) {
          if (
            typeof err === 'object' && 
            err !== null && 
            'response' in err && 
            (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === '2FA_REQUIRED'
          ) {
            setShow2FA(true)
            setLocalError('Please enter your 2FA code')
          } else {
            throw err
          }
        }
        return
      }

      if (mode === 'signup') {
        await register({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        })
        onModeChange('signin')
        setSuccessMessage('Account created. Please sign in.')
        return
      }

      if (mode === 'reset') {
        await forgotPassword(email)
        setSuccessMessage('If an account exists, a reset link has been sent.')
        return
      }
    } catch {
      // store handles error
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || localError) && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error || localError}
          <button
            type="button"
            onClick={() => {
              clearError()
              setLocalError(null)
            }}
            className="float-right text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {mode === 'signup' && (
        <div className="grid grid-cols-2 gap-3">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            disabled={isLoading}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            disabled={isLoading}
          />
        </div>
      )}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        disabled={isLoading || show2FA}
      />

      {mode !== 'reset' && (
        <>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            disabled={isLoading || show2FA}
          />
          {show2FA && (
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="2FA Code"
              className="w-full px-3 py-2 bg-blue-900/20 border border-blue-500/50 rounded-lg text-white"
              disabled={isLoading}
              autoFocus
            />
          )}
          {mode === 'signup' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              disabled={isLoading}
            />
          )}
        </>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
      >
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>

      {mode === 'signin' && (
        <button
          type="button"
          onClick={() => onModeChange('reset')}
          className="w-full text-sm text-blue-400 hover:text-blue-300"
        >
          Forgot password?
        </button>
      )}
    </form>
  )
}

export default EmailAuthForm
