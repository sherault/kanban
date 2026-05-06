import type { ApiKeyDto } from "@kanban/shared";
import { ApiKeysSection } from "./ApiKeysSection";

export function ProfileMcpTab({
  publicApiUrl,
  keys,
}: {
  publicApiUrl: string;
  keys: ApiKeyDto[];
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section>
        <p className="text-sm text-gray-500 mb-6">
          Use these keys to authenticate Claude (or other MCP clients) with your
          Kanban board.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Streamable HTTP (recommended)
            </p>
            <div className="relative group">
              <pre className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed shadow-lg">{`{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "${publicApiUrl}/mcp",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Manage Keys
          </h4>
          <ApiKeysSection initialKeys={keys} />
        </div>
      </section>
    </div>
  );
}
