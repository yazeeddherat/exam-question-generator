import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BookOpen, FileText, Loader2, Download, Printer, RotateCcw, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Language } from "@shared/types";

type AppState = "upload" | "loading" | "quiz" | "results";

interface QuestionData {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

const FILE_TYPES = {
  pdf: { name: "PDF", icon: FileText, color: "#dc2626" },
  doc: { name: "Word", icon: FileText, color: "#2563eb" },
  docx: { name: "Word", icon: FileText, color: "#2563eb" },
  ppt: { name: "PowerPoint", icon: FileText, color: "#ea580c" },
  pptx: { name: "PowerPoint", icon: FileText, color: "#ea580c" },
};

export default function Home() {
  const { user } = useAuth();

  const [appState, setAppState] = useState<AppState>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [language, setLanguage] = useState<Language>("en");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);
  const [quizTimeLeft, setQuizTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quizTimerRef = useRef<NodeJS.Timeout | null>(null);

  const generateMutation = trpc.exam.generateFromFile.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
    },
    onError: (err) => {
      toast.error(err.message);
      setAppState("upload");
    },
  });

  const getSessionQuery = trpc.exam.getSession.useQuery(
    { sessionId: sessionId || 0 },
    { enabled: sessionId !== null && appState === "loading" }
  );

  const getScore = () => {
    return questions.reduce((score, q, idx) => {
      return score + (answers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
  };

  const handleFileChange = (file: File) => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("حجم الملف يجب أن يكون أقل من 10 ميجابايت");
      return;
    }

    const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
    if (!validTypes.includes(file.type)) {
      toast.error("الملف يجب أن يكون PDF أو Word أو PowerPoint");
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleGenerateClick = async () => {
    if (!selectedFile) {
      toast.error("الرجاء اختيار ملف أولاً");
      return;
    }

    setAppState("loading");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const fileName = selectedFile.name;
        const fileType = fileExt || 'pdf';
        await generateMutation.mutateAsync({
          fileName,
          fileType,
          fileBase64: base64,
          questionCount,
          difficulty,
          language,
        });
      } catch (error) {
        console.error("Error:", error);
      }
    };
    reader.readAsDataURL(selectedFile);
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
    setDifficulty("medium");
    setQuizStarted(false);
    setQuizTimeLeft(0);
    if (quizTimerRef.current) clearInterval(quizTimerRef.current);
  };

  const getEstimatedTime = () => {
    const timePerQuestion = {
      easy: 1.5,
      medium: 2.5,
      hard: 4,
    };
    const baseTime = 8;
    const totalSeconds = baseTime + (questionCount * timePerQuestion[difficulty]);
    return Math.ceil(totalSeconds);
  };

  const [timeLeft, setTimeLeft] = useState(getEstimatedTime());

  useEffect(() => {
    if (appState !== "loading") return;
    setTimeLeft(getEstimatedTime());
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [appState, questionCount, difficulty]);

  // حساب الوقت الكلي للاختبار بناءً على مستوى الصعوبة وعدد الأسئلة
  const getTotalQuizTime = () => {
    const timePerQuestion = {
      easy: 60,      // دقيقة واحدة للسؤال السهل
      medium: 90,    // دقيقة ونصف للسؤال المتوسط
      hard: 120,     // دقيقتان للسؤال الصعب
    };
    return questions.length * timePerQuestion[difficulty];
  };

  // بدء مؤقت الاختبار عند الدخول لصفحة الأسئلة
  useEffect(() => {
    if (appState === "quiz" && !quizStarted && questions.length > 0) {
      const totalTime = getTotalQuizTime();
      setQuizTimeLeft(totalTime);
      setQuizStarted(true);
    }
  }, [appState, questions.length, quizStarted]);

  // مؤقت الاختبار
  useEffect(() => {
    if (!quizStarted || appState !== "quiz" || showResults) return;

    quizTimerRef.current = setInterval(() => {
      setQuizTimeLeft((prev) => {
        if (prev <= 1) {
          setShowResults(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (quizTimerRef.current) clearInterval(quizTimerRef.current);
    };
  }, [quizStarted, appState, showResults]);

  useEffect(() => {
    if (getSessionQuery.data) {
      const mappedQuestions = getSessionQuery.data.questions.map(q => ({
        id: q.id,
        question: q.questionText,
        options: [q.optionA, q.optionB, q.optionC, q.optionD],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
      }));
      setQuestions(mappedQuestions);
      setAppState("quiz");
    }
  }, [getSessionQuery.data]);

  const handleAnswerChange = (answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion]: answer,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const getRadioClass = (optionIndex: number) => {
    return "option-radio";
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
              </div>
            </div>

          </div>
        </header>

        <main className="container py-12">
          {/* Hero */}
          <div className="text-center mb-12">

            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              <span className="shimmer-text">أنشئ اختباراتك</span>
              <br />
              <span style={{ color: "oklch(0.22 0.08 260)" }}>في ثوانٍ معدودة</span>
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "oklch(0.50 0.03 250)" }}>
              ارفع ملفك وسيقوم الذكاء الاصطناعي بتحليل المحتوى وتوليد أسئلة اختيار من متعدد دقيقة ومتنوعة.
            </p>
          </div>

          {/* Main Card */}
          <div className="max-w-2xl mx-auto">
            <div className="luxury-card rounded-3xl p-8 md:p-12">
              {/* File Upload */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="mb-8 p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
                style={{
                  borderColor: dragOver ? "oklch(0.72 0.15 75)" : "oklch(0.72 0.15 75 / 0.3)",
                  background: dragOver ? "oklch(0.72 0.15 75 / 0.05)" : "oklch(0.95 0.01 75)",
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center gold-gradient">
                    <FileIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: "oklch(0.22 0.08 260)" }}>
                      {selectedFile ? selectedFile.name : "اسحب الملف هنا أو انقر للرفع"}
                    </p>
                    <p className="text-sm" style={{ color: "oklch(0.50 0.03 250)" }}>
                      PDF · Word · PowerPoint (حتى 20 ميجابايت)
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {/* Question Count */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-base font-bold" style={{ color: "oklch(0.22 0.08 260)" }}>
                    عدد الأسئلة
                  </Label>
                  <span className="text-2xl font-extrabold" style={{ color: "oklch(0.72 0.15 75)" }}>
                    {questionCount}
                  </span>
                </div>
                <Slider
                  value={[questionCount]}
                  onValueChange={(v) => setQuestionCount(v[0])}
                  min={3}
                  max={30}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Difficulty */}
              <div className="mb-8">
                <Label className="block text-base font-bold mb-4" style={{ color: "oklch(0.22 0.08 260)" }}>
                  مستوى صعوبة الأسئلة
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "easy", label: "سهل", color: "oklch(0.55 0.18 65)", emoji: "🟢" },
                    { value: "medium", label: "متوسط", color: "oklch(0.72 0.15 75)", emoji: "🟡" },
                    { value: "hard", label: "صعب", color: "oklch(0.60 0.20 30)", emoji: "🔴" },
                  ].map(({ value, label, color, emoji }) => (
                    <div
                      key={value}
                      onClick={() => setDifficulty(value as "easy" | "medium" | "hard")}
                      className="p-4 rounded-xl border-2 transition-all cursor-pointer text-center"
                      style={{
                        borderColor: difficulty === value ? color : "oklch(0.85 0.05 250)",
                        background: difficulty === value ? `${color}15` : "white",
                      }}
                    >
                      <div className="text-2xl mb-1">{emoji}</div>
                      <p className="font-bold text-sm" style={{ color: difficulty === value ? color : "oklch(0.35 0.05 250)" }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="mb-8">
                <Label className="block text-base font-bold mb-4" style={{ color: "oklch(0.22 0.08 260)" }}>
                  لغة الأسئلة
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "ar", label: "العربية", flag: "🇸🇦" },
                    { value: "en", label: "English", flag: "🇬🇧" },
                  ].map(({ value, label, flag }) => (
                    <div
                      key={value}
                      onClick={() => setLanguage(value as Language)}
                      className="p-4 rounded-xl border-2 transition-all cursor-pointer text-center"
                      style={{
                        borderColor: language === value ? "oklch(0.72 0.15 75)" : "oklch(0.85 0.05 250)",
                        background: language === value ? "oklch(0.72 0.15 75 / 0.15)" : "white",
                      }}
                    >
                      <div className="text-2xl mb-1">{flag}</div>
                      <p className="font-bold text-sm" style={{ color: language === value ? "oklch(0.72 0.15 75)" : "oklch(0.35 0.05 250)" }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateClick}
                disabled={!selectedFile || generateMutation.isPending}
                className="w-full py-6 text-lg font-bold rounded-xl transition-all"
                style={{
                  background: selectedFile ? "oklch(0.72 0.15 75)" : "oklch(0.72 0.15 75 / 0.5)",
                  color: "white",
                }}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                    جاري التحضير...
                  </>
                ) : (
                  "توليد الأسئلة"
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── LOADING STATE ─────────────────────────────────────────────────────────
  if (appState === "loading") {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const difficultyLabel = difficulty === "easy" ? "سهل" : difficulty === "medium" ? "متوسط" : "صعب";

    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "linear-gradient(160deg, oklch(0.97 0.005 250) 0%, oklch(0.93 0.015 75) 100%)" }}>
        <div className="luxury-card rounded-2xl p-12 text-center max-w-md mx-4">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full gold-gradient opacity-20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center gold-gradient">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold mb-2" style={{ color: "oklch(0.22 0.08 260)" }}>جاري التحضير</h3>
          <p className="mb-6" style={{ color: "oklch(0.50 0.03 250)" }}>
            يتم تحضير {questionCount} سؤال ({difficultyLabel}) للاختبار...
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
    const quizMinutes = Math.floor(quizTimeLeft / 60);
    const quizSeconds = quizTimeLeft % 60;

    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, oklch(0.97 0.005 250) 0%, oklch(0.93 0.015 75) 100%)" }}>
        {/* Header */}
        <header className="no-print sticky top-0 z-50" style={{ background: "oklch(0.22 0.08 260)", borderBottom: "1px solid oklch(0.30 0.08 260)" }}>
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center gold-gradient">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">الاختبار</h1>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: quizTimeLeft < 300 ? "oklch(0.60 0.20 30 / 0.2)" : "oklch(0.72 0.15 75 / 0.2)" }}>
              <Clock className="w-5 h-5" style={{ color: quizTimeLeft < 300 ? "oklch(0.60 0.20 30)" : "oklch(0.72 0.15 75)" }} />
              <span className="font-bold text-white">
                {String(quizMinutes).padStart(2, "0")}:{String(quizSeconds).padStart(2, "0")}
              </span>
            </div>
          </div>
        </header>

        <main className="container py-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span style={{ color: "oklch(0.35 0.05 250)" }}>
                السؤال {currentQuestion + 1} من {questions.length}
              </span>
              <span style={{ color: "oklch(0.72 0.15 75)" }} className="font-bold">
                {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: "oklch(0.85 0.05 250)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${((currentQuestion + 1) / questions.length) * 100}%`,
                  background: "oklch(0.72 0.15 75)",
                }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="max-w-2xl mx-auto">
            <div className="luxury-card rounded-3xl p-8 md:p-12 mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-8" style={{ color: "oklch(0.22 0.08 260)" }}>
                {q.question}
              </h2>

              {/* Options */}
              <RadioGroup value={answers[currentQuestion] || ""} onValueChange={handleAnswerChange}>
                <div className="space-y-4">
                  {q.options.map((option, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer"
                      style={{
                        borderColor: answers[currentQuestion] === option ? "oklch(0.72 0.15 75)" : "oklch(0.85 0.05 250)",
                        background: answers[currentQuestion] === option ? "oklch(0.72 0.15 75 / 0.1)" : "white",
                      }}
                      onClick={() => handleAnswerChange(option)}
                    >
                      <RadioGroupItem value={option} id={`option-${idx}`} className={getRadioClass(idx)} />
                      <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer font-medium">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 justify-between">
              <Button
                onClick={handlePrevQuestion}
                disabled={currentQuestion === 0}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                السابق
              </Button>

              <Button
                onClick={handleNextQuestion}
                className="flex-1"
                style={{ background: "oklch(0.72 0.15 75)", color: "white" }}
              >
                {currentQuestion === questions.length - 1 ? "إنهاء الاختبار" : "التالي"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── RESULTS STATE ─────────────────────────────────────────────────────────
  if (appState === "quiz" && showResults) {
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
                <h1 className="text-white font-bold text-lg">النتائج</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-12">
          {/* Score Card */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="luxury-card rounded-3xl p-12 text-center mb-8">
              <div className="mb-8">
                <div className="w-40 h-40 mx-auto rounded-full flex items-center justify-center gold-gradient mb-6">
                  <div className="text-center">
                    <div className="text-5xl font-extrabold text-white">{percentage}%</div>
                    <div className="text-white text-sm mt-2">
                      {score}/{questions.length}
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-extrabold mb-2" style={{ color: "oklch(0.22 0.08 260)" }}>
                {percentage >= 80 ? "ممتاز!" : percentage >= 60 ? "جيد" : "يمكن تحسينه"}
              </h2>
              <p className="text-lg" style={{ color: "oklch(0.50 0.03 250)" }}>
                لقد أجبت على {score} من {questions.length} أسئلة بشكل صحيح
              </p>

              {/* Difficulty & Language */}
              <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t" style={{ borderColor: "oklch(0.85 0.05 250)" }}>
                <div>
                  <p className="text-sm" style={{ color: "oklch(0.50 0.03 250)" }}>مستوى الصعوبة</p>
                  <p className="font-bold" style={{ color: "oklch(0.22 0.08 260)" }}>
                    {difficulty === "easy" ? "سهل" : difficulty === "medium" ? "متوسط" : "صعب"}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: "oklch(0.50 0.03 250)" }}>اللغة</p>
                  <p className="font-bold" style={{ color: "oklch(0.22 0.08 260)" }}>
                    {language === "ar" ? "العربية" : "English"}
                  </p>
                </div>
              </div>
            </div>

            {/* Toggle Explanations */}
            <div className="text-center mb-8">
              <Button
                onClick={() => setShowExplanations(!showExplanations)}
                variant="outline"
                className="rounded-xl"
              >
                {showExplanations ? "إخفاء الشروحات" : "عرض الشروحات"}
              </Button>
            </div>

            {/* Questions Review */}
            {showExplanations && (
              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={idx} className="luxury-card rounded-2xl p-6">
                    <div className="flex gap-3 mb-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{
                          background: answers[idx] === q.correctAnswer ? "oklch(0.55 0.18 65)" : "oklch(0.60 0.20 30)",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold mb-2" style={{ color: "oklch(0.22 0.08 260)" }}>
                          {q.question}
                        </p>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span style={{ color: "oklch(0.50 0.03 250)" }}>إجابتك: </span>
                            <span style={{ color: answers[idx] === q.correctAnswer ? "oklch(0.55 0.18 65)" : "oklch(0.60 0.20 30)" }} className="font-bold">
                              {answers[idx] || "لم تجب"}
                            </span>
                          </p>
                          <p>
                            <span style={{ color: "oklch(0.50 0.03 250)" }}>الإجابة الصحيحة: </span>
                            <span style={{ color: "oklch(0.55 0.18 65)" }} className="font-bold">
                              {q.correctAnswer}
                            </span>
                          </p>
                          <p style={{ color: "oklch(0.50 0.03 250)" }} className="mt-3 italic">
                            {q.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mt-12 no-print">
              <Button
                onClick={handlePrint}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                <Printer className="w-4 h-4 mr-2" />
                طباعة
              </Button>
              <Button
                onClick={handleReset}
                className="flex-1 rounded-xl"
                style={{ background: "oklch(0.72 0.15 75)", color: "white" }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                اختبار جديد
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
