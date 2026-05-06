"use client";

import { useActionState, useEffect, useState } from "react";
import type { Column } from "@kanban/shared";
import type { TaskDto, MembershipDto } from "@kanban/shared";
import { createTaskAction } from "@/actions/tasks";
import { NewTaskActions } from "./new-task-modal/NewTaskActions";
import { NewTaskBasicFields } from "./new-task-modal/NewTaskBasicFields";
import { NewTaskColorReporterFields } from "./new-task-modal/NewTaskColorReporterFields";
import { NewTaskDatesField } from "./new-task-modal/NewTaskDatesField";
import { NewTaskError } from "./new-task-modal/NewTaskError";
import { NewTaskHeader } from "./new-task-modal/NewTaskHeader";
import { NewTaskTagsField } from "./new-task-modal/NewTaskTagsField";

interface Props {
  projectId: string;
  orgId: string;
  initialColumn: Column;
  orgMembers: MembershipDto[];
  objectives: string[];
  allTags: string[];
  onClose: () => void;
  onCreated: (task: TaskDto) => void;
}

export function NewTaskModal({
  projectId,
  orgId,
  initialColumn,
  orgMembers,
  objectives,
  allTags,
  onClose,
  onCreated,
}: Props) {
  const action = createTaskAction.bind(null, projectId, orgId);
  const [state, formAction] = useActionState(action, {});
  const [tags, setTags] = useState<string[]>([]);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.task) onCreated(state.task);
  }, [state.task, onCreated]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <NewTaskHeader onClose={onClose} />
        <form action={formAction} className="p-6 space-y-4">
          <NewTaskError error={state.error} />
          <NewTaskBasicFields
            description={description}
            initialColumn={initialColumn}
            objectives={objectives}
            onDescriptionChange={setDescription}
          />
          <NewTaskTagsField allTags={allTags} tags={tags} setTags={setTags} />
          <NewTaskDatesField />
          <NewTaskColorReporterFields
            backgroundColor={backgroundColor}
            orgMembers={orgMembers}
            onBackgroundColorChange={setBackgroundColor}
          />
          <NewTaskActions onClose={onClose} />
        </form>
      </div>
    </div>
  );
}
