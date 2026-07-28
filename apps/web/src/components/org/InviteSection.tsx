"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createInvitationAction } from "@/actions/invitations";
import { AddMemberField } from "./AddMemberField";

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Generating…" : "Generate invite link"}
    </button>
  );
}

export function InviteSection({
  orgId,
  onMemberAdded,
}: {
  orgId: string;
  onMemberAdded: () => void;
}) {
  const action = createInvitationAction.bind(null, orgId);
  const [state, formAction] = useActionState(action, {});

  const inviteUrl =
    state.rawToken && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${state.rawToken}`
      : state.rawToken
        ? `/invite/${state.rawToken}`
        : null;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Invite people
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Generate a one-time invite link to share with new members. The link
            expires in 7 days.
          </p>

          <form action={formAction}>
            <GenerateButton />
          </form>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          {inviteUrl && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Share this link:</p>
              <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-700 break-all select-all">
                {inviteUrl}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Add an existing user
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Search by email and pick a user to add them to this organization
            right away. They join as a member — no invitation needed.
          </p>
          <AddMemberField orgId={orgId} onMemberAdded={onMemberAdded} />
        </div>
      </section>
    </div>
  );
}
