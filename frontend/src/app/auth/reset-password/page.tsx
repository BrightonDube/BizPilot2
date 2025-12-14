'use client';

/**
 * Reset password page component with BizPilot styling.
 */

import { Suspense } from 'react';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, XCircle, KeyRound } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { resetPassword, isLoading, error, clearError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      await resetPassword(token, password);
      setSubmitted(true);
    } catch {
      // Error is handled by the store
    }
  };

  if (!token) {
    return (
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
        >
          <XCircle className="w-8 h-8 text-red-400" />
        </motion.div>
        <h2 className="text-2xl font-semibold text-white mb-2">Invalid reset link</h2>
        <p className="text-gray-400 mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link 
          href="/auth/forgot-password" 
          className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors font-medium"
        >
          Request a new reset link
        </Link>
      </motion.div>
    );
  }

  if (submitted) {
    return (
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
        >
          <CheckCircle className="w-8 h-8 text-green-400" />
        </motion.div>
        <h2 className="text-2xl font-semibold text-white mb-2">Password reset successful</h2>
        <p className="text-gray-400 mb-6">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link 
            href="/auth/login" 
            className="inline-block py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-purple-500/50"
          >
            Sign in
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-semibold text-white mb-2">Reset your password</h2>
      <p className="text-gray-400 mb-6">
        Enter your new password below.
      </p>
      
      {(error || passwordError) && (
        <motion.div 
          className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {error || passwordError}
          <button 
            onClick={() => { clearError(); setPasswordError(''); }} 
            className="float-right text-red-400 hover:text-red-300"
          >
            &times;
          </button>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
              required
              minLength={8}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
            Confirm new password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
              required
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
        </motion.div>

        <motion.button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
              />
              Resetting...
            </>
          ) : (
            <>
              <KeyRound className="h-5 w-5" />
              Reset password
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
