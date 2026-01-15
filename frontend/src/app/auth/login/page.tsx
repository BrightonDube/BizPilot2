'use client';

/**
 * Login page component with BizPilot styling.
 */

import { Suspense, useState, useMemo, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useGuestOnly } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, Clock, Loader2 } from 'lucide-react';
import OAuthButtons from '@/components/auth/OAuthButtons';

/**
 * Loading fallback for Suspense boundary
 */
function LoginPageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
    </div>
  );
}

/**
 * Main login form component that uses useSearchParams
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [messageDismissed, setMessageDismissed] = useState(false);

  // Derive session expired message from URL params
  const sessionExpiredMessage = useMemo(() => {
    if (messageDismissed) return null;
    if (searchParams.get('session_expired') === 'true') {
      return 'Your session has expired. Please log in again.';
    }
    return null;
  }, [searchParams, messageDismissed]);

  // Redirect if already authenticated
  useGuestOnly();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Clear session expired message on new login attempt
    setMessageDismissed(true);
    try {
      await login(email, password);
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') ? next : '/dashboard';
      router.push(target);
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-semibold text-white mb-2">Welcome back</h2>
      <p className="text-gray-400 mb-6">Sign in to access your dashboard</p>
      
      {sessionExpiredMessage && (
        <motion.div 
          className="bg-amber-900/20 border border-amber-500/50 text-amber-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Clock className="h-5 w-5 flex-shrink-0" />
          <span>{sessionExpiredMessage}</span>
          <button 
            onClick={() => setMessageDismissed(true)} 
            className="ml-auto text-amber-400 hover:text-amber-300"
          >
            &times;
          </button>
        </motion.div>
      )}

      {error && (
        <motion.div 
          className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {error}
          <button onClick={() => { clearError(); }} className="float-right text-red-400 hover:text-red-300">
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
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
        </motion.div>

        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <label className="flex items-center text-sm text-gray-400 hover:text-gray-300 cursor-pointer">
            <input type="checkbox" className="mr-2 rounded bg-slate-800 border-slate-600" />
            Remember me
          </label>
          <Link href="/auth/forgot-password" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
            Forgot password?
          </Link>
        </motion.div>

        <motion.button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
              />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="h-5 w-5" />
              Sign in
            </>
          )}
        </motion.button>
      </form>

      <motion.div 
        className="mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-900/80 text-gray-400">Or continue with</span>
          </div>
        </div>

        <OAuthButtons onSuccess={() => router.push('/dashboard')} />
      </motion.div>

      <motion.div 
        className="text-center mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.55 }}
      >
        <p className="text-gray-400 text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-purple-400 hover:text-purple-300">
            Sign up
          </Link>
        </p>
        <p className="text-gray-500 text-xs mt-2">
          <Link href="/auth/error" className="hover:text-gray-300">
            Having trouble signing in?
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}

/**
 * Login page wrapper with Suspense boundary for useSearchParams
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginForm />
    </Suspense>
  );
}
