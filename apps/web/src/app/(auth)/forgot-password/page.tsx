'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { forgotPasswordAction } from '../../../actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Sending…' : 'Send reset link'}
    </button>
  )
}

export default function ForgotPasswordPage() {
  const [, formAction] = useActionState(forgotPasswordAction, {})

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot password?</h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <SubmitButton />
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
