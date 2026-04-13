'use client'

import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// ── Toolbar ───────────────────────────────────────────────────────────────────

type ToolItem =
  | { type: 'divider' }
  | { type: 'action'; icon: string; title: string; prefix: string; suffix: string; defaultText: string; block?: boolean }

const TOOLBAR: ToolItem[] = [
  { type: 'action', icon: 'B',   title: 'Bold',          prefix: '**', suffix: '**', defaultText: 'bold text' },
  { type: 'action', icon: 'I',   title: 'Italic',        prefix: '*',  suffix: '*',  defaultText: 'italic text' },
  { type: 'action', icon: '`',   title: 'Inline code',   prefix: '`',  suffix: '`',  defaultText: 'code' },
  { type: 'divider' },
  { type: 'action', icon: 'H1',  title: 'Heading 1',     prefix: '# ',   suffix: '', defaultText: 'Heading', block: true },
  { type: 'action', icon: 'H2',  title: 'Heading 2',     prefix: '## ',  suffix: '', defaultText: 'Heading', block: true },
  { type: 'action', icon: 'H3',  title: 'Heading 3',     prefix: '### ', suffix: '', defaultText: 'Heading', block: true },
  { type: 'divider' },
  { type: 'action', icon: '•',   title: 'Bullet list',   prefix: '- ',  suffix: '', defaultText: 'item', block: true },
  { type: 'action', icon: '1.',  title: 'Ordered list',  prefix: '1. ', suffix: '', defaultText: 'item', block: true },
  { type: 'divider' },
  { type: 'action', icon: '```', title: 'Code block',    prefix: '```\n', suffix: '\n```', defaultText: 'code' },
]

function applyToolbar(
  textarea: HTMLTextAreaElement,
  item: Extract<ToolItem, { type: 'action' }>
): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const selected = text.slice(start, end) || item.defaultText

  let result: string
  let newStart: number
  let newEnd: number

  if (item.block && !item.suffix) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    result = text.slice(0, lineStart) + item.prefix + text.slice(lineStart)
    newStart = start + item.prefix.length
    newEnd = end + item.prefix.length
  } else {
    result = text.slice(0, start) + item.prefix + selected + item.suffix + text.slice(end)
    newStart = start + item.prefix.length
    newEnd = newStart + selected.length
  }

  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(newStart, newEnd)
  }, 0)

  return result
}

// ── Markdown preview ──────────────────────────────────────────────────────────

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const isInline = !className
    if (!isInline && match) {
      return (
        <SyntaxHighlighter
          style={oneLight}
          language={match[1]}
          PreTag="div"
          customStyle={{ borderRadius: '0.375rem', fontSize: '0.78rem', margin: '0.5rem 0' }}
        >
          {String(children as string).replace(/\n$/, '')}
        </SyntaxHighlighter>
      )
    }
    return (
      <code className="text-pink-600 bg-gray-100 px-1 rounded text-xs" {...props}>
        {children}
      </code>
    )
  },
}

function Preview({ value, placeholder }: { value: string; placeholder: string }) {
  return value ? (
    <div className="prose prose-sm max-w-none text-gray-700 prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-li:my-0 prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{value}</ReactMarkdown>
    </div>
  ) : (
    <span className="text-gray-400 text-sm">{placeholder}</span>
  )
}

// ── Toolbar row ───────────────────────────────────────────────────────────────

function Toolbar({
  textareaRef,
  onChange,
  showPreview,
  onTogglePreview,
  extra,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (v: string) => void
  showPreview: boolean
  onTogglePreview: () => void
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 shrink-0">
      {TOOLBAR.map((item, i) =>
        item.type === 'divider' ? (
          <div key={i} className="w-px h-3.5 bg-gray-300 mx-0.5" />
        ) : (
          <button
            key={item.title}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
              e.preventDefault()
              if (textareaRef.current) onChange(applyToolbar(textareaRef.current, item))
            }}
            className="px-1.5 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-600 font-mono leading-none"
          >
            {item.icon}
          </button>
        )
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onTogglePreview}
        className={`px-2 py-0.5 text-xs rounded ${showPreview ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-200 text-gray-500'}`}
      >
        Preview
      </button>
      {extra}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (value: string) => void
  onFocus: () => void
  onBlur: (value: string) => void
  placeholder?: string
}

export function DescriptionEditor({ value, onChange, onFocus, onBlur, placeholder = 'Add a description…' }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const startEditing = useCallback(() => {
    setIsEditing(true)
    setShowPreview(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  function handleTextareaBlur() {
    // Only collapse if not entering fullscreen
    setTimeout(() => {
      if (isFullscreen) return
      setIsEditing(false)
      onBlur(value)
    }, 150)
  }

  function closeFullscreen() {
    setIsFullscreen(false)
    onBlur(value)
  }

  // ── Fullscreen overlay ────────────────────────────────────────────────────

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
          <span className="text-sm font-semibold text-gray-700">Description</span>
          <button
            onClick={closeFullscreen}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <Toolbar
          textareaRef={textareaRef}
          onChange={onChange}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(v => !v)}
          extra={
            <button
              onClick={closeFullscreen}
              className="ml-1 px-2.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Done
            </button>
          }
        />

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          {showPreview ? (
            <div className="flex-1 overflow-y-auto">
              <Preview value={value} placeholder={placeholder} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={onFocus}
              autoFocus
              placeholder={`${placeholder} (markdown supported)`}
              className="flex-1 w-full text-sm text-gray-700 border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-blue-400 resize-none font-mono"
            />
          )}
        </div>
      </div>
    )
  }

  // ── Inline view ───────────────────────────────────────────────────────────

  if (!isEditing) {
    return (
      <div className="group relative">
        <div
          onClick={startEditing}
          className="min-h-[60px] cursor-text rounded border border-transparent hover:border-gray-200 px-2 py-1.5 transition-colors"
        >
          <Preview value={value} placeholder={placeholder} />
        </div>
        <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1">
          <button
            type="button"
            onClick={startEditing}
            className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500 hover:text-gray-700 shadow-sm"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setIsEditing(true); setIsFullscreen(true) }}
            className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500 hover:text-gray-700 shadow-sm"
            title="Fullscreen"
          >
            ⤢
          </button>
        </div>
      </div>
    )
  }

  // ── Inline edit ───────────────────────────────────────────────────────────

  return (
    <div className="border border-gray-200 rounded focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 overflow-hidden">
      <Toolbar
        textareaRef={textareaRef}
        onChange={onChange}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(v => !v)}
        extra={
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="ml-1 px-1.5 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-500"
            title="Fullscreen"
          >
            ⤢
          </button>
        }
      />
      {showPreview ? (
        <div
          className="min-h-[140px] px-3 py-2 cursor-text overflow-y-auto"
          onClick={() => { setShowPreview(false); setTimeout(() => textareaRef.current?.focus(), 0) }}
        >
          <Preview value={value} placeholder={placeholder} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={handleTextareaBlur}
          autoFocus
          placeholder={`${placeholder} (markdown supported)`}
          className="w-full min-h-[140px] text-sm text-gray-700 px-3 py-2 focus:outline-none resize-y font-mono bg-white"
        />
      )}
    </div>
  )
}
