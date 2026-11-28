import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  RefreshCw,
  Target,
} from 'lucide-react';
import type {
  AiMistakeInput,
  AiReviewPriority,
  AiReviewRecommendation,
  StudentSummaryForTeacher,
} from '../types/quiz';
import { requestAiReviewRecommendations } from '../utils/api';
import {
  buildLocalDiagnosticReview,
  LOCAL_DIAGNOSTIC_MODEL,
} from '../utils/localDiagnosticReview';

interface AiReviewRecommendationsProps {
  studentId?: string;
  studentName: string;
  scopeLabel: string;
  audience: 'student' | 'teacher';
  cacheKey: string;
  mistakes: readonly AiMistakeInput[];
  initialRecommendation?: AiReviewRecommendation | null;
  onRecommendationSaved?: (
    recommendation: AiReviewRecommendation,
    updatedProfile: StudentSummaryForTeacher | null,
  ) => void;
}

const PRIORITY_STYLES: Record<
  AiReviewPriority,
  { label: string; badgeClass: string }
> = {
  high: {
    label: 'Yuqori ustuvorlik',
    badgeClass:
      'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/45 dark:text-rose-200',
  },
  medium: {
    label: 'Oʻrta ustuvorlik',
    badgeClass:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200',
  },
  low: {
    label: 'Qoʻshimcha takror',
    badgeClass:
      'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-200',
  },
};

export function AiReviewRecommendations({
  studentId,
  studentName,
  scopeLabel,
  audience,
  cacheKey,
  mistakes,
  initialRecommendation = null,
  onRecommendationSaved,
}: AiReviewRecommendationsProps) {
  const [recommendation, setRecommendation] = useState<AiReviewRecommendation | null>(
    initialRecommendation,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedSignatureRef = useRef<string | null>(null);
  const requestSeqRef = useRef(0);
  const onSavedRef = useRef(onRecommendationSaved);
  onSavedRef.current = onRecommendationSaved;

  const mistakesSignature = `${cacheKey}::${mistakes.length}:${mistakes
    .slice(0, 5)
    .map((m) => m.questionId)
    .join(',')}`;

  useEffect(() => {
    requestSeqRef.current += 1;
    setRecommendation(initialRecommendation);
    setError(null);
    setLoading(false);
  }, [cacheKey, initialRecommendation]);

  const runAnalysis = useCallback(
    async (forceRefresh: boolean = false) => {
      if (mistakes.length === 0) return;
      if (!forceRefresh && lastFetchedSignatureRef.current === mistakesSignature) return;

      lastFetchedSignatureRef.current = mistakesSignature;
      const reqId = ++requestSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await requestAiReviewRecommendations({
          studentId,
          studentName,
          scopeLabel,
          audience,
          cacheKey,
          mistakes,
        });
        if (requestSeqRef.current !== reqId) return;
        setRecommendation(res.recommendation);
        onSavedRef.current?.(res.recommendation, res.profile);
      } catch (err) {
        if (requestSeqRef.current !== reqId) return;
        if (forceRefresh) {
          lastFetchedSignatureRef.current = null;
        }
        setError(
          err instanceof Error
            ? err.message
            : "AI tavsiyalarini yuklab boʻlmadi.",
        );
      } finally {
        if (requestSeqRef.current === reqId) {
          setLoading(false);
        }
      }
    },
    [studentId, studentName, scopeLabel, audience, cacheKey, mistakes, mistakesSignature],
  );

  useEffect(() => {
    if (mistakes.length === 0) return;
    if (initialRecommendation) return;
    void runAnalysis(false);
  }, [mistakes.length, initialRecommendation, runAnalysis]);

  const localFallbackRecommendation = useMemo(() => {
    if (recommendation || mistakes.length === 0) return null;
    return buildLocalDiagnosticReview({
      studentName,
      scopeLabel,
      audience,
      mistakes,
    });
  }, [recommendation, studentName, scopeLabel, audience, mistakes]);

  const activeRecommendation =
    recommendation ?? (error ? localFallbackRecommendation : null);
  const isLocalDiagnostic =
    activeRecommendation?.model === LOCAL_DIAGNOSTIC_MODEL;

  return (
    <section
      data-testid="ai-review-recommendations"
      aria-labelledby={`ai-review-heading-${audience}`}
      className="gloss-panel rounded-2xl border border-indigo-200/80 p-5 sm:p-6 dark:border-indigo-500/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              <span>{isLocalDiagnostic ? 'Avtomatik tahlil' : 'AI-tavsiya'}</span>
              <span aria-hidden="true">·</span>
              <span>{scopeLabel}</span>
            </div>
            <h2
              id={`ai-review-heading-${audience}`}
              className="font-display mt-0.5 text-lg font-bold text-slate-900 dark:text-white"
            >
              {audience === 'teacher'
                ? 'Oʻquvchi takrorlashi kerak boʻlgan mavzular'
                : 'Takrorlash kerak boʻlgan mavzular'}
            </h2>
          </div>
        </div>

        {mistakes.length > 0 && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void runAnalysis(true)}
            data-testid="ai-review-refresh-btn"
            className="gloss-btn-secondary inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-700 disabled:opacity-60 whitespace-nowrap dark:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Tahlil qilinmoqda...' : 'Qayta tahlil qilish'}</span>
          </button>
        )}
      </div>

      {mistakes.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-semibold">
              Xatolar aniqlanmadi — qoʻshimcha takrorlash talab etilmaydi.
            </p>
            <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-300/90">
              {audience === 'teacher'
                ? `${studentName} ushbu boʻlimdagi barcha savollarga toʻgʻri javob bergan.`
                : 'Barcha savollar toʻgʻri yechilgan. Keyingi unitga bemalol oʻtishingiz mumkin.'}
            </p>
          </div>
        </div>
      ) : loading && !activeRecommendation ? (
        <div
          data-testid="ai-review-loading"
          className="mt-4 space-y-3"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            AI xato qilingan {mistakes.length} ta savolni tahlil qilib, takrorlash mavzularini tuzmoqda...
          </p>
          <div className="h-16 animate-pulse rounded-xl bg-slate-200/80 dark:bg-white/5" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-xl bg-slate-200/80 dark:bg-white/5" />
            <div className="h-28 animate-pulse rounded-xl bg-slate-200/80 dark:bg-white/5" />
          </div>
        </div>
      ) : activeRecommendation ? (
        <div className="mt-4 space-y-5">
          {error && (
            <div
              data-testid="ai-review-error"
              role="alert"
              className="flex flex-col justify-between gap-2.5 rounded-xl border border-amber-300 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 sm:flex-row sm:items-center dark:border-amber-500/35 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <span className="font-semibold">
                    {isLocalDiagnostic
                      ? 'Bulutli Gemini AI ulanmadi — xatolaringiz asosida qurilma ichidagi tahlil koʻrsatildi. '
                      : 'AI yangilanishida xatolik: '}
                  </span>
                  <span className="opacity-90">{error}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void runAnalysis(true)}
                className="gloss-btn-secondary inline-flex min-h-[32px] shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold text-amber-900 dark:text-amber-100"
              >
                Qayta urinish
              </button>
            </div>
          )}

          {/* Diagnostic Summary */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-black/35">
            <p className="text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100">
              {activeRecommendation.summary}
            </p>
            {activeRecommendation.strengthsNote && (
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {activeRecommendation.strengthsNote}
              </p>
            )}
          </div>

          {/* Topics to Review */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Target className="h-3.5 w-3.5 text-indigo-500" />
                <span>Tavsiya etilgan mavzular ({activeRecommendation.recommendedTopics.length})</span>
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {activeRecommendation.recommendedTopics.map((topic, idx) => {
                const priorityStyle = PRIORITY_STYLES[topic.priority] ?? PRIORITY_STYLES.medium;
                return (
                  <article
                    key={`${topic.unitNumber}-${topic.topicTitle}-${idx}`}
                    data-testid={`ai-topic-card-${idx}`}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/85 bg-white/80 p-4 dark:border-white/10 dark:bg-[#0e1422]/90"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono-tabular text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          Unit {topic.unitNumber}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${priorityStyle.badgeClass}`}
                        >
                          {priorityStyle.label}
                        </span>
                      </div>

                      <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                        {topic.topicTitle}
                      </h4>

                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {topic.reason}
                      </p>

                      {topic.keyWords.length > 0 && (
                        <div className="mt-3 text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Kalit soʻzlar:{' '}
                          </span>
                          <span className="font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                            {topic.keyWords.join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {topic.practiceTip && (
                      <div className="mt-3 border-t border-slate-200/70 pt-2.5 text-xs text-slate-600 dark:border-white/10 dark:text-slate-400">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Mashq:{' '}
                        </span>
                        {topic.practiceTip}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          {/* Concrete Study Plan */}
          {activeRecommendation.studyPlan.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-black/30">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                <span>Qisqa takrorlash rejasi</span>
              </div>
              <ol className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {activeRecommendation.studyPlan.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono-tabular font-bold text-indigo-600 dark:text-indigo-400">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="ai-review-error"
          role="alert"
          className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-900 sm:flex-row sm:items-center dark:border-amber-500/35 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">AI tahlilini olib boʻlmadi</p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/85">
                {error ?? "Tahlil qilish uchun maʻlumot yetarli emas."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void runAnalysis(true)}
            className="gloss-btn-secondary inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-xl px-3.5 text-xs font-semibold text-amber-900 dark:text-amber-100"
          >
            Qayta urinish
          </button>
        </div>
      )}
    </section>
  );
}
