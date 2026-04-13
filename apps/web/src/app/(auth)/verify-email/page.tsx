import Link from 'next/link'
import { api, ApiError } from '../../../lib/api'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <Result error="Missing verification token." />
  }

  let success = false
  let errorMsg = ''
  try {
    await api.auth.verifyEmail(token)
    success = true
  } catch (e) {
    errorMsg = e instanceof ApiError ? e.message : 'Verification failed.'
  }

  if (success) {
    return <Result success />
  } else {
    return <Result error={errorMsg} />
  }
}

function Result({ success, error }: { success?: boolean; error?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
          <div className="text-4xl">{success ? '✅' : '❌'}</div>
          <h1 className="text-xl font-bold text-gray-900">
            {success ? 'Email verified!' : 'Verification failed'}
          </h1>
          {success ? (
            <p className="text-sm text-gray-600">
              Your email has been verified. You can now sign in.
            </p>
          ) : (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Link
            href="/login"
            className="inline-block text-sm text-blue-600 hover:underline font-medium"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
