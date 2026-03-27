'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, Check, AlertTriangle, ExternalLink, Loader2, User, X } from 'lucide-react'
import type { AIMessage } from '@/hooks/useAIChat'

type Props = {
  message: AIMessage
  index: number
}

export function AIMessageRenderer({ message: m }: Props) {
  const isUser = m.is_user

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-600 to-pink-600'
        }`}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-900/50 border border-gray-700 text-gray-100'
        }`}
      >
        {/* Type badge */}
        {!isUser && m.type && m.type !== 'response' && (
          <TypeBadge type={m.type} toolName={m.tool_name} />
        )}

        {/* Content */}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic">{children}</em>
              ),
              code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
                if (className?.includes('language-')) {
                  return (
                    <pre className="bg-gray-950 rounded-md p-3 my-2 overflow-x-auto text-sm">
                      <code className="text-green-400 font-mono">{children}</code>
                    </pre>
                  )
                }
                return (
                  <code className="bg-gray-950 text-green-400 font-mono text-xs px-1.5 py-0.5 rounded">
                    {children}
                  </code>
                )
              },
              a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300 inline-flex items-center gap-0.5 transition-colors"
                  title={href}
                >
                  {children}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-0.5 my-2 pl-2 text-sm">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-0.5 my-2 pl-2 text-sm">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
              p: ({ children }) => (
                <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="min-w-full border border-gray-600 rounded-lg text-xs">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-gray-800">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 text-left font-medium border-b border-gray-600 text-gray-300">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 border-b border-gray-700/50 text-gray-200">{children}</td>
              ),
              h1: ({ children }) => (
                <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-medium mt-2 mb-1">{children}</h3>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-blue-500 pl-3 my-2 text-gray-300 italic text-sm">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="border-gray-600 my-3" />,
            }}
          >
            {m.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type, toolName }: { type: string; toolName?: string }) {
  const configs: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    plan: {
      icon: <Loader2 className="w-3 h-3" />,
      label: 'Plan',
      className: 'bg-blue-900/30 text-blue-300 border-blue-500/30',
    },
    hitl_request: {
      icon: <AlertTriangle className="w-3 h-3" />,
      label: 'Approval Required',
      className: 'bg-yellow-900/30 text-yellow-300 border-yellow-500/30',
    },
    tool_result: {
      icon: <Check className="w-3 h-3" />,
      label: toolName ?? 'Tool Result',
      className: 'bg-green-900/30 text-green-300 border-green-500/30',
    },
    error: {
      icon: <X className="w-3 h-3" />,
      label: 'Error',
      className: 'bg-red-900/30 text-red-300 border-red-500/30',
    },
    stopped: {
      icon: <AlertTriangle className="w-3 h-3" />,
      label: 'Stopped',
      className: 'bg-orange-900/30 text-orange-300 border-orange-500/30',
    },
  }

  const config = configs[type]
  if (!config) return null

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mb-2 ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}
