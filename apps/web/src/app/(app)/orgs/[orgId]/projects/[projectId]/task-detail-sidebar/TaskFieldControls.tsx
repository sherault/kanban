import type { ReactNode } from "react";

export function Field({
  label,
  labelMargin = "mb-1",
  children,
}: {
  label: string;
  labelMargin?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        className={`block text-xs font-semibold text-gray-500 uppercase tracking-wide ${labelMargin}`}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInputField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  list,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: (value: string) => void;
  list?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        list={list}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
    </Field>
  );
}

export function DateField({
  label,
  value,
  onBlur,
}: {
  label: string;
  value: string;
  onBlur: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        key={`${label}-${value}`}
        type="date"
        defaultValue={value}
        onBlur={(e) => onBlur(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
      />
    </Field>
  );
}
