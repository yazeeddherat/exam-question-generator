import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { parseOffice } = require("officeparser") as { parseOffice: (input: Buffer | string, callback: (data: string, err: unknown) => void, config?: object) => void };

// استخدام pdf2json بدلاً من pdf-parse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFParser: any = require("pdf2json");

export type SupportedFileType = "pdf" | "docx" | "doc" | "pptx" | "ppt";

export function detectFileType(filename: string, mimetype: string): SupportedFileType {
  const ext = filename.toLowerCase().split(".").pop() || "";
  
  // محاولة اكتشاف من MIME type أولاً
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimetype === "application/msword") return "doc";
  if (mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mimetype === "application/vnd.ms-powerpoint") return "ppt";
  
  // محاولة اكتشاف من الامتداد
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (ext === "pptx") return "pptx";
  if (ext === "ppt") return "ppt";
  
  // افتراض PDF كنوع افتراضي لأي ملف آخر
  return "pdf";
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parser = new PDFParser(null, 1);
      let text = "";

      parser.on("pdfParser_dataError", (error: unknown) => {
        reject(new Error(`PDF parsing error: ${String(error)}`));
      });

      parser.on("pdfParser_dataReady", () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = parser.getRawTextContent() as any;
          text = data || "";
          resolve(text.trim());
        } catch (err) {
          reject(new Error(`Failed to extract text from PDF: ${String(err)}`));
        }
      });

      parser.parseBuffer(buffer);
    } catch (error) {
      reject(new Error(`Failed to extract text from PDF: ${String(error)}`));
    }
  });
}

export async function extractTextFromBuffer(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  try {
    if (fileType === "pdf") {
      return await extractTextFromPDF(buffer);
    }

    if (fileType === "docx" || fileType === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    }

    if (fileType === "pptx" || fileType === "ppt") {
      return await new Promise<string>((resolve, reject) => {
        parseOffice(buffer, (data: string, err: unknown) => {
          if (err) return reject(new Error(String(err)));
          resolve(data.trim());
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
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
