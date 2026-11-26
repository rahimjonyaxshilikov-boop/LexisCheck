import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  KeyRound,
  Lock,
  LogOut,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { StudentSummaryForTeacher, TestAttempt } from '../types/quiz';
import {
  deleteStudentByTeacher,
  fetchTeacherDashboard,
  getSavedTeacherToken,
  loginTeacherAccount,
  setSavedTeacherToken,
  updateCheaterCode,
  updateTeacherPassword,
  updateTestDurationMinutes,
} from '../utils/api';
import {
  DEFAULT_TEST_DURATION_MINUTES,
  formatCountdown,
  getAllSchoolClasses,
  getStudentMasteryRank,
  MAX_TEST_DURATION_MINUTES,
  MIN_TEST_DURATION_MINUTES,
  normalizeComparableText,
  validateTestDurationMinutes,
} from '../utils/quizEngine';
import { ALL_UNITS } from '../data/units';
import {
  analyzeClassAndMistakes,
  analyzeStudentProgress,
} from '../utils/studentAnalytics';
import { ProgressLineChart, TrendBadge } from './AnalyticsPrimitives';

const TIMER_PRESET_MINUTES = [5, 10, 15, 20, 30, 45] as const;

interface TeacherPanelProps {
  testDurationMinutes?: number;
  onTestDurationChange?: (minutes: number) => void;
  onBack: () => void;
}

export function TeacherPanel({
  testDurationMinutes = DEFAULT_TEST_DURATION_MINUTES,
  onTestDurationChange,
  onBack,
}: TeacherPanelProps) {
  const [teacherToken, setTeacherToken] = useState<string | null>(() =>
    getSavedTeacherToken(),
  );
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [students, setStudents] = useState<StudentSummaryForTeacher[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [teacherTab, setTeacherTab] = useState<'students' | 'insights'>('students');

  const [selectedStudent, setSelectedStudent] =
    useState<StudentSummaryForTeacher | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<TestAttempt | null>(null);

  // Change Password / Cheater Code modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTab, setPasswordTab] = useState<'teacher' | 'cheater'>('teacher');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldCheaterCode, setOldCheaterCode] = useState('');
  const [newCheaterCode, setNewCheaterCode] = useState('');
  const [confirmCheaterCode, setConfirmCheaterCode] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Test timer configuration modal state
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState<string>(String(testDurationMinutes));
  const [timerError, setTimerError] = useState<string | null>(null);
  const [timerSuccess, setTimerSuccess] = useState<string | null>(null);
  const [timerSubmitting, setTimerSubmitting] = useState(false);

  const allClasses = useMemo(() => getAllSchoolClasses(), []);

  const loadDashboard = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const list = await fetchTeacherDashboard();
      setStudents(list);
    } catch (err) {
      setDataError(
        err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi.",
      );
      if (!getSavedTeacherToken()) {
        setTeacherToken(null);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (teacherToken) {
      void loadDashboard();
    }
  }, [teacherToken, loadDashboard]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    if (!password) {
      setLoginError('Parolni kiriting.');
      return;
    }
    setLoggingIn(true);
    try {
      const token = await loginTeacherAccount(password);
      setTeacherToken(token);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Parol noto'g'ri.");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleTeacherLogout() {
    setSavedTeacherToken(null);
    setTeacherToken(null);
    setStudents([]);
    setSelectedStudent(null);
    setSelectedAttempt(null);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    setPwSubmitting(true);
    try {
      await updateTeacherPassword(oldPassword, newPassword, confirmPassword);
      setPwSuccess("O'qituvchi paroli muvaffaqiyatli yangilandi.");
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Parolni yangilab bo'lmadi.");
    } finally {
      setPwSubmitting(false);
    }
  }

  async function handleChangeCheaterCode(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    setPwSubmitting(true);
    try {
      await updateCheaterCode(oldCheaterCode, newCheaterCode, confirmCheaterCode);
      setPwSuccess('Cheater paroli muvaffaqiyatli yangilandi.');
      setOldCheaterCode('');
      setNewCheaterCode('');
      setConfirmCheaterCode('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Cheater parolini yangilab bo'lmadi.");
    } finally {
      setPwSubmitting(false);
    }
  }

  function openSecurityModal(tab: 'teacher' | 'cheater') {
    setPasswordTab(tab);
    setPwError(null);
    setPwSuccess(null);
    setShowPasswordModal(true);
  }

  function openTimerModal() {
    setTimerInput(String(testDurationMinutes));
    setTimerError(null);
    setTimerSuccess(null);
    setShowTimerModal(true);
  }

  async function handleSaveTimer(e: FormEvent) {
    e.preventDefault();
    setTimerError(null);
    setTimerSuccess(null);

    const validated = validateTestDurationMinutes(timerInput);
    if (!validated.ok) {
      setTimerError(validated.error);
      return;
    }

    setTimerSubmitting(true);
    try {
      const updated = await updateTestDurationMinutes(validated.minutes);
      onTestDurationChange?.(updated);
      setTimerInput(String(updated));
      setTimerSuccess(`Test taymeri ${updated} daqiqaga yangilandi.`);
    } catch (err) {
      setTimerError(
        err instanceof Error ? err.message : "Taymer vaqtini yangilab bo'lmadi.",
      );
    } finally {
      setTimerSubmitting(false);
    }
  }

  async function handleDeleteStudent(studentId: string) {
    try {
      await deleteStudentByTeacher(studentId);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null);
        setSelectedAttempt(null);
      }
    } catch (err) {
      setDataError(
        err instanceof Error ? err.message : "Akkauntni o'chirib bo'lmadi.",
      );
    }
  }

  const filteredStudents = useMemo(() => {
    const normalizedQuery = normalizeComparableText(search);
    const queryTokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
    return students.filter((s) => {
      if (classFilter !== 'all' && s.className !== classFilter) return false;
      if (unitFilter !== 'all') {
        const unitNum = Number(unitFilter);
        if (!s.completedUnits.includes(unitNum)) return false;
      }
      if (queryTokens.length === 0) return true;
      const comparableStudentText = `${normalizeComparableText(s.fullName)} ${normalizeComparableText(s.className)}`;
      return queryTokens.every((token) => comparableStudentText.includes(token));
    });
  }, [students, search, classFilter, unitFilter]);

  const totalAttempts = useMemo(
    () => filteredStudents.reduce((sum, s) => sum + s.attempts.length, 0),
    [filteredStudents],
  );

  const avgClassScore = useMemo(() => {
    const active = filteredStudents.filter((s) => s.attempts.length > 0);
    if (active.length === 0) return 0;
    return Math.round(
      active.reduce((sum, s) => sum + s.averagePercentage, 0) / active.length,
    );
  }, [filteredStudents]);

  const studentAnalytics = useMemo(
    () => (selectedStudent ? analyzeStudentProgress(selectedStudent.attempts) : null),
    [selectedStudent],
  );

  const classAndMistakeStats = useMemo(
    () =>
      analyzeClassAndMistakes(
        filteredStudents,
        unitFilter === 'all' ? 'all' : Number(unitFilter),
      ),
    [filteredStudents, unitFilter],
  );

  function exportCsv() {
    const rows = [
      ['Ism Familiya', 'Sinf', 'Umumiy ball', 'Bajarilgan unitlar', 'Ortacha (%)', 'Urinishlar soni'],
      ...filteredStudents.map((s) => [
        `"${s.fullName.replace(/"/g, '""')}"`,
        s.className,
        String(s.totalPoints),
        `${s.completedUnits.length}/${ALL_UNITS.length}`,
        String(s.averagePercentage),
        String(s.attempts.length),
      ]),
    ];
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oquvchilar-natijalari.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  // Unauthenticated Teacher Login View — NO PASSWORD HINT
  if (!teacherToken) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
        <section className="gloss-panel w-full rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2.5 text-sky-700 dark:text-sky-400">
            <Lock className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Oʻqituvchi kirishi
            </span>
          </div>

          <h1 className="font-display mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            Oʻqituvchi paneli
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Oʻquvchilarning barcha test natijalarini koʻrish uchun parolni kiriting.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="teacher-password"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Oʻqituvchi paroli
              </label>
              <input
                id="teacher-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gloss-input mt-2 block w-full rounded-xl px-4 py-3 text-base text-slate-900 focus:outline-none dark:text-slate-100"
              />
            </div>

            {loginError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="gloss-btn-primary min-h-[46px] w-full rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
            >
              {loggingIn ? 'Tekshirilmoqda...' : 'Kirish'}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="gloss-btn-secondary min-h-[42px] w-full rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Orqaga qaytish
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Top Toolbar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Oʻqituvchi boshqaruv paneli
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            5–10-sinf oʻquvchilarining natijalari, ballari va xatolari tahlili.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openTimerModal}
            className="gloss-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>Taymer: {testDurationMinutes} daq</span>
          </button>

          <button
            type="button"
            onClick={() => openSecurityModal('teacher')}
            className="gloss-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Parolni yangilash</span>
          </button>

          <button
            type="button"
            onClick={() => openSecurityModal('cheater')}
            className="gloss-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span>Cheater paroli</span>
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredStudents.length === 0}
            className="gloss-btn-secondary inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV yuklash</span>
          </button>

          <button
            type="button"
            onClick={handleTeacherLogout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-700/20 bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 dark:border-white/20 dark:bg-white/95 dark:text-slate-950 dark:hover:bg-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Chiqish</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <section className="mt-6 grid grid-cols-3 gap-4">
        <div className="gloss-card rounded-2xl border-indigo-200/70 p-4 sm:p-5 dark:border-indigo-500/25">
          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Oʻquvchilar</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
            {filteredStudents.length}
          </div>
        </div>
        <div className="gloss-card rounded-2xl border-emerald-200/70 p-4 sm:p-5 dark:border-emerald-500/25">
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Topshirilgan testlar</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
            {totalAttempts}
          </div>
        </div>
        <div className="gloss-card rounded-2xl border-amber-200/70 p-4 sm:p-5 dark:border-amber-500/25">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Oʻrtacha natija</div>
          <div className="font-mono-tabular mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {avgClassScore}%
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism-familiya boʻyicha qidirish..."
            aria-label="O'quvchi qidirish"
            className="gloss-input min-h-[42px] w-full rounded-xl pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <select
          aria-label="Sinf bo'yicha filtr"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="gloss-input min-h-[42px] rounded-xl px-3.5 text-sm font-medium text-slate-800 focus:outline-none dark:text-slate-100"
        >
          <option value="all">Barcha sinflar</option>
          {allClasses.map((cls) => (
            <option key={cls} value={cls}>
              {cls} sinf
            </option>
          ))}
        </select>

        <select
          aria-label="Unit bo'yicha filtr"
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="gloss-input min-h-[42px] rounded-xl px-3.5 text-sm font-medium text-slate-800 focus:outline-none dark:text-slate-100"
        >
          <option value="all">Barcha unitlar</option>
          {ALL_UNITS.map((u) => (
            <option key={u.unitNumber} value={String(u.unitNumber)}>
              Unit {u.unitNumber}: {u.title}
            </option>
          ))}
        </select>
      </section>

      {dataError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
        >
          {dataError}
        </div>
      )}

      {/* View Mode Switch: Students List vs Class & Hardest Questions */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div
          className="inline-flex rounded-xl border border-slate-200 bg-slate-200/70 p-1 dark:border-slate-700/40 dark:bg-[#0e1422]"
          role="tablist"
          aria-label="O'qituvchi ko'rinishlari"
        >
          <button
            type="button"
            role="tab"
            aria-selected={teacherTab === 'students'}
            onClick={() => setTeacherTab('students')}
            className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              teacherTab === 'students'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-indigo-500/20 dark:text-indigo-200'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Oʻquvchilar roʻyxati ({filteredStudents.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={teacherTab === 'insights'}
            onClick={() => setTeacherTab('insights')}
            className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              teacherTab === 'insights'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-indigo-500/20 dark:text-indigo-200'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Sinflar va qiyin savollar
          </button>
        </div>
      </div>

      {/* Results Table / Class & Mistake Insights */}
      <section className="mt-4">
        {loadingData ? (
          <div className="gloss-panel rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Maʼlumotlar yuklanmoqda...
          </div>
        ) : teacherTab === 'insights' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Class Breakdown */}
            <div className="gloss-panel rounded-2xl p-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Sinflar kesimida oʻrtacha natijalar
              </h2>
              {classAndMistakeStats.classes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Sinflar boʻyicha maʼlumot hali mavjud emas.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200/80 text-slate-500 dark:border-white/10 dark:text-slate-400">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Sinf</th>
                        <th className="py-2 pr-3 font-semibold">Oʻquvchi</th>
                        <th className="py-2 pr-3 font-semibold">Testlar</th>
                        <th className="py-2 pr-3 font-semibold">Oʻrtacha</th>
                        <th className="py-2 font-semibold text-right">Jami ball</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                      {classAndMistakeStats.classes.map((cls) => (
                        <tr key={cls.className}>
                          <td className="py-2.5 pr-3 font-mono-tabular font-bold text-slate-900 dark:text-white">
                            {cls.className}
                          </td>
                          <td className="py-2.5 pr-3 font-mono-tabular text-slate-700 dark:text-slate-300">
                            {cls.studentCount}
                          </td>
                          <td className="py-2.5 pr-3 font-mono-tabular text-slate-700 dark:text-slate-300">
                            {cls.attemptsCount}
                          </td>
                          <td className="py-2.5 pr-3 font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                            {cls.averagePercentage}%
                          </td>
                          <td className="py-2.5 text-right font-mono-tabular font-bold text-sky-700 dark:text-sky-400">
                            {cls.totalPoints}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Hardest Questions */}
            <div className="gloss-panel rounded-2xl p-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Eng koʻp xato qilingan savollar (Top 5)
              </h2>
              {classAndMistakeStats.hardestQuestions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Hozircha xato statistikasi mavjud emas.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {classAndMistakeStats.hardestQuestions.map((hq, idx) => (
                    <div
                      key={hq.questionId}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs dark:border-white/10 dark:bg-black/35"
                    >
                      <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
                        <span className="font-mono-tabular font-semibold text-sky-700 dark:text-sky-400">
                          #{idx + 1} · Unit {hq.unitNumber}
                        </span>
                        <span className="font-mono-tabular font-semibold text-red-700 dark:text-red-400">
                          {hq.missCount} marta xato
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                        {hq.prompt}
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Toʻgʻri javob: {hq.correctAnswer}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="gloss-panel rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Hozircha mos oʻquvchi natijalari mavjud emas.
          </div>
        ) : (
          <div className="gloss-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/90 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-black/45 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3.5">Oʻquvchi</th>
                    <th className="px-4 py-3.5">Sinf</th>
                    <th className="px-4 py-3.5">Umumiy ball</th>
                    <th className="px-4 py-3.5">Unitlar</th>
                    <th className="px-4 py-3.5">Oʻrtacha</th>
                    <th className="px-4 py-3.5 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {filteredStudents.map((s) => (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                        {s.fullName}
                      </td>
                      <td className="px-4 py-3.5 font-mono-tabular text-slate-700 dark:text-slate-300">
                        {s.className}
                      </td>
                      <td className="px-4 py-3.5 font-mono-tabular font-bold text-sky-700 dark:text-sky-400">
                        {s.totalPoints}
                      </td>
                      <td className="px-4 py-3.5 font-mono-tabular text-slate-700 dark:text-slate-300">
                        {s.completedUnits.length}/{ALL_UNITS.length}
                      </td>
                      <td className="px-4 py-3.5 font-mono-tabular text-slate-700 dark:text-slate-300">
                        {s.averagePercentage}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(s);
                              setSelectedAttempt(s.attempts[0] ?? null);
                            }}
                            className="gloss-btn-secondary inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Batafsil</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteStudent(s.id)}
                            aria-label={`${s.fullName} akkauntini o'chirish`}
                            title="Akkauntni o'chirish / blokdan chiqarish"
                            className="gloss-btn-secondary inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Student Detail Modal */}
      {selectedStudent && studentAnalytics && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="O'quvchi natijalari tafsiloti"
        >
          <div className="gloss-panel flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedStudent.className} sinf · Daraja {getStudentMasteryRank(selectedStudent.totalPoints).level}:{' '}
                  {getStudentMasteryRank(selectedStudent.totalPoints).title} · Umumiy ball: {selectedStudent.totalPoints} · Bajarilgan unitlar: {selectedStudent.completedUnits.length}/{ALL_UNITS.length}
                </div>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
                  {selectedStudent.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedStudent(null);
                  setSelectedAttempt(null);
                }}
                aria-label="Tafsilot oynasini yopish"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedStudent.attempts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hali test topshirilmagan.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Overall Student Statistics Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-black/35">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball</div>
                      <div className="font-mono-tabular mt-1 text-xl font-bold text-sky-700 dark:text-sky-400">
                        {selectedStudent.totalPoints}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-black/35">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Oʻrtacha</div>
                      <div className="font-mono-tabular mt-1 text-xl font-bold text-slate-900 dark:text-white">
                        {selectedStudent.averagePercentage}%
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-950/25">
                      <div className="text-xs text-emerald-800 dark:text-emerald-300">Eng yuqori</div>
                      <div className="font-mono-tabular mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-200">
                        {studentAnalytics.bestAttempt?.percentage ?? 0}%
                      </div>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 dark:border-red-500/30 dark:bg-red-950/25">
                      <div className="text-xs text-red-800 dark:text-red-300">Eng past</div>
                      <div className="font-mono-tabular mt-1 text-xl font-bold text-red-900 dark:text-red-200">
                        {studentAnalytics.worstAttempt?.percentage ?? 0}%
                      </div>
                    </div>

                    <div className="col-span-2 rounded-xl border border-slate-200/80 bg-slate-50/90 p-3.5 sm:col-span-1 dark:border-white/10 dark:bg-black/35">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Oʻsish / Tushish</div>
                      <div className="mt-1 flex items-center gap-1 font-mono-tabular text-lg font-bold">
                        <TrendBadge
                          delta={studentAnalytics.overallGrowthPct}
                          trend={studentAnalytics.overallTrend}
                          initialLabel="1 ta test"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chronological Growth / Drop SVG Chart */}
                  {studentAnalytics.chronological.length >= 2 && (
                    <section className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-black/35">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Natijalar oʻsishi va tushishi dinamikasi ({studentAnalytics.totalAttempts} ta test)
                        </h3>
                        <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          Jami toʻgʻri: {studentAnalytics.totalCorrect} · Jami xato: {studentAnalytics.totalWrong}
                        </span>
                      </div>

                      <div className="w-full overflow-x-auto">
                        <ProgressLineChart items={studentAnalytics.chronological} />
                      </div>
                    </section>
                  )}

                  {/* Per-Test Results & Growth/Drop Breakdown */}
                  <section>
                    <h3 className="mb-2.5 text-sm font-bold text-slate-900 dark:text-white">
                      Har bir test boʻyicha statistika, ballar va oʻsish/tushishlar
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200/80 bg-slate-50 font-semibold text-slate-600 dark:border-white/10 dark:bg-black/45 dark:text-slate-300">
                            <tr>
                              <th className="px-3.5 py-2.5">#</th>
                              <th className="px-3.5 py-2.5">Unit</th>
                              <th className="px-3.5 py-2.5">Toʻgʻri / Xato</th>
                              <th className="px-3.5 py-2.5">Ball</th>
                              <th className="px-3.5 py-2.5">Natija</th>
                              <th className="px-3.5 py-2.5">Oʻsish / Tushish</th>
                              <th className="px-3.5 py-2.5">Vaqt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                            {studentAnalytics.newestFirst.map((entry) => {
                              const a = entry.attempt;
                              const isSelected = selectedAttempt?.id === a.id;
                              return (
                                <tr
                                  key={a.id}
                                  onClick={() => setSelectedAttempt(a)}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-sky-50/80 dark:bg-sky-500/15'
                                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                                  }`}
                                >
                                  <td className="px-3.5 py-2.5 font-mono-tabular text-slate-500 dark:text-slate-400">
                                    #{entry.sequenceNumber}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white">
                                    <div>Unit {a.unitNumber}: {a.unitTitle}</div>
                                    <div className="font-mono-tabular text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                      {new Date(a.completedAt).toLocaleString('uz-UZ', {
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono-tabular">
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {a.correctCount}
                                    </span>
                                    <span className="mx-1 text-slate-400">/</span>
                                    <span className="font-semibold text-red-700 dark:text-red-400">
                                      {a.wrongCount}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono-tabular font-bold text-sky-700 dark:text-sky-400">
                                    +{a.pointsEarned}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono-tabular font-bold text-slate-900 dark:text-white">
                                    {a.percentage}%
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono-tabular">
                                    <div className="flex flex-col gap-0.5">
                                      <TrendBadge
                                        delta={entry.overallDeltaPct}
                                        trend={entry.overallTrend}
                                        initialLabel="Birinchi test"
                                      />
                                      {entry.unitDeltaPct !== null && (
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                          Shu unit: {entry.unitDeltaPct > 0 ? `+${entry.unitDeltaPct}%` : `${entry.unitDeltaPct}%`}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono-tabular text-slate-600 dark:text-slate-400">
                                    {formatCountdown(a.durationSeconds)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  {/* Selected Attempt Mistake Details */}
                  {selectedAttempt && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-xs font-semibold tabular-nums dark:border-white/10 dark:bg-black/40">
                        <span>
                          Tanlangan test: Unit {selectedAttempt.unitNumber} — {selectedAttempt.unitTitle}
                        </span>
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Toʻgʻri: {selectedAttempt.correctCount}
                          </span>
                          <span className="text-red-700 dark:text-red-400">
                            Xato: {selectedAttempt.wrongCount}
                          </span>
                          <span className="text-sky-700 dark:text-sky-400">
                            Ball: +{selectedAttempt.pointsEarned}
                          </span>
                          <span>Vaqt: {formatCountdown(selectedAttempt.durationSeconds)}</span>
                        </div>
                      </div>

                      {selectedAttempt.mistakes.length === 0 ? (
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          Ushbu urinishda xatolar mavjud emas.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedAttempt.mistakes.map((m, idx) => (
                            <div
                              key={m.questionId}
                              className="rounded-xl border border-slate-200/80 p-4 text-sm dark:border-white/10 dark:bg-black/30"
                            >
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {idx + 1}. {m.prompt}
                              </p>
                              <p className="mt-1.5 text-xs text-red-700 dark:text-red-400">
                                Oʻquvchi javobi: {m.selectedAnswer}
                              </p>
                              <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                                Toʻgʻri javob: {m.correctAnswer}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Teacher Password & Cheater Code Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw-modal-title"
        >
          <div className="gloss-panel w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2
                id="pw-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {passwordTab === 'teacher'
                  ? 'Oʻqituvchi parolini yangilash'
                  : 'Cheater parolini yangilash'}
              </h2>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                aria-label="Parol oynasini yopish"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-200/70 p-1 dark:border-white/10 dark:bg-black/45"
              role="tablist"
              aria-label="Parol turi"
            >
              <button
                type="button"
                role="tab"
                aria-selected={passwordTab === 'teacher'}
                onClick={() => {
                  setPasswordTab('teacher');
                  setPwError(null);
                  setPwSuccess(null);
                }}
                className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold transition-colors ${
                  passwordTab === 'teacher'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-indigo-500/20 dark:text-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Profil paroli
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={passwordTab === 'cheater'}
                onClick={() => {
                  setPasswordTab('cheater');
                  setPwError(null);
                  setPwSuccess(null);
                }}
                className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold transition-colors ${
                  passwordTab === 'cheater'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-indigo-500/20 dark:text-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Cheater paroli
              </button>
            </div>

            {passwordTab === 'teacher' ? (
              <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="old-password"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Eski parol
                  </label>
                  <input
                    id="old-password"
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Yangi parol
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Yangi parolni tasdiqlash
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                  />
                </div>

                {pwError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                  >
                    {pwError}
                  </div>
                )}

                {pwSuccess && (
                  <div
                    role="status"
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{pwSuccess}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="gloss-btn-secondary min-h-[40px] rounded-xl px-4 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Yopish
                  </button>
                  <button
                    type="submit"
                    disabled={pwSubmitting}
                    className="gloss-btn-primary min-h-[40px] rounded-xl px-5 text-xs font-semibold disabled:opacity-60"
                  >
                    {pwSubmitting ? 'Saqlanmoqda...' : 'Parolni saqlash'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangeCheaterCode} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="old-cheater-code"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Eski cheater paroli
                  </label>
                  <input
                    id="old-cheater-code"
                    type="password"
                    autoComplete="off"
                    required
                    value={oldCheaterCode}
                    onChange={(e) => setOldCheaterCode(e.target.value)}
                    className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-cheater-code"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Yangi cheater paroli
                  </label>
                  <input
                    id="new-cheater-code"
                    type="password"
                    autoComplete="off"
                    required
                    value={newCheaterCode}
                    onChange={(e) => setNewCheaterCode(e.target.value)}
                    className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-cheater-code"
                    className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Yangi cheater parolini tasdiqlash
                  </label>
                  <input
                    id="confirm-cheater-code"
                    type="password"
                    autoComplete="off"
                    required
                    value={confirmCheaterCode}
                    onChange={(e) => setConfirmCheaterCode(e.target.value)}
                    className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                  />
                </div>

                {pwError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                  >
                    {pwError}
                  </div>
                )}

                {pwSuccess && (
                  <div
                    role="status"
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{pwSuccess}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="gloss-btn-secondary min-h-[40px] rounded-xl px-4 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Yopish
                  </button>
                  <button
                    type="submit"
                    disabled={pwSubmitting}
                    className="gloss-btn-primary min-h-[40px] rounded-xl px-5 text-xs font-semibold disabled:opacity-60"
                  >
                    {pwSubmitting ? 'Saqlanmoqda...' : 'Cheater parolini saqlash'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Test Timer Configuration Modal */}
      {showTimerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timer-modal-title"
        >
          <div className="gloss-panel w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2
                id="timer-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Test taymerini sozlash
              </h2>
              <button
                type="button"
                onClick={() => setShowTimerModal(false)}
                aria-label="Taymer oynasini yopish"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              Har bir unit testi uchun ajratiladigan vaqtni belgilang (standart: {DEFAULT_TEST_DURATION_MINUTES} daqiqa).
            </p>

            <form onSubmit={handleSaveTimer} className="mt-5 space-y-4" noValidate>
              <div>
                <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Tezkor tanlash
                </span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {TIMER_PRESET_MINUTES.map((mins) => {
                    const selected = Number(timerInput) === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setTimerInput(String(mins));
                          setTimerError(null);
                          setTimerSuccess(null);
                        }}
                        className={`min-h-[38px] rounded-xl px-3 text-xs font-semibold tabular-nums ${
                          selected
                            ? 'gloss-btn-primary text-white'
                            : 'gloss-btn-secondary text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {mins} daq{mins === DEFAULT_TEST_DURATION_MINUTES ? ' · Standart' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="teacher-timer-minutes"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Test davomiyligi (daqiqa, {MIN_TEST_DURATION_MINUTES}–{MAX_TEST_DURATION_MINUTES})
                </label>
                <input
                  id="teacher-timer-minutes"
                  type="number"
                  min={MIN_TEST_DURATION_MINUTES}
                  max={MAX_TEST_DURATION_MINUTES}
                  step={1}
                  required
                  value={timerInput}
                  onChange={(e) => {
                    setTimerInput(e.target.value);
                    if (timerError) setTimerError(null);
                    if (timerSuccess) setTimerSuccess(null);
                  }}
                  className="gloss-input mt-1.5 block w-full rounded-xl px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:outline-none dark:text-slate-100"
                />
              </div>

              {timerError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300"
                >
                  {timerError}
                </div>
              )}

              {timerSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{timerSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTimerModal(false)}
                  className="gloss-btn-secondary min-h-[40px] rounded-xl px-4 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Yopish
                </button>
                <button
                  type="submit"
                  disabled={timerSubmitting}
                  className="gloss-btn-primary min-h-[40px] rounded-xl px-5 text-xs font-semibold disabled:opacity-60"
                >
                  {timerSubmitting ? 'Saqlanmoqda...' : 'Taymerni saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

