'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles, Building2, BarChart3 } from 'lucide-react'
import { motion, animate, useMotionTemplate, useMotionValue } from 'framer-motion'
import { AI_MESSAGING } from '@/lib/ai-messaging-config'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'

const HeroStarsBackground = dynamic(() => import('./HeroStarsBackground'), { ssr: false })

const COLORS_TOP = ['#13FFAA', '#1E67C6', '#CE84CF', '#DD335C']

export function HeroSection() {

  const color = useMotionValue(COLORS_TOP[0])

  useEffect(() => {
    const controls = animate(color, COLORS_TOP, {
      ease: 'easeInOut',
      duration: 10,
      repeat: Infinity,
      repeatType: 'mirror',
    })
    return () => {
      controls.stop()
    }
  }, [color])

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`
  const border = useMotionTemplate`1px solid ${color}`
  const boxShadow = useMotionTemplate`0px 4px 24px ${color}`

  return (
    <motion.section
      style={{ backgroundImage }}
      className="relative grid min-h-screen place-content-center overflow-hidden bg-gray-950 px-4 py-24 text-gray-200"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      
      <div className="relative z-10 flex flex-col items-center">
        {/* Balanced Business Management Badge */}
        <motion.div
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 px-4 py-2 text-sm font-medium text-blue-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Building2 className="h-4 w-4" />
          Complete Business Management Platform
          <Sparkles className="h-3 w-3 text-purple-400" />
        </motion.div>

        <motion.h1 
          className="max-w-4xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {AI_MESSAGING.heroTagline}
        </motion.h1>
        
        <motion.p 
          className="my-6 max-w-3xl text-center text-base leading-relaxed md:text-lg md:leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {AI_MESSAGING.subTagline}. From POS systems to inventory management, financial reporting to customer insights—everything you need to run, optimize, and scale your business with intelligent automation that enhances your expertise.
        </motion.p>

        {/* Balanced Value Highlights - Mix of core business and smart features */}
        <motion.div
          className="mb-8 flex flex-wrap justify-center gap-4 text-sm text-gray-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Complete POS & inventory system</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Smart automation & insights</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Multi-location management</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>You stay in control</span>
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
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 font-medium text-white transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:shadow-blue-500/50 group"
          >
            Start Your Free Trial
            <ArrowRight className="h-5 w-5 transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </Link>
          
          <motion.div
            style={{ border, boxShadow }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            className="rounded-lg"
          >
            <Link 
              href="/features" 
              className="inline-flex items-center gap-2 rounded-lg bg-gray-950/10 px-8 py-4 font-medium text-gray-200 transition-all hover:bg-gray-950/50"
            >
              <BarChart3 className="h-4 w-4" />
              Explore All Features
            </Link>
          </motion.div>
        </motion.div>

        {/* Balanced Trust Indicator - Business focus with smart features */}
        <motion.p
          className="mt-6 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          🏢 Complete business solution • 🤖 Smart automation included • 🔒 Your data stays private • ⚡ Setup in minutes
        </motion.p>
      </div>

      <HeroStarsBackground />
    </motion.section>
  )
}
