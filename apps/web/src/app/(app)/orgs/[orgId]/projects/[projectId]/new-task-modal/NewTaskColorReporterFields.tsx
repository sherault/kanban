import type { MembershipDto } from "@kanban/shared";
import { ColorPicker } from "../ColorPicker";

interface NewTaskColorReporterFieldsProps {
  backgroundColor: string | null;
  orgMembers: MembershipDto[];
  onBackgroundColorChange: (value: string | null) => void;
}

export function NewTaskColorReporterFields({
  backgroundColor,
  orgMembers,
  onBackgroundColorChange,
}: NewTaskColorReporterFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        {backgroundColor && (
          <input type="hidden" name="backgroundColor" value={backgroundColor} />
        )}
        <ColorPicker
          value={backgroundColor}
          onChange={onBackgroundColorChange}
        />
      </div>
      {orgMembers.length > 0 && (
        <div>
          <label
            htmlFor="reporterId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Reporter
          </label>
          <select
            id="reporterId"
            name="reporterId"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {orgMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
