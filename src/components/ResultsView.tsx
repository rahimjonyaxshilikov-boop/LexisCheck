import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  RotateCcw,
  Send,
  Share2,
  XCircle,
} from 'lucide-react';
import type { StudentProfile, TestAttempt } from '../types/quiz';
import { formatCountdown } from '../utils/quizEngine';
import {
  buildResultImageFilename,
  buildResultShareText,
  buildTelegramShareUrl,
  renderResultCardBlob,
} from '../utils/resultShare';
import { TrendBadge } from './AnalyticsPrimitives';

interface ResultsViewProps {
  student: StudentProfile;
  attempt: TestAttempt;
  onBackToUnits: () => void;
  onStartUnitNumber: (unitNumber: number) => void;
}

export function ResultsView({
  student,
  attempt,
  onBackToUnits,
  onStartUnitNumber,
}: ResultsViewProps) {
  const [busyAction, setBusyAction] = useState<'save' | 'share' | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const shareText = useMemo(
    () => buildResultShareText(student, attempt),
    [student, attempt],
  );

  const telegramHref = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : undefined;
    return buildTelegramShareUrl(shareText, origin);
  }, [shareText]);

  const previousSameUnit = useMemo(() => {
    const sameUnit = student.attempts
      .filter((a) => a.unitNumber === attempt.unitNumber && a.id !== attempt.id)
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
    return sameUnit[0] ?? null;
  }, [student.attempts, attempt]);

  const unitDelta = previousSameUnit
    ? attempt.percentage - previousSameUnit.percentage
    : null;

  const unitTrend =
    unitDelta === null
      ? 'initial'
      : unitDelta > 0
        ? 'up'
        : unitDelta < 0
          ? 'down'
          : 'same';

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleSaveScreenshot() {
    setBusyAction('save');
    setActionStatus(null);
    try {
      const blob = await renderResultCardBlob(student, attempt);
      const filename = buildResultImageFilename(student, attempt);
      triggerBlobDownload(blob, filename);
      setActionStatus(`Skrinshot saqlandi (${filename}).`);
    } catch (err) {
      setActionStatus(
        err instanceof Error
          ? err.message
          : 'Skrinshotni saqlashda xatolik yuz berdi.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleShareScreenshot() {
    setBusyAction('share');
    setActionStatus(null);
    try {
      const blob = await renderResultCardBlob(student, attempt);
      const filename = buildResultImageFilename(student, attempt);
      const file = new File([blob], filename, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `LexisCheck — Unit ${attempt.unitNumber} natijasi`,
          text: shareText,
          files: [file],
        });
        setActionStatus('Natija skrinshoti ulashildi.');
      } else {
        triggerBlobDownload(blob, filename);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareText);
        }
        setActionStatus(
          'Skrinshot yuklab olindi va natija matni nusxalandi — Telegramga yuborishingiz mumkin.',
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setActionStatus(null);
      } else {
        setActionStatus(
          'Skrinshot yuklab olindi. Uni Telegram orqali yuborishingiz mumkin.',
        );
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setActionStatus('Natija matni nusxalandi.');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      setActionStatus('Matnni nusxalab bo‘lmadi.');
    }
  }

  const nextUnitNumber = attempt.unitNumber < 20 ? attempt.unitNumber + 1 : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Results Summary Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Test natijalari</span>
              <span aria-hidden="true">·</span>
              <span>Unit {attempt.unitNumber}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                Sarflangan vaqt: {formatCountdown(attempt.durationSeconds)}
              </span>
            </div>

            <h1 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
              {attempt.unitTitle}
            </h1>

            <div
              data-testid="result-student-info"
              className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              <span>{student.fullName}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="font-mono-tabular text-sky-700 dark:text-sky-400">
                {student.className} sinf
              </span>
              {previousSameUnit && (
                <>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    Oldingi urinishga nisbatan:{' '}
                  </span>
                  <span className="text-xs">
                    <TrendBadge
                      delta={unitDelta}
                      trend={unitTrend}
                      initialLabel="Birinchi urinish"
                    />
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col sm:items-end">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Natija foizi
            </span>
            <span className="font-mono-tabular text-4xl font-bold text-slate-900 dark:text-slate-50">
              {attempt.percentage}%
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>Toʻgʻri javoblar</span>
            </div>
            <div
              data-testid="result-correct-count"
              className="font-mono-tabular mt-1.5 text-2xl font-bold text-emerald-900 dark:text-emerald-200"
            >
              {attempt.correctCount}
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/60 dark:bg-red-950/30">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300">
              <XCircle className="h-4 w-4" />
              <span>Xato javoblar</span>
            </div>
            <div
              data-testid="result-wrong-count"
              className="font-mono-tabular mt-1.5 text-2xl font-bold text-red-900 dark:text-red-200"
            >
              {attempt.wrongCount}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Ushbu test bali
            </div>
            <div className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
              +{attempt.pointsEarned}
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="text-xs font-semibold text-sky-800 dark:text-sky-300">
              Umumiy ball
            </div>
            <div
              data-testid="result-total-points"
              className="font-mono-tabular mt-1.5 text-2xl font-bold text-sky-900 dark:text-sky-200"
            >
              {student.totalPoints}
            </div>
          </div>
        </div>

        {/* Save, Screenshot & Telegram Share Bar */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Natijani saqlash va Telegramda ulashish
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Natija profilingizga saqlandi. Skrinshotni yuklab oling yoki Telegram orqali yuboring.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSaveScreenshot()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{busyAction === 'save' ? 'Tayyorlanmoqda...' : 'Saqlash (PNG)'}</span>
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleShareScreenshot()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Skrinshotni ulashish</span>
              </button>

              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Telegramdan yuborish</span>
              </a>

              <button
                type="button"
                onClick={() => void handleCopyText()}
                aria-label="Natija matnini nusxalash"
                className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {copiedText ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {actionStatus && (
            <div
              role="status"
              className="mt-3 text-xs font-medium text-sky-800 dark:text-sky-300"
            >
              {actionStatus}
            </div>
          )}
        </div>

        {/* Navigation Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <button
            type="button"
            onClick={onBackToUnits}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Unitlar menyusiga qaytish</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onStartUnitNumber(attempt.unitNumber)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Testni qayta ishlash</span>
            </button>

            {nextUnitNumber !== null && (
              <button
                type="button"
                onClick={() => onStartUnitNumber(nextUnitNumber)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <span>Keyingi: Unit {nextUnitNumber}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Mistakes Section Underneath */}
      <section className="mt-8" aria-labelledby="mistakes-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="mistakes-heading"
            className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Xatolar tahlili ({attempt.mistakes.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Notoʻgʻri yoki belgilanmagan savollar
          </span>
        </div>

        {attempt.mistakes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-2 text-base font-bold text-emerald-900 dark:text-emerald-200">
              Ajoyib natija! Barcha {attempt.totalQuestions} ta savolga toʻgʻri javob berdingiz.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {attempt.mistakes.map((m, index) => (
              <article
                key={m.questionId}
                data-testid={`mistake-item-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Xato #{index + 1}
                </div>
                <h3 className="mt-1.5 text-base font-semibold leading-relaxed text-slate-900 dark:text-slate-100">
                  {m.prompt}
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 dark:border-red-900/60 dark:bg-red-950/30">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Sizning javobingiz</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-red-900 dark:text-red-200">
                      {m.selectedAnswer}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Toʻgʻri javob</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-emerald-900 dark:text-emerald-200">
                      {m.correctAnswer}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Izoh:
                  </span>{' '}
                  {m.explanation}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
