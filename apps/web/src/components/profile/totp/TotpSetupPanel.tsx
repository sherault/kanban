import Image from "next/image";
import { TotpCodeInput } from "./TotpCodeInput";

export function TotpSetupPanel({
  qrCode,
  secret,
  code,
  isPending,
  onCodeChange,
  onConfirm,
  onCancel,
}: {
  qrCode: string;
  secret: string | null;
  code: string;
  isPending: boolean;
  onCodeChange: (code: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-sm text-gray-600">
        Scan this QR code with your authenticator app, then enter the 6-digit
        code to confirm.
      </p>
      <div className="flex justify-center">
        <Image
          src={qrCode}
          alt="2FA QR code"
          width={180}
          height={180}
          unoptimized
        />
      </div>
      {secret && (
        <div>
          <p className="text-xs text-gray-500 mb-1">
            Or enter this key manually:
          </p>
          <code className="block text-xs font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2 break-all select-all">
            {secret}
          </code>
        </div>
      )}
      <TotpCodeInput
        label="Verification code"
        code={code}
        onCodeChange={onCodeChange}
      />
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={isPending || code.length !== 6}
          className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Verifying…" : "Enable 2FA"}
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
