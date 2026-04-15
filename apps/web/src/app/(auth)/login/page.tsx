"use client";

import { useActionState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction } from "../../../actions/auth";

function ResetSuccessBanner() {
  const params = useSearchParams();
  if (params.get("reset") !== "success") return null;
  return (
    <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">
      Password updated — please sign in with your new password.
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Signing in…" : label}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, {});
  const showTotp = state.totpRequired === true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {showTotp ? "Two-factor authentication" : "Sign in"}
          </h1>

          <form action={formAction} className="space-y-4">
            {state.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            {showTotp ? (
              <>
                {/* Hidden fields carry email/password through the TOTP step */}
                <input type="hidden" name="email" value={state.email} />
                <input type="hidden" name="password" value={state.password} />

                <p className="text-sm text-gray-600">
                  Enter the 6-digit code from your authenticator app.
                </p>

                <div>
                  <label
                    htmlFor="totpCode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Authenticator code
                  </label>
                  <input
                    id="totpCode"
                    name="totpCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <SubmitButton label="Verify" />
              </>
            ) : (
              <>
                <Suspense fallback={null}>
                  <ResetSuccessBanner />
                </Suspense>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <SubmitButton label="Sign in" />
                <p className="text-center">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </p>
              </>
            )}
          </form>

          {!showTotp && (
            <p className="mt-4 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-blue-600 hover:underline font-medium"
              >
                Register
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
