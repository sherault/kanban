import type { TaskDto } from "@kanban/shared";
import { ColorPicker } from "../ColorPicker";
import { DescriptionEditor } from "../DescriptionEditor";
import { TagInput } from "./TagInput";
import { DateField, Field, TextInputField } from "./TaskFieldControls";
import type { ConflictField, TaskUpdateBody } from "./types";

export function TaskCoreFields({
  task,
  fields,
  objectives,
  allTags,
  save,
  onOpenRelatedTask,
  onTagAdd,
  onTagRemove,
}: {
  task: TaskDto;
  fields: {
    titleField: ConflictField;
    descField: ConflictField;
    objField: ConflictField;
    subjectField: ConflictField;
  };
  objectives: string[];
  allTags: string[];
  save: (body: TaskUpdateBody) => void;
  onOpenRelatedTask?: (taskId: string) => void;
  onTagAdd: (tag: string) => void;
  onTagRemove: (tag: string) => void;
}) {
  const { titleField, descField, objField, subjectField } = fields;

  return (
    <>
      <Field label="Title">
        <input
          value={titleField.value}
          onChange={(e) => titleField.setValue(e.target.value)}
          onFocus={titleField.onFocus}
          onBlur={(e) => {
            titleField.onBlur();
            const v = e.target.value.trim();
            if (v && v !== task.title) save({ title: v });
          }}
          className="w-full text-sm font-medium text-gray-900 border border-transparent rounded px-2 py-1.5 hover:border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
        />
      </Field>

      <Field label="Color" labelMargin="mb-2">
        <ColorPicker
          value={task.backgroundColor ?? null}
          onChange={(color) => {
            if (color !== task.backgroundColor)
              save({ backgroundColor: color });
          }}
        />
      </Field>

      <Field label="Description">
        <DescriptionEditor
          key={task.id}
          value={descField.value}
          onChange={descField.setValue}
          onFocus={descField.onFocus}
          onBlur={(value) => {
            descField.onBlur();
            const next = value || null;
            if (next !== task.description) save({ description: next });
          }}
          onOpenTask={onOpenRelatedTask}
        />
      </Field>

      <TextInputField
        label="Objective"
        value={objField.value}
        onChange={objField.setValue}
        onFocus={objField.onFocus}
        onBlur={(value) => {
          objField.onBlur();
          const next = value || null;
          if (next !== task.objective) save({ objective: next });
        }}
        list={`obj-list-${task.id}`}
        placeholder="Add an objective…"
      />
      <datalist id={`obj-list-${task.id}`}>
        {(objectives || [])
          .filter((objective) => objective !== task.objective)
          .map((objective) => (
            <option key={objective} value={objective} />
          ))}
      </datalist>

      <TextInputField
        label="Global subject"
        value={subjectField.value}
        onChange={subjectField.setValue}
        onFocus={subjectField.onFocus}
        onBlur={(value) => {
          subjectField.onBlur();
          const next = value || null;
          if (next !== task.globalSubject) save({ globalSubject: next });
        }}
        placeholder="Epic or global subject…"
      />

      <Field label="Tags">
        <TagInput
          tags={task.tags}
          allTags={allTags}
          onAdd={onTagAdd}
          onRemove={onTagRemove}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Start"
          value={task.startDate}
          onBlur={(value) =>
            value && value !== task.startDate && save({ startDate: value })
          }
        />
        <DateField
          label="End"
          value={task.endDate}
          onBlur={(value) =>
            value && value !== task.endDate && save({ endDate: value })
          }
        />
      </div>
    </>
  );
}
