'use client';

/**
 * Login page component with BizPilot styling.
 */

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useGuestOnly } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already authenticated
  useGuestOnly();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/dashboard');
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
      <h2 className=\"text-2xl font-semibold text-white mb-2\">Welcome back</h2>
      <p className=\"text-gray-400 mb-6\">Sign in to access your dashboard</p>
      
      {error && (
        <motion.div 
          className=\"bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-4\"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {error}
          <button onClick={clearError} className=\"float-right text-red-400 hover:text-red-300\">
            &times;
          </button>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className=\"space-y-4\">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <label htmlFor=\"email\" className=\"block text-sm font-medium text-gray-300 mb-1\">
            Email address
          </label>
          <div className=\"relative\">
            <Mail className=\"absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400\" />
            <input
              id=\"email\"
              type=\"email\"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className=\"w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all\"
              placeholder=\"you@example.com\"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <label htmlFor=\"password\" className=\"block text-sm font-medium text-gray-300 mb-1\">
            Password
          </label>
          <div className=\"relative\">
            <Lock className=\"absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400\" />
            <input
              id=\"password\"
              type=\"password\"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className=\"w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all\"
              placeholder=\"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\"
            />
          </div>
        </motion.div>

        <motion.div 
          className=\"flex items-center justify-between\"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <label className=\"flex items-center text-sm text-gray-400 hover:text-gray-300 cursor-pointer\">
            <input type=\"checkbox\" className=\"mr-2 rounded bg-slate-800 border-slate-600\" />
            Remember me
          </label>
          <Link href=\"/auth/forgot-password\" className=\"text-sm text-purple-400 hover:text-purple-300 transition-colors\">
            Forgot password?
          </Link>
        </motion.div>

        <motion.button
          type=\"submit\"
          disabled={isLoading}
          className=\"w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 flex items-center justify-center gap-2\"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {isLoading ? (\n            <>\n              <motion.div\n                animate={{ rotate: 360 }}\n                transition={{ duration: 1, repeat: Infinity, ease: \"linear\" }}\n                className=\"h-5 w-5 border-2 border-white border-t-transparent rounded-full\"\n              />\n              Signing in...\n            </>\n          ) : (\n            <>\n              <LogIn className=\"h-5 w-5\" />\n              Sign in\n            </>\n          )}\n        </motion.button>
      </form>

      <motion.div 
        className=\"mt-6\"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className=\"relative\">
          <div className=\"absolute inset-0 flex items-center\">
            <div className=\"w-full border-t border-slate-700\"></div>
          </div>
          <div className=\"relative flex justify-center text-sm\">
            <span className=\"px-2 bg-slate-900/80 text-gray-400\">Or continue with</span>
          </div>
        </div>

        <motion.button
          type=\"button\"
          className=\"mt-4 w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg\"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <svg className=\"w-5 h-5\" viewBox=\"0 0 24 24\">
            <path
              fill=\"currentColor\"
              d=\"M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z\"
            />
            <path
              fill=\"currentColor\"
              d=\"M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z\"
            />
            <path
              fill=\"currentColor\"
              d=\"M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z\"
            />
            <path
              fill=\"currentColor\"
              d=\"M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z\"
            />
          </svg>
          Sign in with Google
        </motion.button>
      </motion.div>

      <motion.p 
        className=\"mt-6 text-center text-gray-400\"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        Don&apos;t have an account?{' '}
        <Link href=\"/auth/register\" className=\"text-purple-400 hover:text-purple-300 transition-colors font-medium\">
          Sign up
        </Link>
      </motion.p>
    </motion.div>
  );
}
          </div>
        </div>

        <button
          type="button"
          className="mt-4 w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>

      <p className="mt-6 text-center text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-blue-400 hover:text-blue-300">
          Sign up
        </Link>
      </p>
    </div>
  );
}
