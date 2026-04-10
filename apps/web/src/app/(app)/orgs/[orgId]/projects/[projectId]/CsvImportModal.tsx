'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { importCsvAction } from '@/actions/tasks'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Importing…' : 'Import'}
    </button>
  )
}

interface Props {
  projectId: string
  onClose: () => void
  onImported: (imported: number) => void
}

export function CsvImportModal({ projectId, onClose, onImported }: Props) {
  const action = importCsvAction.bind(null, projectId)
  const [state, formAction] = useActionState(action, {})
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.result) {
      onImported(state.result.imported)
    }
  }, [state.result, onImported])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Import tasks from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {state.error}
            </div>
          )}

          {state.result ? (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2 space-y-1">
              <p className="font-medium">Import complete</p>
              <p>{state.result.imported} task{state.result.imported !== 1 ? 's' : ''} imported</p>
              {state.result.skipped > 0 && (
                <p className="text-green-600">{state.result.skipped} row{state.result.skipped !== 1 ? 's' : ''} skipped (missing required fields)</p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV file</label>
                <input
                  ref={fileRef}
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  className="w-full text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Expected columns:</p>
                <p className="font-mono bg-gray-50 px-2 py-1 rounded text-xs">
                  title, description, objective, start_date, end_date, tags, global_subject, background_color, column
                </p>
                <p>Only <code>title</code>, <code>startDate</code>, and <code>endDate</code> are required.</p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              {state.result ? 'Close' : 'Cancel'}
            </button>
            {!state.result && <SubmitButton />}
          </div>
        </form>
      </div>
    </div>
  )
}
