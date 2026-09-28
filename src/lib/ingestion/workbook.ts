import "server-only";
import readExcelFile from "read-excel-file/node";
import { parseWorkbookSheets, type ParsedSourceWorkbook, type WorkbookSheetData } from "./workbook-parser";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_WORKSHEETS = 20;
const MAX_TOTAL_ROWS = 20_000;
const MAX_COLUMNS_PER_ROW = 256;

export class WorkbookParseError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "WorkbookParseError";
  }
}

export async function parseSourceWorkbook(
  input: Uint8Array,
  options: { season: number; sourceVersion: string },
): Promise<ParsedSourceWorkbook> {
  if (input.byteLength > MAX_SOURCE_BYTES) throw new WorkbookParseError("FILE_TOO_LARGE");
  if (input.byteLength < 4 || input[0] !== 0x50 || input[1] !== 0x4b) throw new WorkbookParseError("INVALID_XLSX_CONTAINER");

  let sheets: Awaited<ReturnType<typeof readExcelFile>>;
  try {
    sheets = await readExcelFile(Buffer.from(input), { trim: false });
  } catch (error) {
    throw new WorkbookParseError("INVALID_XLSX", { cause: error });
  }

  if (sheets.length > MAX_WORKSHEETS) throw new WorkbookParseError("WORKBOOK_LIMIT_EXCEEDED");
  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.data.length, 0);
  if (totalRows > MAX_TOTAL_ROWS || sheets.some((sheet) => sheet.data.some((row) => row.length > MAX_COLUMNS_PER_ROW))) {
    throw new WorkbookParseError("WORKBOOK_LIMIT_EXCEEDED");
  }

  return parseWorkbookSheets(sheets as WorkbookSheetData[], options);
}

export type { ParsedAlbum, ParsedSourceWorkbook, WorkbookIssue, WorkbookSheetData } from "./workbook-parser";
