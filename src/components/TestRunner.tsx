import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Grid2X2,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import type { ShuffledQuestion, UnitData } from '../types/quiz';
import {
  DEFAULT_TEST_DURATION_MINUTES,
  formatCountdown,
  gradeQuiz,
  prepareShuffledQuiz,
  type GradeQuizResult,
} from '../utils/quizEngine';

import {
  isFullscreenActive,
  requestAppFullscreen,
} from '../utils/antiCheat';

interface TestRunnerProps {
  unit: UnitData;
  testDurationMinutes?: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onFinishTest: (result: GradeQuizResult, elapsedSeconds: number) => Promise<void>;
  onCancelTest: () => void;
  onTriggerCheaterLock: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function TestRunner({
  unit,
  testDurationMinutes = DEFAULT_TEST_DURATION_MINUTES,
  darkMode,
  onToggleDarkMode,
  onFinishTest,
  onCancelTest,
  onTriggerCheaterLock,
}: TestRunnerProps) {
  const totalDurationSeconds = Math.max(60, Math.round(testDurationMinutes * 60));
  // Shuffle questions & options once when the test mounts
  const shuffledQuestions: ShuffledQuestion[] = useMemo(
    () => prepareShuffledQuiz(unit.questions),
    [unit],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const [secondsLeft, setSecondsLeft] = useState(totalDurationSeconds);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submittedRef = useRef(false);
  const exitingLegitRef = useRef(false);
  const fullscreenEnteredRef = useRef(isFullscreenActive());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const secondsLeftRef = useRef(secondsLeft);
  secondsLeftRef.current = secondsLeft;

  const currentQuestion = shuffledQuestions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const totalCount = shuffledQuestions.length;
  const isCurrentFlagged = currentQuestion ? flaggedIds.has(currentQuestion.id) : false;

  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  const executeSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const graded = gradeQuiz(shuffledQuestions, answersRef.current);
      const elapsed = Math.max(1, totalDurationSeconds - secondsLeftRef.current);
      await onFinishTest(graded, elapsed);
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError(
        err instanceof Error ? err.message : "Natijani saqlashda xatolik yuz berdi.",
      );
    }
  }, [shuffledQuestions, onFinishTest, totalDurationSeconds]);

  // Enforce fullscreen anti-cheat lock: exiting fullscreen locks test immediately
  useEffect(() => {
    if (isFullscreenActive()) {
      fullscreenEnteredRef.current = true;
    }

    function handleFullscreenChange() {
      if (isFullscreenActive()) {
        fullscreenEnteredRef.current = true;
        return;
      }
      if (
        fullscreenEnteredRef.current &&
        !submittedRef.current &&
        !exitingLegitRef.current
      ) {
        onTriggerCheaterLock();
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [onTriggerCheaterLock]);

  // Configurable countdown timer (15 minutes default)
  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          void executeSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [executeSubmit]);

  // Keyboard shortcuts for desktop comfort (1-4 / A-D to pick, F to flag, arrows to navigate)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (confirmExit || confirmSubmit || showNavDrawer) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const key = e.key.toLowerCase();
      if (key === '1' || key === 'a') selectOption(0);
      else if (key === '2' || key === 'b') selectOption(1);
      else if (key === '3' || key === 'c') selectOption(2);
      else if (key === '4' || key === 'd') selectOption(3);
      else if (key === 'f' && currentQuestion) toggleFlag(currentQuestion.id);
      else if (e.key === 'ArrowRight' && currentIndex < totalCount - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function selectOption(optionIdx: number) {
    if (!currentQuestion || submitting) return;
    if (!fullscreenEnteredRef.current && !isFullscreenActive()) {
      void requestAppFullscreen();
    }
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIdx,
    }));
  }

  const isTimeLow = secondsLeft <= 60;
  const progressPercent = Math.round(((currentIndex + 1) / totalCount) * 100);
  const selectedOptionIndex = currentQuestion ? answers[currentQuestion.id] : undefined;

  return (
    <div className="obsidian-stage flex min-h-screen flex-col text-slate-900 dark:text-slate-100">
      {/* Slim single-row test bar (compact height so maximum viewport goes to reading the test) */}
      <header className="gloss-header sticky top-0 z-30">
        <div className="mx-auto flex h-13 max-w-4xl items-center justify-between gap-3 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmExit(true)}
              aria-label="Testdan chiqish"
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
            <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
              Unit {unit.unitNumber}: {unit.title}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span
              data-testid="question-counter"
              className="font-mono-tabular text-xs font-semibold text-slate-600 sm:text-sm dark:text-slate-300"
            >
              {currentIndex + 1}/{totalCount}
            </span>

            <div
              data-testid="countdown-timer"
              aria-live="off"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono-tabular text-xs font-semibold sm:text-sm ${
                isTimeLow
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-950/50 dark:text-red-300'
                  : 'border-slate-200 bg-slate-50/90 text-slate-800 dark:border-white/15 dark:bg-black/45 dark:text-slate-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{formatCountdown(secondsLeft)}</span>
            </div>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? "Kunduzgi rejim" : "Tun rejimi"}
              className="gloss-btn-secondary inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 dark:text-slate-200"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Hairline luminous progress bar */}
        <div className="h-0.5 w-full bg-slate-200/70 dark:bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-200 dark:shadow-[0_0_12px_rgba(56,189,248,0.65)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Spacious Question & Options Stage */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between px-4 py-6 sm:px-6 sm:py-10">
        <div className="my-auto">
          <div className="gloss-panel rounded-2xl p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3 font-mono-tabular">
                <span>
                  Savol {currentIndex + 1} / {totalCount}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Belgilangan: {answeredCount} / {totalCount}
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleFlag(currentQuestion.id)}
                aria-pressed={isCurrentFlagged}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isCurrentFlagged
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-400/60 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'gloss-btn-secondary text-slate-600 dark:text-slate-300'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>{isCurrentFlagged ? 'Belgilab qoʻyilgan' : 'Belgilab qoʻyish'}</span>
              </button>
            </div>

            <h1
              data-testid="question-prompt"
              className="mt-4 text-lg font-semibold leading-relaxed text-slate-900 sm:text-xl dark:text-white"
            >
              {currentQuestion.prompt}
            </h1>

            {/* 4 spacious answer choices — NO immediate right/wrong indication */}
            <div
              className="mt-6 space-y-3"
              role="radiogroup"
              aria-label={`Savol ${currentIndex + 1} javob variantlari`}
            >
              {currentQuestion.options.map((optionText, idx) => {
                const isSelected = selectedOptionIndex === idx;
                return (
                  <button
                    key={`${currentQuestion.id}-opt-${idx}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectOption(idx)}
                    className={`flex min-h-[54px] w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/90 text-slate-900 shadow-xs dark:border-sky-400/80 dark:bg-[#0c1d38] dark:bg-gradient-to-b dark:from-sky-500/25 dark:to-sky-900/35 dark:text-white dark:shadow-[inset_0_1px_0_rgba(186,230,253,0.32),0_12px_28px_-12px_rgba(56,189,248,0.45)]'
                        : 'border-slate-200 bg-white/85 text-slate-800 hover:border-sky-300 hover:bg-slate-50 dark:border-white/10 dark:bg-black/35 dark:text-slate-200 dark:hover:border-sky-400/35 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono-tabular text-xs font-bold transition-colors ${
                        isSelected
                          ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950'
                          : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-400'
                      }`}
                    >
                      {OPTION_LETTERS[idx]}
                    </span>
                    <span className="flex-1 text-base leading-snug">{optionText}</span>
                  </button>
                );
              })}
            </div>

            {submitError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
              >
                {submitError}
              </div>
            )}
          </div>
        </div>

        {/* Clean Action Footer */}
        <div className="mt-6 space-y-2.5 pt-2">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0 || submitting}
              className="gloss-btn-secondary inline-flex min-h-[46px] items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap dark:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Oldingi</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNavDrawer(true)}
              className="gloss-btn-secondary inline-flex min-h-[46px] items-center gap-2 rounded-xl px-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap sm:text-sm dark:text-slate-200"
            >
              <Grid2X2 className="h-4 w-4" />
              <span>
                Savollar{flaggedIds.size > 0 ? ` (${flaggedIds.size} belgi)` : ''}
              </span>
            </button>

            {currentIndex < totalCount - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(totalCount - 1, i + 1))}
                disabled={submitting}
                className="gloss-btn-primary inline-flex min-h-[46px] items-center gap-1.5 rounded-xl px-5 text-sm font-semibold whitespace-nowrap"
              >
                <span>Keyingi</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSubmit(true)}
                disabled={submitting}
                className="gloss-btn-emerald inline-flex min-h-[46px] items-center gap-1.5 rounded-xl px-5 text-sm font-semibold whitespace-nowrap"
              >
                <Check className="h-4 w-4" />
                <span>Yakunlash</span>
              </button>
            )}
          </div>

          <p className="hidden text-center text-[11px] text-slate-400 sm:block dark:text-slate-500">
            Klaviatura: A–D yoki 1–4 — javob tanlash · ← → — savollar orasida oʻtish · F — keyinga belgilash
          </p>
        </div>
      </main>

      {/* Question Navigator Drawer Modal */}
      {showNavDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Savollar xaritasi"
        >
          <div className="gloss-panel w-full max-w-md rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Savollar ({answeredCount}/{totalCount} javob berilgan)
                </h2>
                {flaggedIds.size > 0 && (
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    Tekshirish uchun belgilangan: {flaggedIds.size} ta savol
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNavDrawer(false)}
                aria-label="Savollar xaritasini yopish"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-6 gap-2">
              {shuffledQuestions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isFlagged = flaggedIds.has(q.id);
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowNavDrawer(false);
                    }}
                    className={`relative min-h-[42px] rounded-lg border font-mono-tabular text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'gloss-btn-primary border-sky-400 text-white'
                        : isFlagged
                          ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-400/60 dark:bg-amber-950/50 dark:text-amber-200'
                          : isAnswered
                            ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-black/40 dark:text-slate-400 dark:hover:bg-white/10'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <Bookmark className="absolute top-1 right-1 h-2.5 w-2.5 fill-current" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Sariq — belgilangan · Koʻk — javob berilgan
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowNavDrawer(false);
                  setConfirmSubmit(true);
                }}
                className="gloss-btn-emerald min-h-[42px] rounded-xl px-4 text-xs font-semibold whitespace-nowrap"
              >
                Testni yakunlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {confirmSubmit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Testni yakunlashni tasdiqlash"
        >
          <div className="gloss-panel w-full max-w-sm rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Testni yakunlaysizmi?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Siz {totalCount} ta savoldan{' '}
              <strong className="font-mono-tabular text-slate-900 dark:text-white">
                {answeredCount}
              </strong>{' '}
              tasiga javob belgiladingiz.
              {answeredCount < totalCount &&
                ` Javob berilmagan ${totalCount - answeredCount} ta savol xato sifatida hisoblanadi.`}
            </p>
            {flaggedIds.size > 0 && (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                Diqqat: tekshirish uchun belgilab qoʻyilgan {flaggedIds.size} ta savol bor.
              </p>
            )}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                disabled={submitting}
                className="gloss-btn-secondary min-h-[42px] rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Qaytish
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSubmit(false);
                  void executeSubmit();
                }}
                disabled={submitting}
                className="gloss-btn-emerald min-h-[42px] rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? 'Saqlanmoqda...' : 'Natijani koʻrish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel / Exit Confirmation Modal */}
      {confirmExit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Testdan chiqishni tasdiqlash"
        >
          <div className="gloss-panel w-full max-w-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Testni bekor qilasizmi?
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Hozir chiqsangiz, ushbu testdagi belgilangan javoblar saqlanmaydi.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="gloss-btn-secondary min-h-[42px] rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Davom etish
              </button>
              <button
                type="button"
                onClick={() => {
                  exitingLegitRef.current = true;
                  onCancelTest();
                }}
                className="min-h-[42px] rounded-xl border border-red-400/40 bg-gradient-to-b from-red-500 to-red-700 px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-110"
              >
                Chiqish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
