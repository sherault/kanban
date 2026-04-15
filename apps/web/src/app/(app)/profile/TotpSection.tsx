"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  setupTotpAction,
  enableTotpAction,
  disableTotpAction,
} from "@/actions/profile";

interface Props {
  totpEnabled: boolean;
}

export function TotpSection({ totpEnabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function startSetup() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await setupTotpAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setQrCode(result.qrCode ?? null);
      setSecret(result.secret ?? null);
      setStep("setup");
    });
  }

  function confirmEnable() {
    if (code.length !== 6) return;
    setError(null);
    startTransition(async () => {
      const result = await enableTotpAction(code);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("idle");
      setCode("");
      setQrCode(null);
      setSecret(null);
      setSuccess("Two-factor authentication enabled.");
    });
  }

  function confirmDisable() {
    if (code.length !== 6) return;
    setError(null);
    startTransition(async () => {
      const result = await disableTotpAction(code);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("idle");
      setCode("");
      setSuccess("Two-factor authentication disabled.");
    });
  }

  function cancel() {
    setStep("idle");
    setCode("");
    setError(null);
    setQrCode(null);
    setSecret(null);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Two-factor authentication
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Use an authenticator app (Google Authenticator, Authy, 1Password…) to
        add a second layer of security.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">
          {success}
        </div>
      )}

      {step === "idle" && (
        <div className="flex items-center gap-4">
          <span
            className={`text-sm font-medium ${totpEnabled ? "text-green-600" : "text-gray-500"}`}
          >
            {totpEnabled ? "✓ Enabled" : "Not enabled"}
          </span>
          {totpEnabled ? (
            <button
              onClick={() => {
                setStep("disable");
                setError(null);
                setSuccess(null);
              }}
              disabled={isPending}
              className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              Disable
            </button>
          ) : (
            <button
              onClick={startSetup}
              disabled={isPending}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Loading…" : "Set up 2FA"}
            </button>
          )}
        </div>
      )}

      {step === "setup" && qrCode && (
        <div className="space-y-4 max-w-sm">
          <p className="text-sm text-gray-600">
            Scan this QR code with your authenticator app, then enter the
            6-digit code to confirm.
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={confirmEnable}
              disabled={isPending || code.length !== 6}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Verifying…" : "Enable 2FA"}
            </button>
            <button
              onClick={cancel}
              disabled={isPending}
              className="text-sm text-gray-500 hover:text-gray-700 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "disable" && (
        <div className="space-y-4 max-w-sm">
          <p className="text-sm text-gray-600">
            Enter your current authenticator code to disable two-factor
            authentication.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authenticator code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={confirmDisable}
              disabled={isPending || code.length !== 6}
              className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Disabling…" : "Disable 2FA"}
            </button>
            <button
              onClick={cancel}
              disabled={isPending}
              className="text-sm text-gray-500 hover:text-gray-700 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
