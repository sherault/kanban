import type { MembershipDto, TaskDto } from "@kanban/shared";
import type { TaskUpdateBody } from "./types";
import { UserChips } from "./UserChips";

export function TaskPeopleSection({
  task,
  orgMembers,
  save,
  onWatcherAdd,
  onWatcherRemove,
  onAdvisorAdd,
  onAdvisorRemove,
}: {
  task: TaskDto;
  orgMembers: MembershipDto[];
  save: (body: TaskUpdateBody) => void;
  onWatcherAdd: (userId: string) => void;
  onWatcherRemove: (userId: string) => void;
  onAdvisorAdd: (userId: string) => void;
  onAdvisorRemove: (userId: string) => void;
}) {
  return (
    <>
      <PersonSelect
        label="Doer"
        value={task.doer?.id ?? ""}
        members={orgMembers}
        onChange={(value) => save({ doerId: value || null })}
      />
      <PersonSelect
        label="Validator"
        value={task.validator?.id ?? ""}
        members={orgMembers}
        onChange={(value) => save({ validatorId: value || null })}
      />
      <ChipGroup
        label="Watchers"
        users={task.watchers}
        orgMembers={orgMembers}
        onAdd={onWatcherAdd}
        onRemove={onWatcherRemove}
      />
      <ChipGroup
        label="Advisors"
        users={task.advisors}
        orgMembers={orgMembers}
        onAdd={onAdvisorAdd}
        onRemove={onAdvisorRemove}
      />
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Reporter
        </label>
        <p className="text-sm text-gray-700 px-2 py-1.5 font-medium">
          {task.reporter?.displayName || "System / Robot"}
        </p>
      </div>
    </>
  );
}

function PersonSelect({
  label,
  value,
  members,
  onChange,
}: {
  label: string;
  value: string;
  members: MembershipDto[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
      >
        <option value="">— Unassigned —</option>
        {(members || []).map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.user?.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChipGroup({
  label,
  users,
  orgMembers,
  onAdd,
  onRemove,
}: {
  label: string;
  users: Array<{ id: string; displayName: string }>;
  orgMembers: MembershipDto[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <UserChips
        users={users}
        orgMembers={orgMembers}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </div>
  );
}
