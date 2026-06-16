import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { parseOffice } = require("officeparser") as { parseOffice: (input: Buffer | string, callback: (data: string, err: unknown) => void, config?: object) => void };

export type SupportedFileType = "pdf" | "docx" | "doc" | "pptx" | "ppt" | "txt";

export function detectFileType(filename: string, mimetype: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split(".").pop() || "";
  
  // محاولة اكتشاف من MIME type أولاً
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimetype === "application/msword") return "doc";
  if (mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mimetype === "application/vnd.ms-powerpoint") return "ppt";
  if (mimetype === "text/plain") return "txt";
  
  // محاولة اكتشاف من الامتداد
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (ext === "pptx") return "pptx";
  if (ext === "ppt") return "ppt";
  if (ext === "txt") return "txt";
  
  // إرجاع null للأنواع غير المدعومة
  return null;
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFParser = require("pdf2json") as any;
    const parser = new PDFParser(null, 1);

    return await new Promise<string>((resolve, reject) => {
      parser.on("pdfParser_dataError", (error: unknown) => {
        reject(new Error(`PDF parsing error: ${error}`));
      });

      parser.on("pdfParser_dataReady", () => {
        const text: string[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (parser.data && parser.data.Pages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const page of parser.data.Pages) {
            if (page.Texts) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const textObj of page.Texts) {
                if (textObj.R && textObj.R[0] && textObj.R[0].T) {
                  // Decode the text
                  const decoded = decodeURIComponent(textObj.R[0].T);
                  text.push(decoded);
                }
              }
            }
          }
        }

        const extractedText = text.join(" ").trim();
        console.log("[PDF Extraction] Extracted text length:", extractedText.length, "chars");
        resolve(extractedText || "لم يتمكن النظام من استخراج النص من الملف.");
      });

      parser.parseBuffer(buffer);
    });
  } catch (error) {
    console.error("[FileExtractor] PDF extraction error:", error);
    throw new Error(`Failed to extract text from PDF: ${(error as Error).message}`);
  }
}

export async function extractTextFromBuffer(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  try {
    if (fileType === "pdf") {
      return await extractTextFromPDF(buffer);
    }

    if (fileType === "txt") {
      return buffer.toString("utf-8").trim();
    }

    if (fileType === "docx" || fileType === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    if (fileType === "pptx" || fileType === "ppt") {
      return await new Promise<string>((resolve, reject) => {
        parseOffice(buffer, (data: unknown, err: unknown) => {
          if (err) {
            console.error("[PowerPoint Extraction] Error:", err);
            // Fallback: try to extract text from buffer as UTF-8
            const fallbackText = buffer.toString("utf-8").replace(/[^\x20-\x7E\u0600-\u06FF\n\r\t]/g, " ").trim();
            if (fallbackText.length > 0) {
              console.log("[PowerPoint Extraction] Using fallback extraction, length:", fallbackText.length);
              return resolve(fallbackText);
            }
            return reject(new Error(String(err)));
          }
          // Handle case where data might not be a string
          const text = typeof data === "string" ? data : String(data || "");
          console.log("[PowerPoint Extraction] Extracted text length:", text.trim().length);
          resolve(text.trim());
        }, { fileType: fileType === "pptx" ? "pptx" : "ppt" });
      });
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  } catch (error) {
    console.error("[FileExtractor] Error extracting text:", error);
    throw new Error(`Failed to extract text from ${fileType} file: ${(error as Error).message}`);
  }
}

export function sanitizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove control characters except newlines and tabs
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
