'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Card } from './card'

interface BenefitProps {
  text: string
  checked: boolean
}

function Benefit({ text, checked }: BenefitProps) {
  return (
    <div className="flex items-center gap-3">
      {checked ? (
        <span className="grid size-4 place-content-center rounded-full bg-purple-600 text-sm text-white">
          <Check className="size-3" />
        </span>
      ) : (
        <span className="grid size-4 place-content-center rounded-full bg-slate-800 text-sm text-gray-500">
          <X className="size-3" />
        </span>
      )}
      <span className="text-sm text-gray-300">{text}</span>
    </div>
  )
}

interface PricingCardProps {
  tier: string
  price: string
  bestFor: string
  CTA: string
  benefits: Array<{ text: string; checked: boolean }>
  className?: string
  featured?: boolean
  onCTAClick: () => void
}

export function PricingCard({
  tier,
  price,
  bestFor,
  CTA,
  benefits,
  className,
  featured = false,
  onCTAClick,
}: PricingCardProps) {
  return (
    <motion.div
      initial={{ filter: 'blur(2px)' }}
      whileInView={{ filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: 'easeInOut', delay: 0.25 }}
    >
      <Card
        className={cn(
          'relative h-full w-full overflow-hidden border p-6',
          featured
            ? 'border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20 shadow-xl shadow-purple-500/20'
            : 'border-slate-700/50 bg-slate-900',
          className
        )}
      >
        {featured && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-medium text-white rounded-b-md">
              Most Popular
            </div>
          </div>
        )}
        <div className="flex flex-col items-center border-b pb-6 border-slate-700">
          <span className="mb-6 inline-block text-gray-100 font-medium">{tier}</span>
          <span className="mb-3 inline-block text-4xl font-bold text-gray-100">{price}</span>
          <span className="bg-gradient-to-br from-gray-300 to-gray-500 bg-clip-text text-center text-transparent">
            {bestFor}
          </span>
        </div>
        <div className="space-y-4 py-9">
          {benefits.map((benefit, index) => (
            <Benefit key={index} {...benefit} />
          ))}
        </div>
        <Button className="w-full" variant={featured ? 'gradient' : 'secondary'} onClick={onCTAClick}>
          {CTA}
        </Button>
      </Card>
    </motion.div>
  )
}
