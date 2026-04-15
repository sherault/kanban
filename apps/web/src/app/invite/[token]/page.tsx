import { notFound } from "next/navigation";
import { api } from "../../../lib/api";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let orgName: string;
  try {
    const { data } = await api.invite.get(token);
    orgName = data.organization.name;
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              You&apos;re invited
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Join <span className="font-medium text-gray-700">{orgName}</span>{" "}
              on Kanban
            </p>
          </div>
          <AcceptInviteForm rawToken={token} />
        </div>
      </div>
    </div>
  );
}
