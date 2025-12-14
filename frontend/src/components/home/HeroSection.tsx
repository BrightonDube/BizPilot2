'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function HeroSection() {
  return (
    <motion.section
      className="relative grid min-h-screen place-content-center overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 px-4 py-24 text-gray-200"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.1),transparent_50%)]" />
      
      <div className="relative z-10 flex flex-col items-center">
        <motion.h1 
          className="max-w-3xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Smart Business Management for Small Businesses
        </motion.h1>
        
        <motion.p 
          className="my-6 max-w-xl text-center text-base leading-relaxed md:text-lg md:leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Calculate costs, optimize pricing, track inventory, and get AI insights 
          to grow your business profitably. All in one intelligent platform.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link 
            href="/auth/login" 
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 font-medium text-white transition-all hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/50 group"
          >
            Start free trial
            <ArrowRight className="h-5 w-5 transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  )
}
