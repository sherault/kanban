'use client'

import { useState, useTransition } from 'react'
import { resendVerificationAction } from '@/actions/profile'

export function ResendVerificationButton() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  function handleClick() {
    startTransition(async () => {
      await resendVerificationAction()
      setSent(true)
    })
  }

  if (sent) return <span className="text-xs text-amber-700 shrink-0">Sent!</span>

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-amber-700 hover:text-amber-900 font-medium shrink-0 disabled:opacity-50"
    >
      {isPending ? 'Sending…' : 'Resend email'}
    </button>
  )
}
