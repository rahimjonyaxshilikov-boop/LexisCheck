import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, Lock, UserCheck } from 'lucide-react';
import {
  lookupStudentProfile,
  type StudentLookupResult,
} from '../utils/api';
import {
  DEFAULT_TEST_DURATION_MINUTES,
  formatCountdown,
  SCHOOL_GRADES,
  SCHOOL_SECTIONS,
  TOTAL_UNITS,
} from '../utils/quizEngine';

interface LoginScreenProps {
  testDurationMinutes?: number;
  onSuccessEnter: (fullName: string, className: string) => Promise<void>;
  onOpenTeacher: () => void;
}

export function LoginScreen({
  testDurationMinutes = DEFAULT_TEST_DURATION_MINUTES,
  onSuccessEnter,
  onOpenTeacher,
}: LoginScreenProps) {
  const [fullName, setFullName] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<number>(8);
  const [selectedSection, setSelectedSection] = useState<string>('03');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookupMatch, setLookupMatch] = useState<StudentLookupResult | null>(null);

  const selectedClass = `${selectedGrade}-${selectedSection}`;

  // Detect returning student while typing full name
  useEffect(() => {
    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 3 || !trimmed.includes(' ')) {
      setLookupMatch(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await lookupStudentProfile(trimmed, selectedClass);
      if (!cancelled) {
        setLookupMatch(result);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fullName, selectedClass]);

  async function handleQuickResumeMatchedClass(
    matchedName: string,
    matchedClass: string,
  ) {
    const [gradeStr, secStr] = matchedClass.split('-');
    const gradeNum = Number(gradeStr);
    if (Number.isInteger(gradeNum) && secStr) {
      setSelectedGrade(gradeNum);
      setSelectedSection(secStr);
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSuccessEnter(matchedName, matchedClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 3 || !trimmed.includes(' ')) {
      setError("Iltimos, to'liq ism va familiyangizni kiriting (masalan: Aziza Karimova).");
      return;
    }

    setSubmitting(true);
    try {
      await onSuccessEnter(trimmed, selectedClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xatolik yuz berdi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid w-full items-stretch gap-8 lg:grid-cols-12">
        {/* Left editorial overview */}
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>English Vocabulary in Use</span>
              <span aria-hidden="true">·</span>
              <span>Upper-Intermediate</span>
              <span aria-hidden="true">·</span>
              <span>1–{TOTAL_UNITS}-unitlar</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance] dark:text-slate-50">
              Lugʻat bilimini aniq va adolatli tekshirish tizimi
            </h1>

            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Har bir unit boʻyicha kamida 30 ta takrorlanmas test savoli, {testDurationMinutes} daqiqalik taymer va
              umumiy ballar tizimi. Savollar har bir oʻquvchiga turlicha tartibda tushadi.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
            <div>
              <div className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {TOTAL_UNITS}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Oʻquv uniti
              </div>
            </div>
            <div>
              <div className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-slate-100">
                30+
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Savol / unit
              </div>
            </div>
            <div>
              <div className="font-mono-tabular text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {formatCountdown(testDurationMinutes * 60)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Vaqt chegarasi
              </div>
            </div>
          </div>
        </section>

        {/* Right student sign-in form */}
        <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Oʻquvchi kirishi
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Toʻliq ism-familiyangizni kiriting va sinfingizni tanlang.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
              <div>
                <label
                  htmlFor="student-fullname"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Toʻliq ism va familiya
                </label>
                <input
                  id="student-fullname"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Masalan: Aziza Karimova"
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Sinfni tanlang
                  </span>
                  <span className="font-mono-tabular text-sm font-semibold text-sky-700 dark:text-sky-400">
                    Tanlangan: {selectedClass}
                  </span>
                </div>

                {/* Grade 5 - 10 selector */}
                <div className="mt-2.5 grid grid-cols-6 gap-2" role="group" aria-label="Sinf raqami">
                  {SCHOOL_GRADES.map((grade) => {
                    const active = selectedGrade === grade;
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => {
                          setSelectedGrade(grade);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] rounded-xl border text-sm font-semibold tabular-nums transition-colors ${
                          active
                            ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {grade}
                      </button>
                    );
                  })}
                </div>

                {/* Section 01 - 03 selector */}
                <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-label="Sinf guruhi">
                  {SCHOOL_SECTIONS.map((sec) => {
                    const active = selectedSection === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setSelectedSection(sec);
                          if (error) setError(null);
                        }}
                        className={`min-h-[44px] rounded-xl border text-sm font-semibold tabular-nums transition-colors ${
                          active
                            ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-400 dark:bg-sky-950/60 dark:text-sky-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {selectedGrade}-{sec}
                      </button>
                    );
                  })}
                </div>
              </div>

              {lookupMatch?.found && (
                <div
                  data-testid="returning-student-banner"
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
                >
                  <div className="flex items-start gap-2.5">
                    <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        Siz avval ham kirgan ekansiz, profilga kiramiz!
                      </div>
                      <div className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                        {lookupMatch.fullName} · {lookupMatch.className} sinf ·{' '}
                        <span className="font-mono-tabular font-semibold">
                          {lookupMatch.totalPoints} ball
                        </span>{' '}
                        ({lookupMatch.completedUnitsCount} ta unit)
                      </div>
                      {!lookupMatch.exactClassMatch && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleQuickResumeMatchedClass(
                              lookupMatch.fullName,
                              lookupMatch.className,
                            )
                          }
                          className="mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                        >
                          <span>{lookupMatch.className} sinfidagi profilga kirish</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                <span>
                  {submitting
                    ? 'Tekshirilmoqda...'
                    : lookupMatch?.found && lookupMatch.exactClassMatch
                      ? 'Profilga kirish'
                      : 'Davom etish (Continue)'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-slate-400" />
              <span>Har bir oʻquvchi profili saqlanadi</span>
            </span>
            <button
              type="button"
              onClick={onOpenTeacher}
              className="font-semibold text-sky-700 hover:underline dark:text-sky-400"
            >
              Oʻqituvchi paneli
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
