import type { AppDb, Broadcaster } from "../../../types.js";

export interface OrganizationServiceContext {
  readonly db: AppDb;
  readonly broadcast: Broadcaster;
}
