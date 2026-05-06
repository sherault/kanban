"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  deleteProjectAction,
  getProjectSettingsDataAction,
  updateProjectAction,
} from "@/actions/projects";
import type { ProjectDto, Role } from "@kanban/shared";
import { ProjectDangerTab } from "./project-settings/ProjectDangerTab";
import { ProjectGeneralTab } from "./project-settings/ProjectGeneralTab";
import { SettingsModalLoading } from "./settings-modal/SettingsModalLoading";
import {
  SettingsModalShell,
  type SettingsModalTab,
} from "./settings-modal/SettingsModalShell";

interface ProjectSettingsData {
  project: ProjectDto;
  currentUserId: string;
  currentUserRole: Role;
  token: string;
}

type ProjectSettingsTab = "general" | "danger";

export function ProjectSettingsModal({
  orgId,
  projectId,
  onClose,
}: {
  orgId: string;
  projectId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProjectSettingsData | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>("general");
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    startTransition(async () => {
      const result = await getProjectSettingsDataAction(orgId, projectId);
      if (result) {
        setData(result);
        setName(result.project.name);
      }
    });
  }, [orgId, projectId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!mounted) return null;

  const canDelete =
    data?.currentUserRole === "owner" || data?.currentUserRole === "manager";
  const tabs: SettingsModalTab<ProjectSettingsTab>[] = [
    { id: "general", label: "General" },
    ...(canDelete
      ? [{ id: "danger" as const, label: "Danger Zone", danger: true }]
      : []),
  ];

  const content =
    !data && isPending ? (
      <SettingsModalLoading />
    ) : data ? (
      <SettingsModalShell
        title="Project Settings"
        subtitle={data.project.name}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
      >
        {activeTab === "general" && (
          <ProjectGeneralTab
            project={data.project}
            name={name}
            nameError={nameError}
            isPending={isPending}
            onNameChange={setName}
            onSave={() => saveName(orgId, projectId, name)}
          />
        )}
        {activeTab === "danger" && canDelete && (
          <ProjectDangerTab
            project={data.project}
            confirmDeleteText={confirmDeleteText}
            deleteError={deleteError}
            isPending={isPending}
            onConfirmTextChange={setConfirmDeleteText}
            onDelete={() => handleDelete(orgId, projectId)}
          />
        )}
      </SettingsModalShell>
    ) : null;

  return createPortal(content, document.body);

  function saveName(
    currentOrgId: string,
    currentProjectId: string,
    next: string,
  ) {
    setNameError(null);
    startTransition(async () => {
      const result = await updateProjectAction(currentOrgId, currentProjectId, {
        name: next,
      });
      if (result.error) setNameError(result.error);
      else {
        setData((prev) =>
          prev ? { ...prev, project: { ...prev.project, name: next } } : null,
        );
      }
    });
  }

  function handleDelete(currentOrgId: string, currentProjectId: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteProjectAction(currentOrgId, currentProjectId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        onClose();
        router.push(`/orgs/${currentOrgId}`);
      }
    });
  }
}
