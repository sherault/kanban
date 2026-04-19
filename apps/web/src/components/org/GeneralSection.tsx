"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateOrgAction } from "@/actions/orgs";
import type { OrganizationDto } from "@kanban/shared";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200"
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export function GeneralSection({
  organization,
}: {
  organization: OrganizationDto;
}) {
  const updateOrgWithId = updateOrgAction.bind(null, organization.id);
  const [state, formAction] = useActionState(updateOrgWithId, {});
  const [name, setName] = useState(organization.name);
  const [website, setWebsite] = useState(organization.website ?? "");
  const [showSuccess, setShowSuccess] = useState(false);

  // Track previous prop values to synchronize state during render
  const [prevOrg, setPrevOrg] = useState({
    name: organization.name,
    website: organization.website,
  });

  if (
    organization.name !== prevOrg.name ||
    organization.website !== prevOrg.website
  ) {
    setPrevOrg({ name: organization.name, website: organization.website });
    setName(organization.name);
    setWebsite(organization.website ?? "");
  }

  useEffect(() => {
    if (state && !state.error && Object.keys(state).length > 0) {
      // Use a timeout to avoid synchronous setState in effect
      const successTimer = setTimeout(() => setShowSuccess(true), 0);
      const hideTimer = setTimeout(() => setShowSuccess(false), 3000);
      return () => {
        clearTimeout(successTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [state]);

  const hasChanges =
    name !== organization.name || website !== (organization.website ?? "");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-6">
        <form action={formAction} className="space-y-6">
          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-3">
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {state.error}
            </div>
          )}

          {showSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Settings saved successfully!
            </div>
          )}

          <div className="grid gap-6">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-900"
              >
                Organization Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={1}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <p className="text-xs text-gray-500">
                This name will be visible to all members of the organization.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="website"
                className="block text-sm font-semibold text-gray-900"
              >
                Website URL
              </label>
              <input
                id="website"
                name="website"
                type="url"
                placeholder="https://acme.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <p className="text-xs text-gray-500">
                Optional: Link to your organization's official website.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-end">
            <SubmitButton disabled={!hasChanges} />
          </div>
        </form>
      </div>
    </div>
  );
}
