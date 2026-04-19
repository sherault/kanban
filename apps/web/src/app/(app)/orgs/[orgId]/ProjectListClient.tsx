"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectDto } from "@kanban/shared";
import { OrgSettingsModal } from "@/components/OrgSettingsModal";
import { ProjectSettingsModal } from "@/components/ProjectSettingsModal";

interface Props {
  projects: ProjectDto[];
  orgId: string;
}

export function ProjectListClient({ projects, orgId }: Props) {
  const [activeOrgSettings, setActiveOrgSettings] = useState(false);
  const [activeProjectSettings, setActiveProjectSettings] = useState<
    string | null
  >(null);

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 font-medium animate-in slide-in-from-left-4 duration-300">
        <Link href="/orgs" className="hover:text-blue-600 transition-colors">
          Organizations
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700">Projects</span>
      </nav>

      <div className="flex items-center justify-between mb-8 animate-in slide-in-from-top-4 duration-500">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          Projects
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveOrgSettings(true)}
            className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-all active:scale-95"
          >
            Settings
          </button>
          <Link
            href={`/orgs/${orgId}/projects/new`}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-100 hover:shadow-md active:scale-95"
          >
            New project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-24 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 animate-in fade-in duration-700">
          <div className="text-4xl mb-4">📂</div>
          <p className="text-xl font-semibold text-gray-900 mb-2">
            No projects yet
          </p>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Create a project to start organizing your work and collaboration.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {projects.map((p) => (
            <div key={p.id} className="relative group">
              <Link
                href={`/orgs/${orgId}/projects/${p.id}`}
                className="block bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 h-full"
              >
                <div className="font-bold text-gray-900 pr-10 text-lg group-hover:text-blue-600 transition-colors">
                  {p.name}
                </div>
                <div className="text-xs font-medium text-gray-400 mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  Created{" "}
                  {new Date(p.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </Link>
              <button
                onClick={() => setActiveProjectSettings(p.id)}
                className="absolute top-6 right-6 text-gray-300 hover:text-blue-600 hover:rotate-90 transition-all duration-300 opacity-0 group-hover:opacity-100 p-2"
                title="Project settings"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {activeOrgSettings && (
        <OrgSettingsModal
          orgId={orgId}
          onClose={() => setActiveOrgSettings(false)}
        />
      )}

      {activeProjectSettings && (
        <ProjectSettingsModal
          orgId={orgId}
          projectId={activeProjectSettings}
          onClose={() => setActiveProjectSettings(null)}
        />
      )}
    </div>
  );
}
