'use client'

/**
 * Auth layout with BizPilot branding and dark theme.
 */

import { ReactNode } from 'react';
import { Logo } from '@/components/common/Logo';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.1),transparent_50%)]" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link href="/" className="inline-flex items-center justify-center gap-3 mb-4">
            <Logo width={48} height={48} />
            <span className="text-3xl font-bold text-white">BizPilot</span>
          </Link>
          <p className="text-gray-300 mt-2">Smart Business Management Platform</p>
        </motion.div>
        
        {/* Auth Card */}
        <motion.div 
          className="bg-slate-900/80 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-slate-700"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {children}
        </motion.div>
        
        {/* Footer */}
        <motion.p 
          className="text-center text-gray-400 text-sm mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          &copy; {new Date().getFullYear()} BizPilot. Built with ❤️ for small businesses.
        </motion.p>
      </div>
    </div>
  );
}
