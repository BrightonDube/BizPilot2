'use client'

import { useCallback, useMemo, useState } from 'react'

export interface LanguageConfig {
  code: string
  name: string
  nativeName: string
  flag?: string
}

const LANGUAGES: LanguageConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', flag: '🇿🇦' },
  { code: 'st', name: 'Sotho', nativeName: 'Sesotho', flag: '🇿🇦' },
  { code: 'nso', name: 'Northern Sotho', nativeName: 'Sepedi', flag: '🇿🇦' },
  { code: 'tn', name: 'Tswana', nativeName: 'Setswana', flag: '🇿🇦' },
  { code: 'ts', name: 'Tsonga', nativeName: 'Xitsonga', flag: '🇿🇦' },
  { code: 'ss', name: 'Swati', nativeName: 'siSwati', flag: '🇿🇦' },
  { code: 'nr', name: 'Ndebele', nativeName: 'isiNdebele', flag: '🇿🇦' },
  { code: 've', name: 'Venda', nativeName: 'Tshivenḓa', flag: '🇿🇦' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
]

export function getAvailableLanguages() {
  return LANGUAGES
}

export function getLanguageConfig(code: string | null | undefined) {
  const normalized = (code || 'en').toLowerCase()
  return LANGUAGES.find((l) => l.code === normalized) || LANGUAGES[0]
}

export function useLanguage() {
  const [language, setLanguageState] = useState<string>(() => {
    return 'en'
  })

  const setLanguage = useCallback((languageCode: string) => {
    const normalized = languageCode.toLowerCase()
    setLanguageState(normalized)
  }, [])

  const availableLanguages = useMemo(() => getAvailableLanguages(), [])
  const config = useMemo(() => getLanguageConfig(language), [language])

  return {
    language,
    config,
    setLanguage,
    availableLanguages,
  }
}

export default useLanguage
