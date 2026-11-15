import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import type { StudentProfile as StudentProfileType, TestAttempt } from '../types/quiz';
import { formatCountdown } from '../utils/quizEngine';
import {
  analyzeStudentProgress,
  collectStudentMistakeBank,
} from '../utils/studentAnalytics';
import { ProgressLineChart, TrendBadge } from './AnalyticsPrimitives';

interface StudentProfileProps {
  student: StudentProfileType;
  onBackToUnits: () => void;
  onInspectAttempt: (attempt: TestAttempt) => void;
  onRetakeUnit: (unitNumber: number) => void;
}

type ProfileTab = 'history' | 'mistakes';

export function StudentProfile({
  student,
  onBackToUnits,
  onInspectAttempt,
  onRetakeUnit,
}: StudentProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('history');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const analytics = useMemo(
    () => analyzeStudentProgress(student.attempts),
    [student.attempts],
  );

  const mistakeBank = useMemo(
    () => collectStudentMistakeBank(student.attempts),
    [student.attempts],
  );

  function toggleReveal(questionId: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5">
        <button
          type="button"
          onClick={onBackToUnits}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Unitlarga qaytish</span>
        </button>
      </div>

      {/* Profile Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Shaxsiy profil · {student.className} sinf
            </div>
            <h1 className="font-display mt-1 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-50">
              {student.fullName}
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-5 border-t border-slate-200 pt-4 sm:border-t-0 sm:pt-0 sm:text-right dark:border-slate-800">
            <div>
              <div className="font-mono-tabular text-2xl font-bold text-sky-700 dark:text-sky-400">
                {student.totalPoints}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball</div>
            </div>
            <div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
                {student.completedUnits.length}/20
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Unitlar</div>
            </div>
            <div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
                {student.averagePercentage}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Oʻrtacha</div>
            </div>
          </div>
        </div>

        {/* Personal Growth KPIs + Chart */}
        {student.attempts.length > 0 && (
          <div className="mt-6 space-y-5 border-t border-slate-200 pt-6 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="text-xs text-emerald-800 dark:text-emerald-300">Eng yuqori</div>
                <div className="font-mono-tabular mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-200">
                  {analytics.bestAttempt?.percentage ?? 0}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs text-slate-500 dark:text-slate-400">Eng past</div>
                <div className="font-mono-tabular mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {analytics.worstAttempt?.percentage ?? 0}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs text-slate-500 dark:text-slate-400">Oʻsish / Tushish</div>
                <div className="mt-1 font-mono-tabular text-base font-bold">
                  <TrendBadge
                    delta={analytics.overallGrowthPct}
                    trend={analytics.overallTrend}
                    initialLabel="1 ta test"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs text-slate-500 dark:text-slate-400">Jami toʻgʻri / xato</div>
                <div className="font-mono-tabular mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {analytics.totalCorrect}
                  </span>
                  <span className="mx-1 text-slate-400">/</span>
                  <span className="text-red-700 dark:text-red-400">
                    {analytics.totalWrong}
                  </span>
                </div>
              </div>
            </div>

            {analytics.chronological.length >= 2 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Natijalaringiz oʻsishi va tushishi ({analytics.totalAttempts} ta test)</span>
                </div>
                <div className="w-full overflow-x-auto">
                  <ProgressLineChart items={analytics.chronological} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Tabs: Attempt History vs Mistake Bank */}
      <section className="mt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
            role="tablist"
            aria-label="Profil bo'limlari"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Ishlangan testlar ({student.attempts.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'mistakes'}
              onClick={() => setActiveTab('mistakes')}
              className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'mistakes'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Xatolar banki ({mistakeBank.length})
            </button>
          </div>

          <span className="hidden items-center gap-1 text-xs text-slate-500 sm:inline-flex dark:text-slate-400">
            <Award className="h-3.5 w-3.5" />
            Har bir unitdagi eng yuqori ball umumiy balga qoʻshiladi
          </span>
        </div>

        {activeTab === 'history' ? (
          analytics.newestFirst.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Siz hali birorta ham unit testini topshirmagansiz. Unitlar menyusidan boshlang!
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.newestFirst.map((entry) => {
                const attempt = entry.attempt;
                const dateLabel = new Date(attempt.completedAt).toLocaleString('uz-UZ', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <article
                    key={attempt.id}
                    data-testid={`history-attempt-${attempt.unitNumber}`}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono-tabular font-semibold text-sky-700 dark:text-sky-400">
                          Unit {attempt.unitNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{dateLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          Vaqt: {formatCountdown(attempt.durationSeconds)}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                        {attempt.unitTitle}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-medium tabular-nums">
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Toʻgʻri: {attempt.correctCount}
                        </span>
                        <span className="text-red-700 dark:text-red-400">
                          Xato: {attempt.wrongCount}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">
                          Ball: +{attempt.pointsEarned}
                        </span>
                        <TrendBadge
                          delta={entry.overallDeltaPct}
                          trend={entry.overallTrend}
                          initialLabel="Birinchi test"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-slate-100">
                        {attempt.percentage}%
                      </span>
                      <button
                        type="button"
                        onClick={() => onInspectAttempt(attempt)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Xatolarni koʻrish</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : mistakeBank.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <BookCheck className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Hozircha xato qilingan savollar yoʻq. Ajoyib!
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {mistakeBank.map((item) => {
              const isRevealed = revealedIds.has(item.questionId);
              return (
                <article
                  key={item.questionId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-semibold text-sky-700 dark:text-sky-400">
                        Unit {item.unitNumber}: {item.unitTitle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-red-700 dark:text-red-400">
                        {item.missCount} marta xato
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRetakeUnit(item.unitNumber)}
                      className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline dark:text-sky-400"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Unit {item.unitNumber} ni qayta ishlash</span>
                    </button>
                  </div>

                  <h3 className="mt-2 text-base font-semibold leading-relaxed text-slate-900 dark:text-slate-100">
                    {item.prompt}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleReveal(item.questionId)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {isRevealed ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Javobni yashirish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          <span>Toʻgʻri javobni koʻrish</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isRevealed && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Toʻgʻri javob: {item.correctAnswer}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {item.explanation}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
