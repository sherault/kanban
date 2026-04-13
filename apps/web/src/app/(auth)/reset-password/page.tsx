import Link from 'next/link'
import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
            <div className="text-4xl">❌</div>
            <h1 className="text-xl font-bold text-gray-900">Invalid reset link</h1>
            <p className="text-sm text-gray-600">
              This link is missing a token. Please request a new reset link.
            </p>
            <Link href="/forgot-password" className="inline-block text-sm text-blue-600 hover:underline font-medium">
              Request new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <ResetPasswordForm token={token} />
}
