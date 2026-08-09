'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Code block, GitHub-flavoured.
 *
 * Minimal syntax colouring on purpose — three token classes rather than a full
 * highlighter. The point of a code block on this page is that the reader can
 * see the shape of the data and copy it, not that it looks like an IDE.
 */

type Language = 'json' | 'text' | 'bash'

function tokenize(line: string, language: Language) {
  if (language === 'bash') {
    const comment = line.indexOf('#')
    if (comment === 0) return [{ text: line, cls: 'text-[#6b7785]' }]
    return [{ text: line, cls: '' }]
  }

  if (language !== 'json') return [{ text: line, cls: '' }]

  // Split on JSON-ish tokens: strings, numbers, keywords, punctuation.
  const parts: Array<{ text: string; cls: string }> = []
  const pattern = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: line.slice(lastIndex, match.index), cls: 'text-[#8b949e]' })
    }
    if (match[1]) parts.push({ text: match[1], cls: 'text-[#79c0ff]' })
    else if (match[2]) parts.push({ text: match[2], cls: 'text-[#a5d6ff]' })
    else if (match[3]) parts.push({ text: match[3], cls: 'text-[#f0883e]' })
    else if (match[4]) parts.push({ text: match[4], cls: 'text-[#ff7b72]' })
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < line.length) {
    parts.push({ text: line.slice(lastIndex), cls: 'text-[#8b949e]' })
  }

  return parts.length > 0 ? parts : [{ text: line, cls: 'text-[#c9d1d9]' }]
}

export function CodeBlock({
  code,
  language = 'json',
  title,
  showLineNumbers = true,
  className,
}: {
  code: string
  language?: Language
  title?: string
  showLineNumbers?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const lines = code.replace(/\n$/, '').split('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard permission can be denied; the code is selectable regardless.
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border border-[var(--ink-border)] bg-[var(--ink)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ink-border)] px-4 py-2.5">
        <span className="truncate text-[12px] font-medium text-[var(--ink-muted)]">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-wide text-[#6b7785] uppercase">
            {language}
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-md p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-[#21262d] hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">{copied ? 'Copied' : 'Copy code'}</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <pre className="px-4 py-3.5 font-mono text-[12.5px] leading-[1.7]">
          <code>
            {lines.map((line, index) => (
              <div key={index} className="flex">
                {showLineNumbers && (
                  <span
                    className="mr-4 w-6 shrink-0 text-right text-[#4d5764] select-none"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                )}
                <span className="whitespace-pre">
                  {tokenize(line, language).map((part, i) => (
                    <span key={i} className={part.cls || 'text-[#c9d1d9]'}>
                      {part.text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
