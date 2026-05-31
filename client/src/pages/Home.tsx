import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Award,
  Printer,
  RotateCcw,
  BookOpen,
  Sparkles,
  Info,
} from "lucide-react";

type AppState = "upload" | "loading" | "quiz" | "results";

interface QuestionData {
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string | null;
  orderIndex: number;
}

const FILE_TYPES = {
  pdf: { icon: FileText, label: "PDF", color: "text-red-500" },
  docx: { icon: FileSpreadsheet, label: "Word", color: "text-blue-500" },
  doc: { icon: FileSpreadsheet, label: "Word", color: "text-blue-500" },
  pptx: { icon: Presentation, label: "PowerPoint", color: "text-orange-500" },
  ppt: { icon: Presentation, label: "PowerPoint", color: "text-orange-500" },
};

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.ppt,.pptx";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateMutation = trpc.exam.generateFromFile.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
    },
    onError: (err) => {
      toast.error(err.message);
      setAppState("upload");
    },
  });

  const sessionQuery = trpc.exam.getSession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: false }
  );

  // React to session data changes via useEffect
  const sessionData = sessionQuery.data;
  const processedSessionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionData || appState !== "loading") return;
    const sid = sessionData.session.id;
    if (processedSessionRef.current === sid) return;
    if (sessionData.session.status === "ready") {
      processedSessionRef.current = sid;
      setQuestions(sessionData.questions as QuestionData[]);
      setAppState("quiz");
    } else if (sessionData.session.status === "error") {
      processedSessionRef.current = sid;
      toast.error("حدث خطأ أثناء توليد الأسئلة.");
      setAppState("upload");
    }
  }, [sessionData, appState]);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["pdf", "doc", "docx", "ppt", "pptx"].includes(ext)) {
      toast.error("نوع الملف غير مدعوم. يرجى رفع PDF أو Word أو PowerPoint.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 20 ميغابايت.");
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleGenerate = async () => {
    if (!selectedFile) return;
    setAppState("loading");

    const buffer = await selectedFile.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    generateMutation.mutate({
      fileName: selectedFile.name,
      fileType: selectedFile.type || "application/octet-stream",
      fileBase64: base64,
      questionCount,
    });
  };

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const getScore = () => {
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });
    return correct;
  };

  const getOptionClass = (q: QuestionData, option: string) => {
    const selected = answers[q.id] === option;
    if (!showResults) {
      return selected ? "option-radio selected" : "option-radio";
    }
    if (option === q.correctAnswer) return "option-radio correct";
    if (selected && option !== q.correctAnswer) return "option-radio wrong";
    return "option-radio";
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setAppState("upload");
    setSelectedFile(null);
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
    setShowExplanations(false);
  };

  const score = getScore();
  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const fileExt = selectedFile?.name.toLowerCase().split(".").pop() as keyof typeof FILE_TYPES | undefined;
  const FileIcon = fileExt ? FILE_TYPES[fileExt]?.icon ?? FileText : FileText;

  // ─── UPLOAD STATE ──────────────────────────────────────────────────────────
  if (appState === "upload") {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, oklch(0.97 0.005 250) 0%, oklch(0.93 0.015 75) 100%)" }}>
        {/* Header */}
        <header className="no-print" style={{ background: "oklch(0.22 0.08 260)", borderBottom: "1px solid oklch(0.30 0.08 260)" }}>
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center gold-gradient">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">مولّد أسئلة الامتحان</h1>
                <p className="text-xs" style={{ color: "oklch(0.72 0.15 75)" }}>بالذكاء الاصطناعي</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: "oklch(0.72 0.15 75 / 0.15)", color: "oklch(0.85 0.10 75)" }}>
              <Sparkles className="w-3.5 h-3.5" />
              مدعوم بالذكاء الاصطناعي
            </div>
          </div>
        </header>

        <main className="container py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ background: "oklch(0.72 0.15 75 / 0.12)", color: "oklch(0.55 0.15 65)", border: "1px solid oklch(0.72 0.15 75 / 0.3)" }}>
              <Sparkles className="w-4 h-4" />
              توليد أسئلة ذكية من ملفاتك
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              <span className="shimmer-text">أنشئ اختباراتك</span>
              <br />
              <span style={{ color: "oklch(0.22 0.08 260)" }}>في ثوانٍ معدودة</span>
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "oklch(0.50 0.03 250)" }}>
              ارفع ملفك وسيقوم الذكاء الاصطناعي بتحليل المحتوى وتوليد أسئلة اختيار من متعدد دقيقة ومتنوعة.
            </p>
          </div>

          {/* Upload Card */}
          <div className="max-w-2xl mx-auto">
            <div className="luxury-card rounded-2xl p-8">
              {/* Drop Zone */}
              <div
                className={`upload-zone rounded-xl p-10 text-center cursor-pointer mb-6 ${dragOver ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.72 0.15 75 / 0.15)" }}>
                      <FileIcon className="w-8 h-8" style={{ color: "oklch(0.65 0.18 65)" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-lg" style={{ color: "oklch(0.22 0.08 260)" }}>{selectedFile.name}</p>
                      <p className="text-sm mt-1" style={{ color: "oklch(0.50 0.03 250)" }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} ميغابايت
                      </p>
                    </div>
                    <button
                      className="text-sm underline"
                      style={{ color: "oklch(0.55 0.15 65)" }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      تغيير الملف
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.72 0.15 75 / 0.12)" }}>
                      <Upload className="w-10 h-10" style={{ color: "oklch(0.65 0.18 65)" }} />
                    </div>
                    <div>
                      <p className="font-bold text-xl mb-1" style={{ color: "oklch(0.22 0.08 260)" }}>اسحب الملف هنا أو انقر للرفع</p>
                      <p className="text-sm" style={{ color: "oklch(0.50 0.03 250)" }}>PDF · Word · PowerPoint · حتى 20 ميغابايت</p>
                    </div>
                    <div className="flex gap-3">
                      {[
                        { label: "PDF", color: "text-red-500", bg: "bg-red-50" },
                        { label: "Word", color: "text-blue-500", bg: "bg-blue-50" },
                        { label: "PowerPoint", color: "text-orange-500", bg: "bg-orange-50" },
                      ].map((t) => (
                        <span key={t.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${t.color} ${t.bg}`}>{t.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Question Count */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-semibold" style={{ color: "oklch(0.22 0.08 260)" }}>عدد الأسئلة</label>
                  <span className="text-2xl font-extrabold" style={{ color: "oklch(0.65 0.18 65)" }}>{questionCount}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={30}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to left, oklch(0.88 0.01 250) 0%, oklch(0.88 0.01 250) ${100 - ((questionCount - 3) / 27) * 100}%, oklch(0.72 0.15 75) ${100 - ((questionCount - 3) / 27) * 100}%, oklch(0.22 0.08 260) 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: "oklch(0.60 0.03 250)" }}>
                  <span>3</span>
                  <span>30</span>
                </div>
              </div>

              {/* Generate Button */}
              <button
                className="w-full py-4 rounded-xl text-lg font-bold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedFile}
                onClick={handleGenerate}
              >
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  توليد {questionCount} سؤال بالذكاء الاصطناعي
                </span>
              </button>

              {/* Info note */}
              <div className="flex items-start gap-2 mt-4 p-3 rounded-lg" style={{ background: "oklch(0.72 0.15 75 / 0.08)" }}>
                <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "oklch(0.65 0.18 65)" }} />
                <p className="text-xs" style={{ color: "oklch(0.50 0.03 250)" }}>
                  تُولَّد الأسئلة من محتوى ملفك فقط ولا تُستخدم أي مصادر خارجية.
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { icon: "🎯", title: "دقة عالية", desc: "أسئلة مبنية على المحتوى فقط" },
                { icon: "⚡", title: "توليد سريع", desc: "نتائج في ثوانٍ معدودة" },
                { icon: "📊", title: "تقييم فوري", desc: "نتيجة وتحليل مباشر" },
              ].map((f) => (
                <div key={f.title} className="luxury-card rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="font-bold text-sm mb-1" style={{ color: "oklch(0.22 0.08 260)" }}>{f.title}</p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.03 250)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── LOADING STATE ─────────────────────────────────────────────────────────
  if (appState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "linear-gradient(160deg, oklch(0.97 0.005 250) 0%, oklch(0.93 0.015 75) 100%)" }}>
        <div className="luxury-card rounded-2xl p-12 text-center max-w-md mx-4">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full gold-gradient opacity-20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center gold-gradient">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold mb-2" style={{ color: "oklch(0.22 0.08 260)" }}>جارٍ التحليل والتوليد</h3>
          <p className="mb-6" style={{ color: "oklch(0.50 0.03 250)" }}>
            يقوم الذكاء الاصطناعي بتحليل محتوى ملفك وتوليد {questionCount} سؤال...
          </p>
          <div className="space-y-3">
            {["استخراج النص من الملف", "تحليل المحتوى بالذكاء الاصطناعي", "توليد الأسئلة والخيارات"].map((step, i) => (
              <div key={step} className="flex items-center gap-3 text-sm p-3 rounded-lg" style={{ background: "oklch(0.95 0.01 75)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "oklch(0.72 0.15 75 / 0.2)" }}>
                  <span className="text-xs font-bold" style={{ color: "oklch(0.55 0.18 65)" }}>{i + 1}</span>
                </div>
                <span style={{ color: "oklch(0.35 0.05 250)" }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── QUIZ STATE ────────────────────────────────────────────────────────────
  if (appState === "quiz" && !showResults) {
    const q = questions[currentQuestion];
    const answered = Object.keys(answers).length;
    const progress = (answered / questions.length) * 100;

    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, oklch(0.97 0.005 250) 0%, oklch(0.93 0.015 75) 100%)" }}>
        {/* Header */}
        <header className="no-print sticky top-0 z-10" style={{ background: "oklch(0.22 0.08 260 / 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid oklch(0.30 0.08 260)" }}>
          <div className="container py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" style={{ color: "oklch(0.72 0.15 75)" }} />
                <span className="text-white font-semibold text-sm">{selectedFile?.name}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: "oklch(0.72 0.15 75)" }}>
                {answered}/{questions.length} مجاب
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "oklch(0.30 0.08 260)" }}>
              <div className="progress-bar h-1.5" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        <main className="container py-8 max-w-3xl">
          {/* Question Navigator */}
          <div className="flex flex-wrap gap-2 mb-6 no-print">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className="w-9 h-9 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: idx === currentQuestion
                    ? "oklch(0.72 0.15 75)"
                    : answers[questions[idx].id]
                    ? "oklch(0.22 0.08 260)"
                    : "white",
                  color: idx === currentQuestion || answers[questions[idx].id]
                    ? "white"
                    : "oklch(0.40 0.05 250)",
                  border: `1px solid ${idx === currentQuestion ? "oklch(0.72 0.15 75)" : "oklch(0.88 0.01 250)"}`,
                }}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {/* Question Card */}
          <div className="luxury-card rounded-2xl p-8 mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 gold-gradient">
                <span className="text-white font-extrabold text-sm">{currentQuestion + 1}</span>
              </div>
              <h3 className="text-xl font-bold leading-relaxed" style={{ color: "oklch(0.15 0.02 250)" }}>
                {q.questionText}
              </h3>
            </div>

            <div className="space-y-3">
              {(["A", "B", "C", "D"] as const).map((opt) => {
                const text = q[`option${opt}` as keyof QuestionData] as string;
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${getOptionClass(q, opt)}`}
                    style={{ borderColor: "oklch(0.88 0.01 250)" }}
                  >
                    <div className="relative shrink-0">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => handleAnswer(q.id, opt)}
                        className="sr-only"
                      />
                      <div
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{
                          borderColor: answers[q.id] === opt ? "oklch(0.65 0.18 65)" : "oklch(0.70 0.03 250)",
                          background: answers[q.id] === opt ? "oklch(0.72 0.15 75)" : "white",
                        }}
                      >
                        {answers[q.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "oklch(0.93 0.015 250)", color: "oklch(0.35 0.05 250)" }}>
                      {opt}
                    </span>
                    <span className="text-base leading-relaxed" style={{ color: "oklch(0.20 0.03 250)" }}>{text}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between no-print">
            <button
              onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
              disabled={currentQuestion === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 transition-all"
              style={{ background: "white", border: "1px solid oklch(0.88 0.01 250)", color: "oklch(0.35 0.05 250)" }}
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion((p) => Math.min(questions.length - 1, p + 1))}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold btn-primary"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => { setShowResults(true); setAppState("results"); }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold btn-gold"
              >
                <Award className="w-5 h-5" />
                إنهاء الاختبار وعرض النتيجة
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ─── RESULTS STATE ─────────────────────────────────────────────────────────
  if (appState === "results" || showResults) {
    const grade = percentage >= 90 ? "ممتاز" : percentage >= 75 ? "جيد جداً" : percentage >= 60 ? "جيد" : percentage >= 50 ? "مقبول" : "ضعيف";
    const gradeColor = percentage >= 90 ? "oklch(0.55 0.18 145)" : percentage >= 75 ? "oklch(0.55 0.18 200)" : percentage >= 60 ? "oklch(0.65 0.18 65)" : percentage >= 50 ? "oklch(0.65 0.15 50)" : "oklch(0.55 0.22 25)";

    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, oklch(0.97 0.005 250) 0%, oklch(0.93 0.015 75) 100%)" }}>
        {/* Print Header */}
        <div className="hidden print-only p-6 border-b">
          <h1 className="text-2xl font-bold">أسئلة اختبار - {selectedFile?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">تاريخ التوليد: {new Date().toLocaleDateString("ar-SA")}</p>
        </div>

        {/* Header */}
        <header className="no-print" style={{ background: "oklch(0.22 0.08 260)", borderBottom: "1px solid oklch(0.30 0.08 260)" }}>
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6" style={{ color: "oklch(0.72 0.15 75)" }} />
              <span className="text-white font-bold">نتيجة الاختبار</span>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={{ background: "oklch(0.30 0.08 260)", color: "oklch(0.85 0.10 75)" }}>
                <Printer className="w-4 h-4" />
                طباعة
              </button>
              <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold btn-gold">
                <RotateCcw className="w-4 h-4" />
                اختبار جديد
              </button>
            </div>
          </div>
        </header>

        <main className="container py-8 max-w-3xl">
          {/* Score Card */}
          <div className="luxury-card rounded-2xl p-8 mb-8 text-center no-print">
            <div className="relative w-36 h-36 mx-auto mb-6">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
                <circle cx="72" cy="72" r="60" fill="none" stroke="oklch(0.93 0.015 250)" strokeWidth="12" />
                <circle
                  cx="72" cy="72" r="60" fill="none"
                  stroke={gradeColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  strokeDashoffset={`${2 * Math.PI * 60 * (1 - percentage / 100)}`}
                  style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.23, 1, 0.32, 1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold" style={{ color: gradeColor }}>{percentage}%</span>
                <span className="text-sm font-semibold" style={{ color: "oklch(0.55 0.03 250)" }}>{grade}</span>
              </div>
            </div>
            <h3 className="text-2xl font-extrabold mb-2" style={{ color: "oklch(0.22 0.08 260)" }}>
              {score} / {questions.length} إجابة صحيحة
            </h3>
            <p style={{ color: "oklch(0.50 0.03 250)" }}>{selectedFile?.name}</p>

            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { label: "صحيح", value: score, color: "oklch(0.55 0.18 145)", bg: "oklch(0.95 0.05 145)" },
                { label: "خطأ", value: questions.length - score, color: "oklch(0.55 0.22 25)", bg: "oklch(0.97 0.04 25)" },
                { label: "لم يُجب", value: questions.length - Object.keys(answers).length, color: "oklch(0.55 0.03 250)", bg: "oklch(0.95 0.01 250)" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                  <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowExplanations(!showExplanations)}
              className="mt-6 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: "oklch(0.93 0.015 250)", color: "oklch(0.35 0.05 250)", border: "1px solid oklch(0.88 0.01 250)" }}
            >
              {showExplanations ? "إخفاء" : "عرض"} الإجابات والشرح
            </button>
          </div>

          {/* Questions Review */}
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id];
              const isCorrect = userAnswer === q.correctAnswer;
              const isUnanswered = !userAnswer;

              return (
                <div key={q.id} className="luxury-card rounded-2xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isUnanswered ? "oklch(0.93 0.015 250)" : isCorrect ? "oklch(0.95 0.05 145)" : "oklch(0.97 0.04 25)" }}>
                      {isUnanswered ? (
                        <span className="font-bold text-sm" style={{ color: "oklch(0.55 0.03 250)" }}>{idx + 1}</span>
                      ) : isCorrect ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: "oklch(0.55 0.18 145)" }} />
                      ) : (
                        <XCircle className="w-5 h-5" style={{ color: "oklch(0.55 0.22 25)" }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-base leading-relaxed mb-3" style={{ color: "oklch(0.15 0.02 250)" }}>
                        {idx + 1}. {q.questionText}
                      </p>
                      <div className="space-y-2">
                        {(["A", "B", "C", "D"] as const).map((opt) => {
                          const text = q[`option${opt}` as keyof QuestionData] as string;
                          const isCorrectOpt = opt === q.correctAnswer;
                          const isUserOpt = opt === userAnswer;
                          return (
                            <div
                              key={opt}
                              className="flex items-center gap-3 p-3 rounded-lg text-sm"
                              style={{
                                background: isCorrectOpt
                                  ? "oklch(0.95 0.05 145)"
                                  : isUserOpt && !isCorrectOpt
                                  ? "oklch(0.97 0.04 25)"
                                  : "oklch(0.97 0.005 250)",
                                border: `1px solid ${isCorrectOpt ? "oklch(0.75 0.12 145)" : isUserOpt && !isCorrectOpt ? "oklch(0.75 0.15 25)" : "oklch(0.90 0.01 250)"}`,
                              }}
                            >
                              <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0" style={{ background: isCorrectOpt ? "oklch(0.55 0.18 145)" : isUserOpt && !isCorrectOpt ? "oklch(0.55 0.22 25)" : "oklch(0.88 0.01 250)", color: isCorrectOpt || (isUserOpt && !isCorrectOpt) ? "white" : "oklch(0.40 0.05 250)" }}>
                                {opt}
                              </span>
                              <span style={{ color: "oklch(0.20 0.03 250)" }}>{text}</span>
                              {isCorrectOpt && <CheckCircle2 className="w-4 h-4 mr-auto shrink-0" style={{ color: "oklch(0.55 0.18 145)" }} />}
                              {isUserOpt && !isCorrectOpt && <XCircle className="w-4 h-4 mr-auto shrink-0" style={{ color: "oklch(0.55 0.22 25)" }} />}
                            </div>
                          );
                        })}
                      </div>
                      {showExplanations && q.explanation && (
                        <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: "oklch(0.95 0.01 75)", borderRight: "3px solid oklch(0.72 0.15 75)" }}>
                          <span className="font-semibold" style={{ color: "oklch(0.55 0.15 65)" }}>الشرح: </span>
                          <span style={{ color: "oklch(0.35 0.05 250)" }}>{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-4 mt-8 no-print">
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold" style={{ background: "white", border: "1px solid oklch(0.88 0.01 250)", color: "oklch(0.35 0.05 250)" }}>
              <Printer className="w-5 h-5" />
              طباعة / تصدير
            </button>
            <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold btn-gold">
              <RotateCcw className="w-5 h-5" />
              اختبار جديد
            </button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
