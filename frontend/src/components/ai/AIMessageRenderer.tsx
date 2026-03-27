'use client'

import { Bot, Check, Download, Loader2, User, AlertTriangle, X } from 'lucide-react'
import type { AIMessage } from '@/hooks/useAIChat'

type Props = {
  message: AIMessage
  index: number
}

export function AIMessageRenderer({ message: m, index }: Props) {
  const isUser = m.is_user

  // Parse markdown-like tables from content
  const hasTable = !isUser && m.content.includes('|') && m.content.includes('---')

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
        {hasTable ? (
          <div className="text-sm">
            <MarkdownContent content={m.content} />
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
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
      label: toolName ? `${toolName}` : 'Tool Result',
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

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering for tables and bold text
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let tableLines: string[] = []
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|')
    const isSeparator = /^\|[\s-:|]+\|$/.test(line.trim())

    if (isTableLine || isSeparator) {
      if (!inTable) inTable = true
      tableLines.push(line)
    } else {
      if (inTable) {
        elements.push(<SimpleTable key={`table-${i}`} lines={tableLines} />)
        tableLines = []
        inTable = false
      }
      if (line.trim()) {
        elements.push(
          <p key={i} className="whitespace-pre-wrap mb-1">
            {renderInlineFormatting(line)}
          </p>
        )
      }
    }
  }

  if (inTable && tableLines.length > 0) {
    elements.push(<SimpleTable key="table-end" lines={tableLines} />)
  }

  return <>{elements}</>
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Handle **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function SimpleTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !/^\|[\s-:|]+\|$/.test(l.trim()))
    .map((l) =>
      l
        .split('|')
        .filter(Boolean)
        .map((cell) => cell.trim())
    )

  if (rows.length === 0) return null

  const header = rows[0]
  const body = rows.slice(1)

  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="text-left px-2 py-1 border-b border-gray-600 text-gray-300 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="hover:bg-gray-800/30">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 border-b border-gray-700/50 text-gray-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
