export function TotpStatusRow({
  totpEnabled,
  isPending,
  onStartSetup,
  onStartDisable,
}: {
  totpEnabled: boolean;
  isPending: boolean;
  onStartSetup: () => void;
  onStartDisable: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`text-sm font-medium ${totpEnabled ? "text-green-600" : "text-gray-500"}`}
      >
        {totpEnabled ? "✓ Enabled" : "Not enabled"}
      </span>
      {totpEnabled ? (
        <button
          onClick={onStartDisable}
          disabled={isPending}
          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          Disable
        </button>
      ) : (
        <button
          onClick={onStartSetup}
          disabled={isPending}
          className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Loading…" : "Set up 2FA"}
        </button>
      )}
    </div>
  );
}
