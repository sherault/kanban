export function SettingsModalLoading() {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    </div>
  );
}
