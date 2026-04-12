'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProjectDto, Role } from '@kanban/shared'
import { updateProjectAction, deleteProjectAction } from '@/actions/projects'
import { useOrgSocket } from '@/hooks/useOrgSocket'

interface Props {
  project: ProjectDto
  orgId: string
  currentUserId: string
  currentUserRole: Role
}

export function ProjectSettingsClient({ project, orgId, currentUserId, currentUserRole }: Props) {
  const router = useRouter()
  const [name, setName] = useState(project.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Track current user's role — updates in real-time via WS
  const [role, setRole] = useState<Role>(currentUserRole)

  useOrgSocket(orgId, {
    onMemberUpdated(userId, newRole) {
      if (userId === currentUserId) {
        setRole(newRole as Role)
      }
    },
  })

  const canDelete = role === 'owner' || role === 'manager'

  function saveName() {
    setNameError(null)
    startTransition(async () => {
      const result = await updateProjectAction(orgId, project.id, { name })
      if (result.error) setNameError(result.error)
    })
  }

  function handleDelete() {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteProjectAction(orgId, project.id)
      if (result.error) {
        setDeleteError(result.error)
      } else {
        router.push(`/orgs/${orgId}`)
      }
    })
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/orgs" className="hover:text-gray-900 transition-colors">Organizations</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/orgs/${orgId}`} className="hover:text-gray-900 transition-colors">Projects</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/orgs/${orgId}/projects/${project.id}`} className="hover:text-gray-900 transition-colors">{project.name}</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700">Settings</span>
      </nav>

      <div className="max-w-2xl space-y-8">
        <h2 className="text-xl font-bold text-gray-900">Project Settings</h2>

        {/* Rename */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">General</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Project name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            {nameError && (
              <p className="text-xs text-red-600">{nameError}</p>
            )}
            <button
              onClick={saveName}
              disabled={isPending || name.trim() === '' || name === project.name}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </section>

        {/* Danger zone — only visible to owners and managers */}
        {canDelete && (
          <section>
            <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">Danger Zone</h3>
            <div className="bg-white border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Delete this project</p>
                  <p className="text-xs text-gray-500 mt-0.5">This action is permanent and cannot be undone.</p>
                </div>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="shrink-0 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                  >
                    Delete project
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">Are you sure?</span>
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {deleteError && (
                <p className="text-xs text-red-600 mt-2">{deleteError}</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
