"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MembershipDto } from "@kanban/shared";
import {
  updateMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
} from "@/actions/orgs";

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

      {/* Transfer ownership confirmation */}
      {transferTarget &&
        (() => {
          const target = members.find((m) => m.userId === transferTarget);
          return (
            <div
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-[210] p-4 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) setTransferTarget(null);
              }}
            >
              <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-200 border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 text-amber-600">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Transfer ownership
                  </h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Are you sure you want to transfer ownership to{" "}
                  <strong className="text-gray-900">
                    {target?.user.displayName}
                  </strong>
                  ?
                  <br />
                  <br />
                  You will become a{" "}
                  <strong className="text-gray-900">manager</strong> and lose
                  full administrative privileges over the organization.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setTransferTarget(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => transferOwnership(transferTarget)}
                    disabled={isPending}
                    className="px-6 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 shadow-sm shadow-amber-100 disabled:opacity-50 transition-all active:scale-95"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
