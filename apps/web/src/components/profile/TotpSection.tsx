"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  disableTotpAction,
  enableTotpAction,
  setupTotpAction,
} from "@/actions/profile";
import { TotpDisablePanel } from "./totp/TotpDisablePanel";
import { TotpSetupPanel } from "./totp/TotpSetupPanel";
import { TotpStatusRow } from "./totp/TotpStatusRow";

interface Props {
  totpEnabled: boolean;
}

type TotpStep = "idle" | "setup" | "disable";

export function TotpSection({ totpEnabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<TotpStep>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Two-factor authentication
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Use an authenticator app (Google Authenticator, Authy, 1Password…) to
        add a second layer of security.
      </p>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {success && <StatusMessage tone="success">{success}</StatusMessage>}

      {step === "idle" && (
        <TotpStatusRow
          totpEnabled={totpEnabled}
          isPending={isPending}
          onStartSetup={startSetup}
          onStartDisable={() => {
            setStep("disable");
            setError(null);
            setSuccess(null);
          }}
        />
      )}

      {step === "setup" && qrCode && (
        <TotpSetupPanel
          qrCode={qrCode}
          secret={secret}
          code={code}
          isPending={isPending}
          onCodeChange={setCode}
          onConfirm={confirmEnable}
          onCancel={cancel}
        />
      )}

      {step === "disable" && (
        <TotpDisablePanel
          code={code}
          isPending={isPending}
          onCodeChange={setCode}
          onConfirm={confirmDisable}
          onCancel={cancel}
        />
      )}
    </section>
  );

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
      resetSetupState();
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
    resetSetupState();
    setError(null);
  }

  function resetSetupState() {
    setStep("idle");
    setCode("");
    setQrCode(null);
    setSecret(null);
  }
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700";
  return (
    <div className={`mb-4 border text-sm rounded-md px-3 py-2 ${toneClass}`}>
      {children}
    </div>
  );
}
