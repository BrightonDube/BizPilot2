'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export function HeroSection() {

  return (
    <motion.section
      className="relative grid min-h-screen place-content-center overflow-hidden px-4 py-24 text-gray-200"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      
      <div className="relative z-10 flex flex-col items-center">
        {/* AI Badge */}
        <motion.div
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 px-4 py-2 text-sm font-medium text-purple-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Sparkles className="h-4 w-4" />
          AI-Powered Business Management
        </motion.div>

        <motion.h1 
          className="max-w-4xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Intelligent Business Management That Puts You in Control
        </motion.h1>
        
        <motion.p 
          className="my-6 max-w-3xl text-center text-base leading-relaxed md:text-lg md:leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Harness the power of AI-driven automation for inventory, sales, and customer management while maintaining complete control over your business decisions. From smart POS systems to predictive analytics—everything you need to run, optimize, and scale your business intelligently.
        </motion.p>

        {/* AI Value Highlights */}
        <motion.div
          className="mb-8 flex flex-wrap justify-center gap-4 text-sm text-gray-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Smart inventory predictions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>AI-powered insights</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>You stay in control</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Privacy protected</span>
          </div>
        </motion.div>
        
        <motion.div
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link 
            href="/auth/register" 
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 font-medium text-white transition-all hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/50 group"
          >
            Start Your AI-Powered Trial
            <ArrowRight className="h-5 w-5 transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </Link>
          
          <Link 
            href="/features" 
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-8 py-4 font-medium text-gray-200 transition-all hover:border-purple-500/50 hover:bg-slate-800/50"
          >
            Explore AI Features
          </Link>
        </motion.div>

        {/* Trust Indicator */}
        <motion.p
          className="mt-6 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          🔒 Your data stays private • 🎛️ You control the AI • ✨ No technical expertise required
        </motion.p>
      </div>
    </motion.section>
  )
}
