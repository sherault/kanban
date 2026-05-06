export { ApiError, apiFetch } from "./api/core";
import { authApi } from "./api/auth";
import { inviteApi } from "./api/invite";
import { orgsApi } from "./api/orgs";
import { profileApi } from "./api/profile";
import { projectsApi } from "./api/projects";
import { tasksApi } from "./api/tasks";
import { wikiApi } from "./api/wiki";

export const api = {
  auth: authApi,
  orgs: orgsApi,
  projects: projectsApi,
  tasks: tasksApi,
  profile: profileApi,
  wiki: wikiApi,
  invite: inviteApi,
};
