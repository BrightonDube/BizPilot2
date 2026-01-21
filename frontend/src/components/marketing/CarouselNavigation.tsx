'use client'

import { ArrowRight } from 'lucide-react'

interface CarouselNavigationProps {
  carouselId: string
  direction: 'prev' | 'next'
}

export function CarouselNavigation({ carouselId, direction }: CarouselNavigationProps) {
  const handleClick = () => {
    const container = document.getElementById(carouselId)
    if (container) {
      const scrollAmount = direction === 'prev' ? -320 : 320
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const isPrev = direction === 'prev'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`absolute ${isPrev ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 z-10 bg-slate-800/90 hover:bg-slate-700 text-white p-3 rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950`}
      aria-label={`${isPrev ? 'Previous' : 'Next'} feature`}
    >
      <ArrowRight className={`h-6 w-6 ${isPrev ? 'rotate-180' : ''}`} />
    </button>
  )
}
