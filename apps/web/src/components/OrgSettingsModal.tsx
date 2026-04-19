"use client";

import { useEffect, useState, useTransition } from "react";
import { getOrgSettingsDataAction } from "@/actions/orgs";
import { MembersSection } from "./org/MembersSection";
import { InviteSection } from "./org/InviteSection";
import { GeneralSection } from "./org/GeneralSection";
import { DangerZoneSection } from "./org/DangerZoneSection";
import type { MembershipDto, OrganizationDto } from "@kanban/shared";

interface OrgSettingsData {
  members: MembershipDto[];
  organization: OrganizationDto;
  currentUserId: string;
  token: string;
}

export function OrgSettingsModal({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<OrgSettingsData | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "members" | "invites" | "danger"
  >("general");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getOrgSettingsDataAction(orgId);
      if (result) {
        setData(result);
      }
    });
  }, [orgId]);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!data && isPending) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "members" as const, label: "Members" },
    { id: "invites" as const, label: "Invites" },
    { id: "danger" as const, label: "Danger Zone" },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
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
              Org Settings
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Manage organization members and invitations.
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
                      ? "bg-red-50 text-red-600 border border-red-100 shadow-sm"
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
            <h3 className="text-lg font-semibold text-gray-900">
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
              <GeneralSection organization={data.organization} />
            )}

            {activeTab === "members" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <MembersSection
                  members={data.members}
                  orgId={orgId}
                  currentUserId={data.currentUserId}
                />
              </div>
            )}

            {activeTab === "invites" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <InviteSection orgId={orgId} />
              </div>
            )}

            {activeTab === "danger" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <DangerZoneSection
                  orgId={orgId}
                  orgName={data.organization.name}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
