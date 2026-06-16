import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import {
  createExamSession,
  getExamSession,
  getSessionQuestions,
  insertQuestions,
  updateSessionStatus,
} from "../examDb";
import { detectFileType, extractTextFromBuffer, sanitizeText } from "../fileExtractor";
import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

interface GeneratedQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
}

type DifficultyLevel = "easy" | "medium" | "hard";

async function generateQuestionsFromText(
  text: string,
  count: number,
  difficulty: DifficultyLevel = "medium",
  language: "ar" | "en" = "en"
): Promise<GeneratedQuestion[]> {
  const truncatedText = text.slice(0, 12000);

  const difficultyInstructions = {
    easy: "Questions should be easy and test basic understanding and direct information from the text. Avoid complex questions and fine details.",
    medium: "Questions should be of medium difficulty and test understanding and application. Use information from the text with some analysis.",
    hard: "Questions should be difficult and test deep analysis and connections between concepts. Use detailed and complex information from the text.",
  };

  const languageInstruction = language === "ar" 
    ? "IMPORTANT: Generate ALL questions, options, and explanations ONLY in Arabic. No other language is allowed."
    : "IMPORTANT: Generate ALL questions, options, and explanations ONLY in English. No other language is allowed.";

  const systemPrompt = `You are an educational assistant specialized in creating multiple-choice exam questions.
Your task: Create accurate and diverse exam questions based solely on the provided text.
Difficulty level: ${difficulty}
${difficultyInstructions[difficulty]}

Strict rules:
- Use only information contained in the provided text
- Do not add external information
- Ensure correct answers are randomly distributed across options A, B, C, and D
- Make incorrect options plausible and not obviously wrong
- Questions should test real understanding, not surface memorization
- ${languageInstruction}`

  const userPrompt = `Based solely on the following text, create ${count} multiple-choice questions. ${languageInstruction}

Text:
"""
${truncatedText}
"""

Return the response as valid JSON (without any additional text) in this format:
{
  "questions": [
    {
      "question": "Question text",
      "options": {
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      },
      "correct": "A",
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "exam_questions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: {
                    type: "object",
                    properties: {
                      A: { type: "string" },
                      B: { type: "string" },
                      C: { type: "string" },
                      D: { type: "string" },
                    },
                    required: ["A", "B", "C", "D"],
                    additionalProperties: false,
                  },
                  correct: { type: "string", enum: ["A", "B", "C", "D"] },
                  explanation: { type: "string" },
                },
                required: ["question", "options", "correct", "explanation"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("No response from AI");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  try {
    const parsed = JSON.parse(content) as { questions: GeneratedQuestion[] };
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid response format: questions array not found");
    }
    return parsed.questions.slice(0, count);
  } catch (parseError) {
    console.error("[LLM Response]", content);
    console.error("[Parse Error]", parseError);
    throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
  }
}

export const examRouter = router({
  // Upload file and generate questions
  generateFromFile: publicProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        fileType: z.string().min(1),
        fileBase64: z.string().min(1),
        questionCount: z.number().int().min(3).max(30).default(10),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        language: z.enum(["ar", "en"]).default("en"),
      })
    )
    .mutation(async ({ input }) => {
      const { fileName, fileType: mimeType, fileBase64, questionCount, difficulty, language } = input;

      // Detect file type
      const fileType = detectFileType(fileName, mimeType);
      if (!fileType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "نوع الملف غير مدعوم. يرجى رفع ملف PDF أو Word أو PowerPoint.",
        });
      }

      // Decode base64 to buffer
      // Handle DataURL format (data:application/pdf;base64,xxx) by extracting the base64 part
      const b64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const buffer = Buffer.from(b64, "base64");

      // Check file size (max 1GB)
      if (buffer.length > 1024 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "حجم الملف يتجاوز الحد المسموح (1 جيجابايت).",
        });
      }

      // Create session
      const sessionId = await createExamSession({
        fileName,
        fileType,
        questionCount,
        difficulty,
        status: "processing",
      });

      try {
        // Upload file to storage - sanitize filename to ASCII only
        const sanitizedFileName = fileName
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .substring(0, 50);
        const fileKey = `exam-files/${sessionId}-${Date.now()}-${sanitizedFileName}`;
        await storagePut(fileKey, buffer, mimeType);

        // Extract text
        const rawText = await extractTextFromBuffer(buffer, fileType);
        const cleanText = sanitizeText(rawText);

        if (cleanText.length < 100) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لم يتم العثور على نص كافٍ في الملف لتوليد الأسئلة.",
          });
        }

        // Generate questions with AI
        const generatedQuestions = await generateQuestionsFromText(cleanText, questionCount, difficulty, language);

        if (generatedQuestions.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "فشل توليد الأسئلة. يرجى المحاولة مرة أخرى.",
          });
        }

        // Save questions to DB
        await insertQuestions(
          generatedQuestions.map((q, idx) => ({
            sessionId,
            questionText: q.question,
            optionA: q.options.A,
            optionB: q.options.B,
            optionC: q.options.C,
            optionD: q.options.D,
            correctAnswer: q.correct,
            explanation: q.explanation,
            orderIndex: idx,
          }))
        );

        await updateSessionStatus(sessionId, "ready");

        return { sessionId, questionCount: generatedQuestions.length, difficulty };
      } catch (error) {
        await updateSessionStatus(sessionId, "error");
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `حدث خطأ أثناء معالجة الملف: ${(error as Error).message}`,
        });
      }
    }),

  // Get session with questions
  getSession: publicProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const session = await getExamSession(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة." });
      }
      const questionList = await getSessionQuestions(input.sessionId);
      return { session, questions: questionList, difficulty: session.difficulty };
    }),
});
