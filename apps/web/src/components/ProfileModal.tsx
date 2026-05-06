"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { getProfileDataAction } from "@/actions/profile";
import type { ApiKeyDto, UserDto } from "@kanban/shared";
import { ProfileAccountTab } from "./profile/ProfileAccountTab";
import { ProfileMcpTab } from "./profile/ProfileMcpTab";
import { SettingsSection } from "./profile/SettingsSection";
import { SettingsModalLoading } from "./settings-modal/SettingsModalLoading";
import {
  SettingsModalShell,
  type SettingsModalTab,
} from "./settings-modal/SettingsModalShell";

interface ProfileData {
  displayName: string;
  keys: ApiKeyDto[];
  me: UserDto;
  token: string;
  publicApiUrl: string;
}

type ProfileTab = "account" | "preferences" | "mcp";

const TABS: SettingsModalTab<ProfileTab>[] = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "mcp", label: "MCP API Keys" },
];

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("account");
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    startTransition(async () => {
      const result = await getProfileDataAction();
      if (result) setData(result);
    });
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!mounted) return null;

  const content =
    !data && isPending ? (
      <SettingsModalLoading />
    ) : data ? (
      <SettingsModalShell
        title="Profile"
        subtitle={data.displayName}
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
      >
        {activeTab === "account" && (
          <ProfileAccountTab
            emailVerified={data.me.emailVerified}
            totpEnabled={data.me.totpEnabled}
          />
        )}
        {activeTab === "preferences" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SettingsSection
              initialMaxOpenPanels={data.me.maxOpenPanels}
              initialEnableNotifications={data.me.enableNotifications}
              initialMaxNotifications={data.me.maxNotifications}
              initialNotificationDuration={data.me.notificationDuration}
            />
          </div>
        )}
        {activeTab === "mcp" && (
          <ProfileMcpTab publicApiUrl={data.publicApiUrl} keys={data.keys} />
        )}
      </SettingsModalShell>
    ) : null;

  return createPortal(content, document.body);
}
