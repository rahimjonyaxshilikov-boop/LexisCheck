import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, Lock, Sparkles, UserCheck } from 'lucide-react';
import heroObsidianImg from '../assets/images/hero_obsidian_lexicon_1795704967281.jpg';
import {
  lookupStudentProfile,
  StudentEntryError,
  type StudentLookupResult,
} from '../utils/api';
import {
  DEFAULT_TEST_DURATION_MINUTES,
  formatCountdown,
  SCHOOL_GRADES,
  SCHOOL_SECTIONS,
  TOTAL_UNITS,
  validateStudentNameOrder,
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
  const [suggestedFixName, setSuggestedFixName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookupMatch, setLookupMatch] = useState<StudentLookupResult | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const selectedClass = `${selectedGrade}-${selectedSection}`;

  const trimmedName = fullName.trim().replace(/\s+/g, ' ');
  const liveNameCheck = trimmedName.includes(' ')
    ? validateStudentNameOrder(trimmedName)
    : null;
  const liveSurnameFirst =
    liveNameCheck && !liveNameCheck.ok && liveNameCheck.code === 'SURNAME_FIRST'
      ? liveNameCheck
      : null;

  const isExactClassReversed = Boolean(
    lookupMatch?.found && lookupMatch.exactClassMatch && lookupMatch.reversedOrder,
  );
  const liveSuggestedName =
    liveSurnameFirst?.suggestedName ??
    (isExactClassReversed && lookupMatch?.found ? lookupMatch.fullName : null);

  // Detect returning student while typing full name
  useEffect(() => {
    if (trimmedName.length < 3 || !trimmedName.includes(' ')) {
      setLookupMatch(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await lookupStudentProfile(trimmedName, selectedClass);
      if (!cancelled) {
        setLookupMatch(result);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedName, selectedClass]);

  function applySuggestedFix(fixedName: string) {
    setFullName(fixedName);
    setError(null);
    setSuggestedFixName(null);
  }

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
    setSuggestedFixName(null);
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
    setSuggestedFixName(null);

    const nameCheck = validateStudentNameOrder(fullName);
    if (!nameCheck.ok) {
      setError(nameCheck.error);
      setSuggestedFixName(nameCheck.suggestedName ?? null);
      return;
    }

    setSubmitting(true);
    try {
      await onSuccessEnter(nameCheck.fullName, selectedClass);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Kirishda xatolik yuz berdi.";
      const maybeSuggested =
        err instanceof StudentEntryError ||
        (typeof err === 'object' && err !== null && 'suggestedName' in err)
          ? ((err as { suggestedName?: string }).suggestedName ?? null)
          : null;
      setError(message);
      setSuggestedFixName(maybeSuggested);
    } finally {
      setSubmitting(false);
    }
  }

  const showReturningBanner = Boolean(
    lookupMatch?.found && !liveSurnameFirst && !isExactClassReversed,
  );
  const showSurnameWarning = Boolean(
    !error && (liveSurnameFirst || isExactClassReversed) && liveSuggestedName,
  );
  const canSubmitDirectlyToProfile = Boolean(
    lookupMatch?.found &&
      lookupMatch.exactClassMatch &&
      !lookupMatch.reversedOrder &&
      !liveSurnameFirst,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid w-full items-stretch gap-6 lg:grid-cols-12">
        {/* Left editorial overview with bespoke obsidian glass showcase */}
        <section className="gloss-panel flex flex-col justify-between overflow-hidden rounded-2xl lg:col-span-6">
          <div className="relative h-48 w-full overflow-hidden border-b border-slate-200/80 sm:h-56 dark:border-white/10">
            {!heroImgFailed ? (
              <img
                src={heroObsidianImg}
                alt="English Vocabulary in Use — LexisCheck lugʻat platformasi"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-[#0d172a] to-sky-950">
                <BookOpen className="h-12 w-12 text-sky-400/80" />
              </div>
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#0e1320] dark:via-[#0e1320]/45 dark:to-transparent"
            />
          </div>

          <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>English Vocabulary in Use</span>
                <span aria-hidden="true">·</span>
                <span>Upper-Intermediate</span>
                <span aria-hidden="true">·</span>
                <span>1–{TOTAL_UNITS}-unitlar</span>
              </div>

              <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance] dark:text-white">
                Lugʻat bilimini aniq va adolatli tekshirish tizimi
              </h1>

              <p className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
                Har bir unit boʻyicha kamida 30 ta takrorlanmas test savoli, {testDurationMinutes} daqiqalik taymer va
                umumiy ballar tizimi. Savollar har bir oʻquvchiga turlicha tartibda tushadi.
              </p>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-4 border-t border-slate-200/80 pt-5 dark:border-white/10">
              <div>
                <div className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
                  {TOTAL_UNITS}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Oʻquv uniti
                </div>
              </div>
              <div>
                <div className="font-mono-tabular text-2xl font-bold text-sky-600 dark:text-sky-400">
                  30+
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Savol / unit
                </div>
              </div>
              <div>
                <div className="font-mono-tabular text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCountdown(testDurationMinutes * 60)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Vaqt chegarasi
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right student entry form */}
        <section className="gloss-panel flex flex-col justify-between rounded-2xl p-6 sm:p-8 lg:col-span-6">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Oʻquvchi kirishi
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Avval ismingizni, keyin familiyangizni kiriting va sinfingizni tanlang.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
              <div>
                <label
                  htmlFor="student-fullname"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Ism va familiya (avval ism)
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
                    if (suggestedFixName) setSuggestedFixName(null);
                  }}
                  placeholder="Masalan: Aziza Karimova"
                  className="gloss-input mt-2 block w-full rounded-xl px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
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
                          if (suggestedFixName) setSuggestedFixName(null);
                        }}
                        className={`min-h-[44px] rounded-xl text-sm font-semibold tabular-nums ${
                          active
                            ? 'gloss-btn-primary text-white'
                            : 'gloss-btn-secondary text-slate-700 dark:text-slate-200'
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
                          if (suggestedFixName) setSuggestedFixName(null);
                        }}
                        className={`min-h-[44px] rounded-xl text-sm font-semibold tabular-nums ${
                          active
                            ? 'border border-sky-500/70 bg-sky-50 text-sky-800 shadow-xs dark:border-sky-400/60 dark:bg-sky-500/15 dark:text-sky-300 dark:shadow-[inset_0_1px_0_rgba(186,230,253,0.22),0_0_20px_-6px_rgba(56,189,248,0.45)]'
                            : 'gloss-btn-secondary text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {selectedGrade}-{sec}
                      </button>
                    );
                  })}
                </div>
              </div>

              {showSurnameWarning && liveSuggestedName && (
                <div
                  data-testid="surname-first-warning"
                  role="status"
                  className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-200"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        Avval ismingizni, keyin familiyangizni yozing!
                      </div>
                      <div className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                        Familiya birinchi yozilganda kirishga ruxsat berilmaydi.
                      </div>
                      <button
                        type="button"
                        data-testid="fix-name-order-btn"
                        onClick={() => applySuggestedFix(liveSuggestedName)}
                        className="mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-amber-700 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>«{liveSuggestedName}» deb toʻgʻrilash</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showReturningBanner && lookupMatch?.found && (
                <div
                  data-testid="returning-student-banner"
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50/85 p-3.5 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-200"
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
                          className="gloss-btn-emerald mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
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
                  className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-500/35 dark:bg-red-950/40 dark:text-red-300"
                >
                  <div className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div>{error}</div>
                      {suggestedFixName && (
                        <button
                          type="button"
                          data-testid="fix-name-order-btn"
                          onClick={() => applySuggestedFix(suggestedFixName)}
                          className="mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-red-800 dark:bg-red-500 dark:text-slate-950 dark:hover:bg-red-400"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>«{suggestedFixName}» deb toʻgʻrilash</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="gloss-btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? 'Tekshirilmoqda...'
                    : canSubmitDirectlyToProfile
                      ? 'Profilga kirish'
                      : 'Davom etish'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
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
