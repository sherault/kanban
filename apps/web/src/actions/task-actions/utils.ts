import { redirect } from "next/navigation";
import { ApiError } from "../../lib/api";
import { getAccessToken } from "../../lib/session";

export async function requireTaskActionToken() {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  return token;
}

export function actionError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
