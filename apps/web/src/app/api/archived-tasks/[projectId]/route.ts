import { NextResponse } from "next/server";
import { getAccessToken } from "../../../../lib/session";
import { api } from "../../../../lib/api";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await params;
  const token = await getAccessToken();
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(_req.url);
  const opts: {
    search?: string;
    page?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {};
  const search = url.searchParams.get("search");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  if (search) opts.search = search;
  opts.page = page;
  if (dateFrom) opts.dateFrom = dateFrom;
  if (dateTo) opts.dateTo = dateTo;

  try {
    const { data } = await api.tasks.listArchived(token, projectId, opts);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
