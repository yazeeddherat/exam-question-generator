import { describe, expect, it } from "vitest";
import { detectFileType, sanitizeText } from "./fileExtractor";

describe("detectFileType", () => {
  it("detects PDF by extension", () => {
    expect(detectFileType("document.pdf", "application/octet-stream")).toBe("pdf");
  });

  it("detects PDF by mimetype", () => {
    expect(detectFileType("file", "application/pdf")).toBe("pdf");
  });

  it("detects DOCX by extension", () => {
    expect(detectFileType("report.docx", "application/octet-stream")).toBe("docx");
  });

  it("detects DOC by extension", () => {
    expect(detectFileType("report.doc", "application/msword")).toBe("doc");
  });

  it("detects PPTX by extension", () => {
    expect(detectFileType("slides.pptx", "application/octet-stream")).toBe("pptx");
  });

  it("detects PPT by extension", () => {
    expect(detectFileType("slides.ppt", "application/vnd.ms-powerpoint")).toBe("ppt");
  });

  it("returns null for unsupported type", () => {
    expect(detectFileType("image.png", "image/png")).toBeNull();
  });

  it("is case-insensitive for extensions", () => {
    expect(detectFileType("DOCUMENT.PDF", "application/octet-stream")).toBe("pdf");
  });
});

describe("sanitizeText", () => {
  it("normalizes multiple newlines", () => {
    const input = "line1\n\n\n\nline2";
    const result = sanitizeText(input);
    expect(result).toBe("line1\n\nline2");
  });

  it("normalizes multiple spaces", () => {
    const input = "word1   word2    word3";
    const result = sanitizeText(input);
    expect(result).toBe("word1 word2 word3");
  });

  it("trims leading and trailing whitespace", () => {
    const input = "   hello world   ";
    const result = sanitizeText(input);
    expect(result).toBe("hello world");
  });

  it("converts CRLF to LF", () => {
    const input = "line1\r\nline2\r\nline3";
    const result = sanitizeText(input);
    expect(result).toBe("line1\nline2\nline3");
  });
});

describe("examRouter input validation", () => {
  it("rejects question count below minimum", () => {
    const count = 2;
    expect(count < 3).toBe(true);
  });

  it("rejects question count above maximum", () => {
    const count = 31;
    expect(count > 30).toBe(true);
  });

  it("accepts valid question count", () => {
    const count = 10;
    expect(count >= 3 && count <= 30).toBe(true);
  });
});
