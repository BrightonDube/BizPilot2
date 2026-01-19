'use client'

import { type FormEvent, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api'

type ContactTopic = 'sales' | 'support' | 'general'

type ContactSalesFormProps = {
  topic?: string
  tier?: string
}

export function ContactSalesForm({ topic: topicProp, tier: tierProp }: ContactSalesFormProps) {
  const topic = ((topicProp || 'general') as ContactTopic)
  const tier = tierProp || ''

  const defaultSubject = useMemo(() => {
    if (topic === 'sales') return 'Contact Sales'
    if (topic === 'support') return 'Support Request'
    return 'Contact'
  }, [topic])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSuccess(null)
    setError(null)

    try {
      await apiClient.post('/contact', {
        name,
        email,
        subject,
        message,
        topic,
        tier,
      })

      setSuccess('Thanks — we received your message and will get back to you shortly.')
      setName('')
      setEmail('')
      setSubject(defaultSubject)
      setMessage('')
    } catch (err) {
      console.error('Failed to submit contact form:', err)
      setError('Something went wrong sending your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-white">
            {topic === 'sales' ? 'Contact Sales' : topic === 'support' ? 'Contact Support' : 'Contact Us'}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Tell us what you need and we’ll respond via email.
          </p>
        </div>

        {success ? (
          <div className="rounded-lg border border-green-500/30 bg-green-900/10 p-4 text-green-200">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-900/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-gray-100 outline-none focus:border-purple-500/60"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-gray-100 outline-none focus:border-purple-500/60"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-gray-100 outline-none focus:border-purple-500/60"
              placeholder="What is this about?"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-gray-100 outline-none focus:border-purple-500/60"
              placeholder="How can we help?"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 font-medium text-white transition-all hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send message'}
          </button>

          {tier ? (
            <p className="text-xs text-gray-500">Context: tier={tier}</p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
