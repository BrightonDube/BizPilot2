/**
 * Modifier availability rule editor.
 *
 * Manages time-based, day-based, date-range, and location-specific
 * availability rules for a single modifier.  Also provides quick
 * 86 (out-of-stock) and un-86 toggle buttons.
 *
 * Why a visual schedule instead of just a raw rule list?
 * Restaurant staff need to quickly see when an item is available
 * at a glance.  The day-of-week grid provides that visual.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertOctagon,
  CheckCircle,
} from 'lucide-react'

import { Badge, Button, Input } from '@/components/ui'
import {
  modifierApi,
  ModifierAvailability,
  CreateAvailabilityRulePayload,
} from '@/lib/modifier-api'

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

// ---------------------------------------------------------------------------
// Rule form
// ---------------------------------------------------------------------------

interface RuleFormProps {
  modifierId: string
  onSave: () => void
  onCancel: () => void
}

function RuleForm({ modifierId, onSave, onCancel }: RuleFormProps) {
  const [dayOfWeek, setDayOfWeek] = useState<number | ''>('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload: CreateAvailabilityRulePayload = {
        modifier_id: modifierId,
        day_of_week: dayOfWeek === '' ? null : dayOfWeek,
        start_time: startTime || null,
        end_time: endTime || null,
        start_date: startDate || null,
        end_date: endDate || null,
        is_available: isAvailable,
      }
      await modifierApi.createAvailabilityRule(payload)
      onSave()
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Day of week */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Day of Week</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value === '' ? '' : parseInt(e.target.value))}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm"
          >
            <option value="">Any day</option>
            {DAYS_OF_WEEK.map((day, idx) => (
              <option key={idx} value={idx}>
                {day}
              </option>
            ))}
          </select>
        </div>

        {/* Time range */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Date range */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {/* Available toggle */}
        <div className="flex items-end pb-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rule-available"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="rounded bg-gray-800 border-gray-600"
            />
            <label htmlFor="rule-available" className="text-sm text-gray-300">
              {isAvailable ? 'Available' : 'Unavailable'}
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Add Rule
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ModifierAvailabilityEditorProps {
  modifierId: string
  modifierName: string
  onBack: () => void
}

export function ModifierAvailabilityEditor({
  modifierId,
  modifierName,
  onBack,
}: ModifierAvailabilityEditorProps) {
  const [rules, setRules] = useState<ModifierAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toggling86, setToggling86] = useState(false)

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await modifierApi.listAvailabilityRules(modifierId)
      setRules(data)
    } catch {
      setError('Failed to load availability rules')
    } finally {
      setLoading(false)
    }
  }, [modifierId])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleDeleteRule = async (ruleId: string) => {
    try {
      setDeletingId(ruleId)
      await modifierApi.deleteAvailabilityRule(ruleId)
      setRules(rules.filter((r) => r.id !== ruleId))
    } catch {
      setError('Failed to delete rule')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEightySix = async () => {
    setToggling86(true)
    try {
      await modifierApi.eightySixModifier(modifierId)
      await fetchRules()
    } catch {
      setError('Failed to 86 modifier')
    } finally {
      setToggling86(false)
    }
  }

  const handleUnEightySix = async () => {
    setToggling86(true)
    try {
      await modifierApi.unEightySixModifier(modifierId)
      await fetchRules()
    } catch {
      setError('Failed to un-86 modifier')
    } finally {
      setToggling86(false)
    }
  }

  // Check if currently 86'd (has a blanket unavailable rule with no filters)
  const is86d = rules.some(
    (r) =>
      !r.is_available &&
      r.day_of_week === null &&
      r.start_time === null &&
      r.end_time === null &&
      r.start_date === null &&
      r.end_date === null &&
      r.location_id === null,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Availability: {modifierName}</h1>
          <p className="text-gray-400 text-sm mt-1">
            Control when and where this modifier is available
          </p>
        </div>
        <div className="flex gap-2">
          {/* 86 / Un-86 buttons */}
          {is86d ? (
            <Button
              variant="outline"
              onClick={handleUnEightySix}
              disabled={toggling86}
            >
              {toggling86 ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Un-86 (Restore)
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleEightySix}
              disabled={toggling86}
            >
              {toggling86 ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <AlertOctagon className="h-4 w-4 mr-2" />
              )}
              86 (Out of Stock)
            </Button>
          )}
          <Button
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 86'd banner */}
      {is86d && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertOctagon className="h-6 w-6 text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 font-medium">This modifier is 86&apos;d</p>
            <p className="text-red-400 text-sm">
              It will not be shown to customers until restored.
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Availability Rule</h2>
          <RuleForm
            modifierId={modifierId}
            onSave={() => {
              setShowForm(false)
              fetchRules()
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Rules list */}
      {!loading && rules.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">
            No availability rules. This modifier is available at all times and locations.
          </p>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-4 text-left text-sm font-medium text-gray-400">Day</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Time Window</th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">Date Range</th>
                <th className="p-4 text-center text-sm font-medium text-gray-400">Status</th>
                <th className="p-4 text-right text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4 text-gray-300">
                    {rule.day_of_week !== null ? DAYS_OF_WEEK[rule.day_of_week] : 'Any'}
                  </td>
                  <td className="p-4 text-gray-300">
                    {rule.start_time && rule.end_time
                      ? `${rule.start_time} – ${rule.end_time}`
                      : rule.start_time
                      ? `From ${rule.start_time}`
                      : rule.end_time
                      ? `Until ${rule.end_time}`
                      : 'All day'}
                  </td>
                  <td className="p-4 text-gray-300">
                    {rule.start_date && rule.end_date
                      ? `${rule.start_date} to ${rule.end_date}`
                      : rule.start_date
                      ? `From ${rule.start_date}`
                      : rule.end_date
                      ? `Until ${rule.end_date}`
                      : '—'}
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant={rule.is_available ? 'success' : 'danger'}>
                      {rule.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      disabled={deletingId === rule.id}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete rule"
                    >
                      {deletingId === rule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
