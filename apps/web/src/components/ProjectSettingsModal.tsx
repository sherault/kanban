"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  getProjectSettingsDataAction,
  updateProjectAction,
  deleteProjectAction,
} from "@/actions/projects";
import type { ProjectDto, Role } from "@kanban/shared";
import { useRouter } from "next/navigation";

interface ProjectSettingsData {
  project: ProjectDto;
  currentUserId: string;
  currentUserRole: Role;
  token: string;
}

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
  const [activeTab, setActiveTab] = useState<"general" | "danger">("general");
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

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!mounted) return null;

  function saveName() {
    setNameError(null);
    startTransition(async () => {
      const result = await updateProjectAction(orgId, projectId, { name });
      if (result.error) setNameError(result.error);
      else {
        // Re-fetch or update local state
        setData((prev) =>
          prev ? { ...prev, project: { ...prev.project, name } } : null,
        );
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteProjectAction(orgId, projectId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        onClose();
        router.push(`/orgs/${orgId}`);
      }
    });
  }

  const canDelete =
    data?.currentUserRole === "owner" || data?.currentUserRole === "manager";

  const tabs = [
    { id: "general" as const, label: "General" },
    ...(canDelete ? [{ id: "danger" as const, label: "Danger Zone" }] : []),
  ];

  const content = (
    <>
      {!data && isPending ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      ) : data ? (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999] p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
              <div className="p-6 border-b border-gray-200 bg-white">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Project Settings
                </h2>
                <p
                  className="text-xs text-gray-500 mt-1 truncate"
                  title={data.project.name}
                >
                  {data.project.name}
                </p>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? tab.id === "danger"
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : "bg-white text-blue-600 shadow-sm border border-gray-200"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                <h3
                  className={`text-lg font-semibold ${activeTab === "danger" ? "text-red-600" : "text-gray-900"}`}
                >
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === "general" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Project name
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      {nameError && (
                        <p className="text-xs text-red-600 font-medium">
                          {nameError}
                        </p>
                      )}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={saveName}
                          disabled={
                            isPending ||
                            name.trim() === "" ||
                            name === data.project.name
                          }
                          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                        >
                          {isPending ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        Project Details
                      </h4>
                      <p className="text-xs text-gray-500 mb-4">
                        Meta information about this project.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase font-bold spacing-wider">
                            Created At
                          </p>
                          <p className="text-sm text-gray-700 font-medium">
                            {new Date(
                              data.project.createdAt,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase font-bold spacing-wider">
                            Project ID
                          </p>
                          <p className="text-[10px] text-gray-700 font-mono truncate">
                            {data.project.id}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "danger" && canDelete && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-8 shadow-sm">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <svg
                            className="w-6 h-6 text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-red-900">
                            Delete Project
                          </h4>
                          <p className="text-sm text-red-700 mt-1">
                            This action is{" "}
                            <strong className="font-black italic">
                              permanent
                            </strong>{" "}
                            and cannot be undone. All tasks and data for{" "}
                            <span className="font-bold">
                              "{data.project.name}"
                            </span>{" "}
                            will be lost.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label
                            htmlFor="projectConfirmDelete"
                            className="block text-sm font-semibold text-red-900"
                          >
                            Type{" "}
                            <span className="bg-red-200 px-1.5 py-0.5 rounded font-mono text-red-900">
                              delete
                            </span>{" "}
                            to confirm
                          </label>
                          <input
                            id="projectConfirmDelete"
                            type="text"
                            placeholder="delete"
                            value={confirmDeleteText}
                            onChange={(e) =>
                              setConfirmDeleteText(e.target.value.toLowerCase())
                            }
                            className="w-full bg-white border border-red-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
                            autoComplete="off"
                          />
                        </div>

                        <button
                          onClick={handleDelete}
                          disabled={confirmDeleteText !== "delete" || isPending}
                          className="w-full px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          {isPending
                            ? "Deleting Project..."
                            : "Permanently Delete Project"}
                        </button>
                      </div>
                      {deleteError && (
                        <p className="text-xs text-red-600 mt-4 font-bold">
                          {deleteError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return createPortal(content, document.body);
}
