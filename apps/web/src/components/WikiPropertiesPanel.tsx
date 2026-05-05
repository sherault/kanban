"use client";

import { useState } from "react";

interface Props {
  properties: Record<string, unknown>;
  onChange: (properties: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function WikiPropertiesPanel({ properties, onChange, readOnly }: Props) {
  const [newKey, setNewKey] = useState("");
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const updateField = (key: string, value: unknown) => {
    if (readOnly) return;
    onChange({ ...properties, [key]: value });
  };

  const removeField = (key: string) => {
    if (readOnly) return;
    const next = { ...properties };
    delete next[key];
    onChange(next);
  };

  const addField = () => {
    if (readOnly) return;
    const key = newKey.trim();
    if (!key || properties[key]) return;
    onChange({ ...properties, [key]: "" });
    setNewKey("");
    setFocusKey(key);
  };

  return (
    <div className="w-80 border-l border-gray-100 bg-gray-50/30 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Page Properties
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {Object.entries(properties || {}).map(([key, value]) => (
          <div key={key} className="group space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {key}
              </label>
              {!readOnly && (
                <button
                  onClick={() => removeField(key)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-red-400 hover:text-red-600 transition-all"
                >
                  Remove
                </button>
              )}
            </div>

            {Array.isArray(value) ? (
              <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-gray-100 rounded-xl min-h-[42px] shadow-sm transition-all hover:border-gray-200">
                {value.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-blue-50/50 text-blue-600 text-[10px] font-bold rounded-lg flex items-center gap-1.5 border border-blue-100/50"
                  >
                    {tag}
                    {!readOnly && (
                      <button
                        onClick={() =>
                          updateField(
                            key,
                            value.filter((_, idx) => idx !== i),
                          )
                        }
                        className="text-blue-300 hover:text-blue-600 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {!readOnly && (
                  <input
                    type="text"
                    placeholder="Add tag..."
                    className="flex-1 min-w-[60px] text-[10px] focus:outline-none bg-transparent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          updateField(key, [...value, val]);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="relative group/input">
                <input
                  type="text"
                  value={(value as string | number) || ""}
                  autoFocus={focusKey === key}
                  onFocus={() => {
                    if (focusKey === key) setFocusKey(null);
                  }}
                  onChange={(e) => updateField(key, e.target.value)}
                  readOnly={readOnly}
                  className={`w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 outline-none transition-all shadow-sm ${!readOnly ? "hover:border-gray-200" : "cursor-default"}`}
                  placeholder="Empty"
                />
                {!readOnly && (
                  <button
                    onClick={() => updateField(key, value ? [value] : [])}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-gray-300 hover:text-blue-500 transition-all opacity-0 group-hover/input:opacity-100"
                    title="Convert to tags"
                  >
                    Tags
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Empty state or Add new field */}
        {!readOnly && (
          <div className="pt-6 border-t border-gray-100/80 space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Add a property..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addField()}
                className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-gray-400 font-medium"
              />
              {newKey && (
                <button
                  onClick={addField}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 font-black text-xs"
                >
                  ↵
                </button>
              )}
            </div>
            <p className="text-[9px] text-gray-400 leading-relaxed px-1 italic">
              Properties are shared in real-time with collaborators.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
