"use client";

import { useState, useTransition } from "react";
import { deleteOrgAction } from "@/actions/orgs";

export function DangerZoneSection({
  orgId,
  orgName,
}: {
  orgId: string;
  orgName: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, startDeleteTransition] = useTransition();

  const canDelete = confirmText === "delete";

  const handleDelete = () => {
    if (!canDelete) return;

    startDeleteTransition(async () => {
      const res = await deleteOrgAction(orgId);
      if (res?.error) {
        alert(res.error);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-red-50/50 border border-red-100 rounded-xl p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg
              className="w-6 h-6 text-red-600"
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
          <div>
            <h4 className="text-lg font-bold text-red-900">
              Delete Organization
            </h4>
            <p className="text-sm text-red-700 mt-1">
              This action is{" "}
              <strong className="font-black italic">permanent</strong> and
              cannot be undone. All projects, tasks, members, and data
              associated with <span className="font-bold">"{orgName}"</span>{" "}
              will be destroyed.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="confirmDelete"
              className="block text-sm font-semibold text-red-900 line-through-label"
            >
              Type{" "}
              <span className="bg-red-200 px-1.5 py-0.5 rounded font-mono text-red-900">
                delete
              </span>{" "}
              to confirm
            </label>
            <input
              id="confirmDelete"
              type="text"
              placeholder="delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toLowerCase())}
              className="w-full bg-white border border-red-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
              autoComplete="off"
            />
          </div>

          <button
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            className="w-full px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isDeleting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Deleting Organization...
              </span>
            ) : (
              "Permanently Delete Organization"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
