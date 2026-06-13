import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { parseOffice } = require("officeparser") as { parseOffice: (input: Buffer | string, callback: (data: string, err: unknown) => void, config?: object) => void };

export type SupportedFileType = "pdf" | "docx" | "doc" | "pptx" | "ppt" | "txt";

export function detectFileType(filename: string, mimetype: string): SupportedFileType {
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
  
  // افتراض PDF كنوع افتراضي لأي ملف آخر
  return "pdf";
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // محاولة استخراج النص من PDF باستخدام طريقة بسيطة
    // البحث عن النصوص المرئية في ملف PDF
    const text = buffer.toString("binary");
    
    // استخراج النصوص من PDF
    const matches = text.match(/BT[\s\S]*?ET/g) || [];
    let extractedText = "";
    
    for (const match of matches) {
      const textMatches = match.match(/\((.*?)\)/g) || [];
      for (const textMatch of textMatches) {
        const cleanText = textMatch.slice(1, -1).replace(/\\/g, "");
        extractedText += cleanText + " ";
      }
    }
    
    // إذا لم نجد نصاً، حاول طريقة أخرى
    if (!extractedText.trim()) {
      // استخراج أي نصوص مرئية من الملف
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.includes("(") && line.includes(")")) {
          const match = line.match(/\((.*?)\)/);
          if (match) {
            extractedText += match[1] + " ";
          }
        }
      }
    }
    
    return extractedText.trim() || "لم يتمكن النظام من استخراج النص من الملف. يرجى التأكد من أن الملف يحتوي على نصوص قابلة للاستخراج.";
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
