import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
          <div className="text-4xl">📬</div>
          <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-600">
            We sent a verification link to your email address. Click the link to
            activate your account.
          </p>
          <p className="text-xs text-gray-400">
            The link expires in 24 hours. Check your spam folder if you
            don&apos;t see it.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-blue-600 hover:underline font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
