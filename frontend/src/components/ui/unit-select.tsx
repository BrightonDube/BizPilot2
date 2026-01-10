'use client'

interface UnitSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  required?: boolean
  className?: string
}

export const UNIT_OPTIONS = [
  'unit',
  'piece',
  'kg',
  'g',
  'lb',
  'oz',
  'l',
  'ml',
  'gal',
  'pack',
  'box',
  'bag',
]

export function UnitSelect({
  value,
  onChange,
  disabled = false,
  id = 'unit-select',
  required = false,
  className,
}: UnitSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={
        className ??
        'flex h-10 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all'
      }
    >
      <option value="" disabled>
        Select unit
      </option>
      {UNIT_OPTIONS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  )
}
