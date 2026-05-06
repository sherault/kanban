interface NewTaskErrorProps {
  error?: string;
}

export function NewTaskError({ error }: NewTaskErrorProps) {
  if (!error) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
      {error}
    </div>
  );
}
