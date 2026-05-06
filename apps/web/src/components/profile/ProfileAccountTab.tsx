import { ResendVerificationButton } from "./ResendVerificationButton";
import { TotpSection } from "./TotpSection";

export function ProfileAccountTab({
  emailVerified,
  totpEnabled,
}: {
  emailVerified: boolean;
  totpEnabled: boolean;
}) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {!emailVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-sm text-amber-800">
              Your email address is not verified. Check your inbox.
            </p>
          </div>
          <ResendVerificationButton />
        </div>
      )}

      <TotpSection totpEnabled={totpEnabled} />
    </div>
  );
}
