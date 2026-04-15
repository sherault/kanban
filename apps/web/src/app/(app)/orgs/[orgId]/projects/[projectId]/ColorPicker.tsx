"use client";

import { useState, useRef } from "react";

export const PRESET_COLORS = [
  "#f3f4f6",
  "#fef2f2",
  "#fef9c3",
  "#f0fdf4",
  "#eff6ff",
  "#f5f3ff",
  "#fdf4ff",
  "#fff7ed",
  "#fecaca",
  "#fde68a",
  "#a7f3d0",
  "#bfdbfe",
  "#c4b5fd",
  "#f9a8d4",
  "#fed7aa",
  "#a5f3fc",
];

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const customRef = useRef<HTMLInputElement>(null);
  const [localCustom, setLocalCustom] = useState(value ?? "#ffffff");
  const isCustom = value !== null && !PRESET_COLORS.includes(value);

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {/* No color */}
      <button
        type="button"
        onClick={() => onChange(null)}
        title="No color"
        className={`w-6 h-6 rounded border-2 bg-white flex items-center justify-center leading-none ${
          value === null
            ? "border-blue-500"
            : "border-gray-200 hover:border-gray-400"
        }`}
      >
        <span className="text-gray-300 text-sm">×</span>
      </button>

      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          title={color}
          style={{ backgroundColor: color }}
          className={`w-6 h-6 rounded border-2 transition-transform ${
            value === color
              ? "border-blue-500 scale-110"
              : "border-gray-200 hover:border-gray-400"
          }`}
        />
      ))}

      {/* Custom */}
      <div className="relative w-6 h-6">
        <button
          type="button"
          onClick={() => customRef.current?.click()}
          title="Custom color…"
          style={isCustom && value ? { backgroundColor: value } : undefined}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
            isCustom
              ? "border-blue-500"
              : "border-dashed border-gray-300 hover:border-gray-400"
          }`}
        >
          {!isCustom && (
            <span className="text-gray-400 text-xs leading-none">+</span>
          )}
        </button>
        <input
          ref={customRef}
          type="color"
          value={localCustom}
          onChange={(e) => setLocalCustom(e.target.value)}
          onBlur={(e) => {
            if (e.target.value !== value) onChange(e.target.value);
          }}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
