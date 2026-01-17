'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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
        <motion.h1 
          className="max-w-4xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Complete POS & ERP System for Modern Businesses
        </motion.h1>
        
        <motion.p 
          className="my-6 max-w-3xl text-center text-base leading-relaxed md:text-lg md:leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          From point-of-sale to inventory management, accounting integration to customer loyalty, staff scheduling to multi-location management. Everything you need to run, manage, and scale your business efficiently—all in one powerful, integrated platform.
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
