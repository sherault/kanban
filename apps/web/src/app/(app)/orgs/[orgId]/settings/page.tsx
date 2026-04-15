import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "../../../../../lib/api";
import { getAccessToken, getUserId } from "../../../../../lib/session";
import { InviteSection } from "./InviteSection";
import { MembersSection } from "./MembersSection";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const [{ data: members }, currentUserId] = await Promise.all([
    api.orgs.listMembers(token, orgId),
    getUserId(),
  ]);

  return (
    <div className="p-6 overflow-auto h-full">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/orgs" className="hover:text-gray-900 transition-colors">
          Organizations
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/orgs/${orgId}`}
          className="hover:text-gray-900 transition-colors"
        >
          Projects
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700">Settings</span>
      </nav>

      <div className="max-w-2xl space-y-8">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>

        <MembersSection
          members={members}
          orgId={orgId}
          currentUserId={currentUserId ?? ""}
        />

        <InviteSection orgId={orgId} />
      </div>
    </div>
  );
}
