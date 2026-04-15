"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createOrgAction } from "../../../../actions/orgs";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating…" : "Create organization"}
    </button>
  );
}

export default function NewOrgPage() {
  const [state, formAction] = useActionState(createOrgAction, {});

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="max-w-md">
        <div className="mb-6">
          <Link
            href="/orgs"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Back to organizations
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          New organization
        </h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <form action={formAction} className="space-y-4">
            {state.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={1}
                maxLength={100}
                placeholder="Acme Inc."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              <SubmitButton />
              <Link
                href="/orgs"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
