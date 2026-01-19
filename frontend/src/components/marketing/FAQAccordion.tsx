'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQ {
  question: string
  answer: string
}

interface FAQAccordionProps {
  faqs: FAQ[]
  categoryIndex: number
}

export function FAQAccordion({ faqs, categoryIndex }: FAQAccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (id: string) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="space-y-4">
      {faqs.map((faq, faqIndex) => {
        const itemId = `${categoryIndex}-${faqIndex}`
        const isOpen = openItems.includes(itemId)
        
        return (
          <div 
            key={faqIndex}
            className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all animate-slide-up"
            style={{ animationDelay: `${faqIndex * 0.05}s` }}
          >
            <button
              onClick={() => toggleItem(itemId)}
              className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              aria-expanded={isOpen}
              aria-controls={`faq-content-${itemId}`}
            >
              <h3 className="text-lg font-semibold text-white pr-4">
                {faq.question}
              </h3>
              <div
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              >
                <ChevronDown className="h-5 w-5 text-purple-400 flex-shrink-0" />
              </div>
            </button>
            
            <div
              id={`faq-content-${itemId}`}
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="px-6 pb-4">
                <p className="text-gray-300 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}