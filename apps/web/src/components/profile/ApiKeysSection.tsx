"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ApiKeyDto, ApiKeyCreatedDto } from "@kanban/shared";
import { createApiKeyAction, revokeApiKeyAction } from "@/actions/profile";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {pending ? "Creating…" : "Create key"}
    </button>
  );
}

interface Props {
  initialKeys: ApiKeyDto[];
}

export function ApiKeysSection({ initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKeyDto[]>(initialKeys);
  const [newKey, setNewKey] = useState<ApiKeyCreatedDto | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [state, formAction] = useActionState(createApiKeyAction, {});

  // When a new key is created, show it and add it to the list
  if (state.created && (!newKey || newKey.id !== state.created.id)) {
    setNewKey(state.created);
    setKeys((prev) => [
      state.created!,
      ...prev.filter((k) => k.id !== state.created!.id),
    ]);
  }

  async function handleRevoke(keyId: string) {
    setRevoking(keyId);
    setRevokeError(null);
    const result = await revokeApiKeyAction(keyId);
    setRevoking(null);
    if (result.error) {
      setRevokeError(result.error);
    } else {
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      if (newKey?.id === keyId) setNewKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create new key */}
      <form action={formAction} className="flex gap-3 items-end">
        <div className="flex-1">
          <label
            htmlFor="label"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Key label
          </label>
          <input
            id="label"
            name="label"
            type="text"
            required
            maxLength={100}
            placeholder="e.g. Claude Desktop"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <SubmitButton />
      </form>

      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
          {state.error}
        </div>
      )}

      {/* Show raw key once after creation */}
      {newKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-2">
          <p className="text-sm font-medium text-amber-800">
            Copy your new API key — it won't be shown again:
          </p>
          <code className="block text-xs font-mono bg-white border border-amber-200 rounded px-3 py-2 break-all select-all">
            {newKey.rawKey}
          </code>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-amber-700 hover:text-amber-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {revokeError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
          {revokeError}
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {keys.map((key) => (
            <li
              key={key.id}
              className="py-3 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{key.label}</p>
                <p className="text-xs text-gray-400">
                  Created{" "}
                  {new Date(key.createdAt).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {key.lastUsedAt &&
                    ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`}
                </p>
              </div>
              <button
                onClick={() => void handleRevoke(key.id)}
                disabled={revoking === key.id}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {revoking === key.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
