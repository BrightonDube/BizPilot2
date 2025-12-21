'use client'

import React from 'react'
import { Globe } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface LanguageSelectorProps {
  className?: string
  showLabel?: boolean
  variant?: 'dropdown' | 'inline'
  onChange?: (languageCode: string) => void
  value?: string
}

export function LanguageSelector({
  className = '',
  showLabel = true,
  variant = 'dropdown',
  onChange,
  value,
}: LanguageSelectorProps) {
  const languageState = useLanguage()
  const language = value || languageState.language
  const availableLanguages = languageState.availableLanguages
  const [isOpen, setIsOpen] = React.useState(false)

  const currentLanguage =
    availableLanguages.find((lang) => lang.code === language) || languageState.config

  const handleLanguageChange = (languageCode: string) => {
    if (!value) {
      languageState.setLanguage(languageCode)
    }
    onChange?.(languageCode)
    setIsOpen(false)
  }

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {availableLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              language === lang.code
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 border border-gray-700'
            }`}
            title={lang.name}
            type="button"
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.nativeName}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 hover:bg-gray-700/60 rounded-lg transition-all text-gray-200 border border-gray-700"
        aria-label="Select language"
        type="button"
      >
        <Globe size={18} />
        {showLabel && (
          <>
            <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
            <span className="sm:hidden">{currentLanguage.flag}</span>
          </>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-lg shadow-xl border border-gray-700 z-20 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Select Language
              </div>

              <div className="mb-2">
                <div className="px-3 py-1 text-xs text-gray-500">Popular</div>
                {availableLanguages.slice(0, 3).map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                      language === lang.code
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                    type="button"
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.nativeName}
                    {lang.name !== lang.nativeName && (
                      <span className="text-xs text-gray-500 ml-2">({lang.name})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mb-2">
                <div className="px-3 py-1 text-xs text-gray-500">South African Languages</div>
                {availableLanguages
                  .filter((l) => l.flag === '🇿🇦')
                  .map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        language === lang.code
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      type="button"
                    >
                      <span className="mr-2">{lang.flag}</span>
                      {lang.nativeName}
                      {lang.name !== lang.nativeName && (
                        <span className="text-xs text-gray-500 ml-2">({lang.name})</span>
                      )}
                    </button>
                  ))}
              </div>

              <div>
                <div className="px-3 py-1 text-xs text-gray-500">Other Languages</div>
                {availableLanguages
                  .filter((l) => l.flag !== '🇿🇦' && l.code !== 'en')
                  .map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        language === lang.code
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      type="button"
                    >
                      <span className="mr-2">{lang.flag}</span>
                      {lang.nativeName}
                      {lang.name !== lang.nativeName && (
                        <span className="text-xs text-gray-500 ml-2">({lang.name})</span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default LanguageSelector
