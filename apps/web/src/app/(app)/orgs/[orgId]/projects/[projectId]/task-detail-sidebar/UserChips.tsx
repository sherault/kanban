import type { MembershipDto } from "@kanban/shared";

export function UserChips({
  users,
  orgMembers,
  onAdd,
  onRemove,
}: {
  users: Array<{ id: string; displayName: string }>;
  orgMembers: MembershipDto[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const assigned = new Set((users || []).map((user) => user.id));
  const available = (orgMembers || []).filter((m) => !assigned.has(m.userId));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {(users || []).map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
          >
            {user.displayName}
            <button
              onClick={() => onRemove(user.id)}
              className="text-blue-400 hover:text-blue-700 leading-none"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onAdd(e.target.value);
              e.target.value = "";
            }
          }}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">+ Add…</option>
          {available.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user.displayName}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
