"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MembershipDto } from "@kanban/shared";
import {
  updateMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
} from "@/actions/orgs";
import { TransferOwnershipModal } from "./TransferOwnershipModal";

interface Props {
  members: MembershipDto[];
  orgId: string;
  currentUserId: string;
}

export function MembersSection({ members, orgId, currentUserId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const currentMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === "owner";
  const canManage = isOwner || currentMember?.role === "manager";

  function changeRole(userId: string, role: "member" | "manager") {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(orgId, userId, role);
      if (result.error) setError(result.error);
    });
  }

  function removeMember(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(orgId, userId);
      if (result.error) setError(result.error);
    });
  }

  function transferOwnership(toUserId: string) {
    setError(null);
    startTransition(async () => {
      const result = await transferOwnershipAction(orgId, toUserId);
      if (result.error) {
        setError(result.error);
        setTransferTarget(null);
      } else router.refresh();
    });
    setTransferTarget(null);
  }

  return (
    <>
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Members
        </h3>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {members.map((m) => {
            const memberIsOwner = m.role === "owner";
            const isSelf = m.userId === currentUserId;
            return (
              <div
                key={m.userId}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {m.user.displayName}
                    {isSelf && (
                      <span className="ml-1 text-xs text-gray-400">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {m.user.email}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canManage && !memberIsOwner && !isSelf ? (
                    <select
                      value={m.role}
                      disabled={isPending}
                      onChange={(e) =>
                        changeRole(
                          m.userId,
                          e.target.value as "member" | "manager",
                        )
                      }
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                    </select>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                      {m.role}
                    </span>
                  )}

                  {isOwner && !memberIsOwner && !isSelf && (
                    <button
                      onClick={() => setTransferTarget(m.userId)}
                      disabled={isPending}
                      className="text-xs text-amber-500 hover:text-amber-700 disabled:opacity-50 transition-colors"
                      title="Transfer ownership to this member"
                    >
                      Make owner
                    </button>
                  )}

                  {canManage && !memberIsOwner && !isSelf && (
                    <button
                      onClick={() => removeMember(m.userId)}
                      disabled={isPending}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                      title="Remove member"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {transferTarget && (
        <TransferOwnershipModal
          target={members.find((m) => m.userId === transferTarget)}
          isPending={isPending}
          onCancel={() => setTransferTarget(null)}
          onConfirm={() => transferOwnership(transferTarget)}
        />
      )}
    </>
  );
}
