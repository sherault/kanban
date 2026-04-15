import { parse } from "csv-parse/sync";
import type { Column } from "@kanban/shared";

const VALID_COLUMNS: Column[] = ["ideas", "todo", "doing", "done"];

export interface CsvTaskRow {
  title: string;
  description: string | null;
  objective: string | null;
  startDate: string;
  endDate: string;
  column: Column;
  backgroundColor: string | null;
  globalSubject: string | null;
}

export interface ParseResult {
  valid: CsvTaskRow[];
  skipped: number;
}

export function parseCsvImport(csvText: string): ParseResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const valid: CsvTaskRow[] = [];
  let skipped = 0;

  for (const row of records) {
    if (!row["title"] || !row["startDate"] || !row["endDate"]) {
      skipped++;
      continue;
    }
    const col = row["column"] ?? "";
    valid.push({
      title: row["title"],
      description: row["description"] || null,
      objective: row["objective"] || null,
      startDate: row["startDate"],
      endDate: row["endDate"],
      column: VALID_COLUMNS.includes(col as Column) ? (col as Column) : "todo",
      backgroundColor: row["backgroundColor"] || null,
      globalSubject: row["globalSubject"] || null,
    });
  }

  return { valid, skipped };
}
