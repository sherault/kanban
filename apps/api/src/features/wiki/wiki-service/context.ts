import type { AppDb, Broadcaster } from "../../../types.js";

export interface WikiServiceContext {
  readonly db: AppDb;
  readonly broadcast: Broadcaster;
}
