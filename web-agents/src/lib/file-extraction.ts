import * as XLSX from "xlsx";
import mammoth from "mammoth";

/**
 * Extract text content from various file types
 *
 * Supported formats:
 * - PDF: application/pdf (uses pdf-parse-new)
 * - Excel: .xlsx, .xls
 * - Word: .docx
 * - CSV: text/csv
 *
 * @param buffer - File buffer
 * @param mimeType - MIME type of the file
 * @param fileName - Original file name (for better error messages)
 * @returns Extracted text content
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  try {
    // ─── PDF ────────────────────────────────────────────────────────────────
    if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      // pdf-parse-new: drop-in replacement for pdf-parse that works in Next.js
      // with Turbopack. Simple pdf(buffer) API, no worker setup needed.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdf = require("pdf-parse-new");
      const data = await pdf(buffer);
      return data.text || "";
    }

    // ─── Excel (.xlsx / .xls) ───────────────────────────────────────────────
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel" ||
      fileName.toLowerCase().endsWith(".xlsx") ||
      fileName.toLowerCase().endsWith(".xls")
    ) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        });

        const sheetText = sheetData
          .map((row) =>
            Array.isArray(row)
              ? row
                  .filter((cell) => cell !== null && cell !== undefined && cell !== "")
                  .join("\t")
              : ""
          )
          .filter((row) => row.trim().length > 0)
          .join("\n");

        if (sheetText.trim()) {
          sheets.push(`Sheet: ${sheetName}\n${sheetText}\n`);
        }
      });

      return sheets.join("\n\n");
    }

    // ─── Word (.docx) ───────────────────────────────────────────────────────
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }

    // ─── CSV ─────────────────────────────────────────────────────────────────
    if (mimeType === "text/csv" || fileName.toLowerCase().endsWith(".csv")) {
      return buffer
        .toString("utf-8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join("\n");
    }

    // ─── Unsupported ────────────────────────────────────────────────────────
    throw new Error(`Unsupported file type: ${mimeType} (${fileName})`);
  } catch (error) {
    console.error(`Error extracting text from ${fileName}:`, error);
    throw new Error(
      `Failed to extract text from ${fileName}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Check if a file type is supported for text extraction
 */
export function isTextExtractableFile(mimeType: string, fileName: string): boolean {
  const lowerName = fileName.toLowerCase();

  return (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "text/csv" ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".csv")
  );
}