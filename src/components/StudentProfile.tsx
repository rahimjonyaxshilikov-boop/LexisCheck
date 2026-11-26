import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Play,
  RotateCcw,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { StudentProfile as StudentProfileType, TestAttempt } from '../types/quiz';
import { ALL_UNITS } from '../data/units';
import {
  formatCountdown,
  getStudentMasteryRank,
  TOTAL_UNITS,
} from '../utils/quizEngine';
import {
  analyzeStudentProgress,
  collectStudentMistakeBank,
} from '../utils/studentAnalytics';
import { ProgressLineChart, TrendBadge } from './AnalyticsPrimitives';

interface StudentProfileProps {
  student: StudentProfileType;
  welcomeBackNotice?: boolean;
  onDismissWelcomeBack?: () => void;
  onBackToUnits: () => void;
  onInspectAttempt: (attempt: TestAttempt) => void;
  onRetakeUnit: (unitNumber: number) => void;
}

type ProfileTab = 'history' | 'mistakes';

export function StudentProfile({
  student,
  welcomeBackNotice = false,
  onDismissWelcomeBack,
  onBackToUnits,
  onInspectAttempt,
  onRetakeUnit,
}: StudentProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('history');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillIdx, setDrillIdx] = useState(0);
  const [drillSelectedOpt, setDrillSelectedOpt] = useState<string | null>(null);
  const [drillScore, setDrillScore] = useState(0);

  const analytics = useMemo(
    () => analyzeStudentProgress(student.attempts),
    [student.attempts],
  );

  const mistakeBank = useMemo(
    () => collectStudentMistakeBank(student.attempts),
    [student.attempts],
  );

  const masteryRank = useMemo(
    () => getStudentMasteryRank(student.totalPoints),
    [student.totalPoints],
  );

  const activeDrillItem = mistakeBank[drillIdx] ?? null;
  const activeDrillOptions = useMemo(() => {
    if (!activeDrillItem) return [];
    const unit = ALL_UNITS.find((u) => u.unitNumber === activeDrillItem.unitNumber);
    const originalQ = unit?.questions.find((q) => q.id === activeDrillItem.questionId);
    if (originalQ) return [...originalQ.options];
    return [activeDrillItem.correctAnswer];
  }, [activeDrillItem]);

  function startMistakeDrill() {
    setDrillIdx(0);
    setDrillSelectedOpt(null);
    setDrillScore(0);
    setDrillOpen(true);
  }

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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToUnits}
          className="gloss-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Unitlarga qaytish</span>
        </button>

        <button
          type="button"
          onClick={onBackToUnits}
          className="gloss-btn-primary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
        >
          <Play className="h-3.5 w-3.5" />
          <span>Test ishlash</span>
        </button>
      </div>

      {welcomeBackNotice && (
        <div
          data-testid="profile-welcome-back"
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-200"
        >
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div>
              <span className="font-bold">Siz avval ham kirgan ekansiz, profilga kiramiz!</span>{' '}
              <span className="text-emerald-800 dark:text-emerald-300">
                Barcha avvalgi natijalaringiz va ballaringiz saqlangan.
              </span>
            </div>
          </div>
          {onDismissWelcomeBack && (
            <button
              type="button"
              onClick={onDismissWelcomeBack}
              aria-label="Xabarni yopish"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Profile Summary */}
      <section className="gloss-panel rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Shaxsiy profil · {student.className} sinf
            </div>
            <h1 className="font-display mt-1 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
              {student.fullName}
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-5 border-t border-slate-200/80 pt-4 sm:border-t-0 sm:pt-0 sm:text-right dark:border-white/10">
            <div>
              <div className="font-mono-tabular text-2xl font-bold text-sky-700 dark:text-sky-400">
                {student.totalPoints}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball</div>
            </div>
            <div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
                {student.completedUnits.length}/{TOTAL_UNITS}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Unitlar</div>
            </div>
            <div>
              <div className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
                {student.averagePercentage}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Oʻrtacha</div>
            </div>
          </div>
        </div>

        {/* Mastery Rank Progress Strip */}
        <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-black/35">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                Daraja {masteryRank.level}: {masteryRank.title}
              </span>
            </span>
            <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
              {masteryRank.nextTitle && masteryRank.nextThresholdPoints !== null
                ? `Keyingi daraja (${masteryRank.nextTitle}): ${student.totalPoints}/${masteryRank.nextThresholdPoints} ball`
                : 'Eng yuqori daraja zabt etildi!'}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-300 dark:shadow-[0_0_12px_rgba(56,189,248,0.5)]"
              style={{ width: `${masteryRank.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Personal Growth KPIs + Chart */}
        {student.attempts.length > 0 && (
          <div className="mt-6 space-y-5 border-t border-slate-200/80 pt-6 dark:border-white/10">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-950/25">
                <div className="text-xs text-emerald-800 dark:text-emerald-300">Eng yuqori</div>
                <div className="font-mono-tabular mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-200">
                  {analytics.bestAttempt?.percentage ?? 0}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-black/35">
                <div className="text-xs text-slate-500 dark:text-slate-400">Eng past</div>
                <div className="font-mono-tabular mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {analytics.worstAttempt?.percentage ?? 0}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-black/35">
                <div className="text-xs text-slate-500 dark:text-slate-400">Oʻsish / Tushish</div>
                <div className="mt-1 font-mono-tabular text-base font-bold">
                  <TrendBadge
                    delta={analytics.overallGrowthPct}
                    trend={analytics.overallTrend}
                    initialLabel="1 ta test"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-black/35">
                <div className="text-xs text-slate-500 dark:text-slate-400">Jami toʻgʻri / xato</div>
                <div className="font-mono-tabular mt-1 text-lg font-bold text-slate-900 dark:text-white">
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
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-black/35">
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
            className="inline-flex rounded-xl border border-slate-200 bg-slate-200/70 p-1 dark:border-white/10 dark:bg-black/45"
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
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800/90 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
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
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800/90 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
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
            <div className="gloss-panel mt-4 rounded-2xl p-10 text-center">
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
                    className="gloss-card flex flex-col justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center"
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
                      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
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
                      <span className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white">
                        {attempt.percentage}%
                      </span>
                      <button
                        type="button"
                        onClick={() => onInspectAttempt(attempt)}
                        className="gloss-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap dark:text-slate-200"
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
          <div className="gloss-panel mt-4 rounded-2xl p-10 text-center">
            <BookCheck className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Hozircha xato qilingan savollar yoʻq. Ajoyib!
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Smart Mistake Flash Practice Card */}
            {!drillOpen ? (
              <div className="gloss-panel flex flex-col justify-between gap-3 rounded-2xl border-sky-300/60 p-4 sm:flex-row sm:items-center dark:border-sky-400/30">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Xatolar ustida tezkor mashq
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Avval xato qilgan {mistakeBank.length} ta savolingizni qayta tekshirib mustahkamlang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startMistakeDrill}
                  className="gloss-btn-primary inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Mashqni boshlash</span>
                </button>
              </div>
            ) : activeDrillItem ? (
              <div className="gloss-panel rounded-2xl border-sky-300/60 p-5 dark:border-sky-400/35">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono-tabular font-semibold text-sky-700 dark:text-sky-400">
                    Mashq {drillIdx + 1}/{mistakeBank.length} · Unit {activeDrillItem.unitNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrillOpen(false)}
                    className="font-semibold text-slate-600 hover:underline dark:text-slate-300"
                  >
                    Yopish
                  </button>
                </div>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                  {activeDrillItem.prompt}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {activeDrillOptions.map((opt) => {
                    const chosen = drillSelectedOpt === opt;
                    const isRight = opt === activeDrillItem.correctAnswer;
                    const answered = drillSelectedOpt !== null;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={answered}
                        onClick={() => {
                          setDrillSelectedOpt(opt);
                          if (isRight) setDrillScore((s) => s + 1);
                        }}
                        className={`min-h-[42px] rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                          answered
                            ? isRight
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400/70 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : chosen
                                ? 'border-red-400 bg-red-50 text-red-900 dark:border-red-400/70 dark:bg-red-950/40 dark:text-red-200'
                                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-black/40 dark:text-slate-500'
                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-sky-400 hover:bg-sky-50 dark:border-white/10 dark:bg-black/35 dark:text-slate-200 dark:hover:border-sky-400/40 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {drillSelectedOpt !== null && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {activeDrillItem.explanation}
                    </span>
                    {drillIdx < mistakeBank.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDrillIdx((i) => i + 1);
                          setDrillSelectedOpt(null);
                        }}
                        className="gloss-btn-primary min-h-[36px] rounded-lg px-3.5 text-xs font-semibold"
                      >
                        Keyingi savol
                      </button>
                    ) : (
                      <span className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        Yakunlandi: {drillScore}/{mistakeBank.length} toʻgʻri
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-3">
              {mistakeBank.map((item) => {
                const isRevealed = revealedIds.has(item.questionId);
                return (
                  <article
                    key={item.questionId}
                    className="gloss-panel rounded-2xl p-5"
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

                    <h3 className="mt-2 text-base font-semibold leading-relaxed text-slate-900 dark:text-white">
                      {item.prompt}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleReveal(item.questionId)}
                        className="gloss-btn-secondary inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
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
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm dark:border-emerald-500/35 dark:bg-emerald-950/30">
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
          </div>
        )}
      </section>
    </main>
  );
}
