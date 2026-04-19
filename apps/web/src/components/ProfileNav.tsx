"use client";

import { useState } from "react";
import { ProfileModal } from "./ProfileModal";

export function ProfileNav({ displayName }: { displayName: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        {displayName}
      </button>

      {isOpen && <ProfileModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
