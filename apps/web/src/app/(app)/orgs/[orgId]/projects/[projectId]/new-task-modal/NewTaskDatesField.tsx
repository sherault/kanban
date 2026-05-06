import { today, todayPlus2 } from "./dateDefaults";

export function NewTaskDatesField() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label
          htmlFor="startDate"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Start date
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={today()}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label
          htmlFor="endDate"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          End date
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={todayPlus2()}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
