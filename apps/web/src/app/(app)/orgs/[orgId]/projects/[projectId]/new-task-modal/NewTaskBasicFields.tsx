import { Column } from "@kanban/shared";
import { DescriptionEditor } from "../DescriptionEditor";

interface NewTaskBasicFieldsProps {
  description: string;
  initialColumn: Column;
  objectives: string[];
  onDescriptionChange: (value: string) => void;
}

export function NewTaskBasicFields({
  description,
  initialColumn,
  objectives,
  onDescriptionChange,
}: NewTaskBasicFieldsProps) {
  return (
    <>
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          autoFocus
          maxLength={500}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        {description && (
          <input type="hidden" name="description" value={description} />
        )}
        <DescriptionEditor
          value={description}
          onChange={onDescriptionChange}
          onFocus={() => {}}
          onBlur={() => {}}
          placeholder="Optional description..."
        />
      </div>
      <div>
        <label
          htmlFor="objective"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Objective
        </label>
        <input
          id="objective"
          name="objective"
          type="text"
          list="new-task-objectives"
          placeholder="Optional objective..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <datalist id="new-task-objectives">
          {objectives.map((objective) => (
            <option key={objective} value={objective} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Column
        </label>
        <div className="flex gap-4">
          {([Column.IDEAS, Column.TODO] as const).map((column) => (
            <label
              key={column}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="column"
                value={column}
                defaultChecked={column === initialColumn}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700 capitalize">{column}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
