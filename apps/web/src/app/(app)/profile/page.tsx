import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAccessToken, getUserName } from "../../../lib/session";
import { api } from "../../../lib/api";
import { ApiKeysSection } from "./ApiKeysSection";
import { TotpSection } from "./TotpSection";
import { ResendVerificationButton } from "./ResendVerificationButton";
import { SettingsSection } from "./SettingsSection";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const [displayName, { data: keys }, { data: me }] = await Promise.all([
    getUserName(),
    api.profile.listKeys(token),
    api.auth.me(token),
  ]);

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const isDev = process.env.NODE_ENV === "development";
  const publicApiUrl =
    process.env["PUBLIC_API_URL"] ||
    process.env["NEXT_PUBLIC_API_URL"] ||
    (isDev && host?.includes("localhost")
      ? "http://localhost:3010"
      : `${protocol}://${host}`);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
        <p className="text-sm text-gray-500">{displayName}</p>
      </div>

      {/* Email verification banner */}
      {!me.emailVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800">
            Your email address is not verified. Check your inbox for a
            verification link.
          </p>
          <ResendVerificationButton />
        </div>
      )}

      {/* 2FA */}
      <TotpSection totpEnabled={me.totpEnabled} />

      <hr className="border-gray-200" />

      {/* Preferences */}
      <SettingsSection initialMaxOpenPanels={me.maxOpenPanels} token={token} />

      <hr className="border-gray-200" />

      {/* MCP API Keys */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          MCP API Keys
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Use these keys to authenticate Claude (or other MCP clients) with your
          Kanban board.
        </p>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Streamable HTTP (recommended)
        </p>
        <pre className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-xs font-mono text-gray-700 mb-3 overflow-x-auto">{`{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "${publicApiUrl}/mcp/",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Legacy SSE (older clients)
        </p>
        <pre className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-xs font-mono text-gray-700 mb-6 overflow-x-auto">{`{
  "mcpServers": {
    "kanban": {
      "type": "sse",
      "url": "${publicApiUrl}/mcp/sse",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
        <ApiKeysSection initialKeys={keys} />
      </section>
    </div>
  );
}
