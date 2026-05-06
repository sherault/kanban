import { TotpCodeInput } from "./TotpCodeInput";

export function TotpDisablePanel({
  code,
  isPending,
  onCodeChange,
  onConfirm,
  onCancel,
}: {
  code: string;
  isPending: boolean;
  onCodeChange: (code: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-sm text-gray-600">
        Enter your current authenticator code to disable two-factor
        authentication.
      </p>
      <TotpCodeInput
        label="Authenticator code"
        code={code}
        onCodeChange={onCodeChange}
      />
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={isPending || code.length !== 6}
          className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Disabling…" : "Disable 2FA"}
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="text-sm text-gray-500 hover:text-gray-700 px-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
