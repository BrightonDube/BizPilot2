'use client'

interface LogoProps {
  width?: number
  height?: number
  className?: string
}

export function Logo({ width = 32, height = 32, className = '' }: LogoProps) {
  const gradientId = 'bizpilot-logo-gradient'

  return (
    <svg 
      data-testid="svg"
      width={width} 
      height={height} 
      viewBox="0 0 80 80" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="60" height="60" rx="15" fill={`url(#${gradientId})`}/>
      <path d="M25 35 L40 25 L55 35 L50 45 L40 40 L30 45 Z" fill="white"/>
      <circle cx="40" cy="40" r="5" fill="white"/>
      <rect x="20" y="50" width="8" height="15" rx="2" fill="white" opacity="0.9"/>
      <rect x="30" y="45" width="8" height="20" rx="2" fill="white" opacity="0.9"/>
      <rect x="40" y="48" width="8" height="17" rx="2" fill="white" opacity="0.9"/>
      <rect x="50" y="52" width="8" height="13" rx="2" fill="white" opacity="0.9"/>
    </svg>
  )
}
