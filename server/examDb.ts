import { eq } from "drizzle-orm";
import { examSessions, InsertExamSession, InsertQuestion, questions } from "../drizzle/schema";
import { getDb } from "./db";

export async function createExamSession(data: InsertExamSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(examSessions).values(data).$returningId();
  return result.id;
}

export async function updateSessionStatus(
  sessionId: number,
  status: "pending" | "processing" | "ready" | "error"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(examSessions).set({ status }).where(eq(examSessions.id, sessionId));
}

export async function getExamSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(examSessions).where(eq(examSessions.id, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function insertQuestions(questionList: InsertQuestion[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(questions).values(questionList);
}

export async function getSessionQuestions(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(questions.orderIndex);
}
