"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "../lib/api";
import { getAccessToken, getUserId } from "../lib/session";
import type { ProjectDto } from "@kanban/shared";

export async function updateProjectAction(
  orgId: string,
  projectId: string,
  body: { name: string },
): Promise<{ error?: string; project?: ProjectDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    const { data: project } = await api.projects.update(
      token,
      orgId,
      projectId,
      body,
    );
    revalidatePath(`/orgs/${orgId}`);
    revalidatePath(`/orgs/${orgId}/projects/${projectId}`);
    return { project };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update project",
    };
  }
}

export async function deleteProjectAction(
  orgId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    await api.projects.delete(token, orgId, projectId);
    revalidatePath(`/orgs/${orgId}`);
    return {};
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to delete project",
    };
  }
}

export async function createProjectAction(
  orgId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const name = formData.get("name") as string;

  let projectId: string;
  try {
    const { data } = await api.projects.create(token, orgId, { name });
    projectId = data.id;
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create project",
    };
  }

  redirect(`/orgs/${orgId}/projects/${projectId}`);
}

export async function getProjectSettingsDataAction(
  orgId: string,
  projectId: string,
) {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const [currentUserId, { data: projects }, { data: members }] =
      await Promise.all([
        getUserId(),
        api.projects.list(token, orgId),
        api.orgs.listMembers(token, orgId),
      ]);
    const project = projects.find((p) => p.id === projectId);
    if (!project) return null;
    const currentMember = members.find((m) => m.userId === currentUserId);
    const currentUserRole = currentMember?.role ?? "member";
    return {
      project,
      currentUserId: currentUserId ?? "",
      currentUserRole,
      token,
    };
  } catch (e) {
    console.error("Failed to fetch project settings data:", e);
    return null;
  }
}

export async function getProjectViewDataAction(
  orgId: string,
  projectId: string,
) {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const [{ data: tasks }, { data: members }, { data: me }, currentUserId] =
      await Promise.all([
        api.tasks.list(token, projectId),
        api.orgs.listMembers(token, orgId),
        api.auth.me(token),
        getUserId(),
      ]);

    return {
      tasks,
      members,
      me,
      currentUserId: currentUserId ?? "",
    };
  } catch (e) {
    console.error("Failed to fetch project view data:", e);
    throw e;
  }
}
