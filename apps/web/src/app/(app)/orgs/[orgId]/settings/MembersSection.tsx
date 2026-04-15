"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MembershipDto } from "@kanban/shared";
import {
  updateMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
  deleteOrgAction,
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
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const currentMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === "owner";
  const canManage = isOwner || currentMember?.role === "manager";
  const otherMembers = members.filter(
    (m) => m.userId !== currentUserId && m.role !== "owner",
  );

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

  function deleteOrg() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrgAction(orgId);
      if (result?.error) setError(result.error);
    });
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
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Transfer ownership
                </h3>
                <p className="text-sm text-gray-600">
                  Transfer ownership to{" "}
                  <strong>{target?.user.displayName}</strong>? You will become a
                  manager and lose owner privileges.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setTransferTarget(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => transferOwnership(transferTarget)}
                    disabled={isPending}
                    className="text-sm bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Danger zone — owner only */}
      {isOwner && (
        <section>
          <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">
            Danger zone
          </h3>
          <div className="border border-red-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Delete this organization
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanently deletes the organization, all its projects, and
                tasks. This cannot be undone.
                {otherMembers.length > 0 &&
                  " Transfer ownership first if you want another member to keep it."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder='Type "delete" to confirm'
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 w-52"
              />
              <button
                onClick={deleteOrg}
                disabled={isPending || deleteConfirm !== "delete"}
                className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Delete organization
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
