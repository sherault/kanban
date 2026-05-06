export function TotpCodeInput({
  label,
  code,
  onCodeChange,
}: {
  label: string;
  code: string;
  onCodeChange: (code: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        autoFocus
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
