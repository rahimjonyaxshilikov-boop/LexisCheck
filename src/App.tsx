import { useEffect, useState } from 'react';
import type { AppView, StudentProfile as StudentProfileType, TestAttempt, UnitData } from './types/quiz';
import { getUnitByNumber } from './data/units';
import {
  enterStudentAccount,
  fetchOwnStudentProfile,
  setSavedStudentToken,
  submitTestAttempt,
} from './utils/api';
import type { GradeQuizResult } from './utils/quizEngine';
import {
  exitAppFullscreen,
  isCheaterLockedInStorage,
  requestAppFullscreen,
  setCheaterLockedInStorage,
} from './utils/antiCheat';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { UnitsMenu } from './components/UnitsMenu';
import { TestRunner } from './components/TestRunner';
import { ResultsView } from './components/ResultsView';
import { StudentProfile } from './components/StudentProfile';
import { TeacherPanel } from './components/TeacherPanel';
import { CheaterLockScreen } from './components/CheaterLockScreen';

const DARK_MODE_KEY = 'lexischeck_dark_mode';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(DARK_MODE_KEY);
      if (saved === 'true') return true;
      if (saved === 'false') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const [view, setView] = useState<AppView>('login');
  const [student, setStudent] = useState<StudentProfileType | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeUnit, setActiveUnit] = useState<UnitData | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<TestAttempt | null>(null);
  const [cheaterLocked, setCheaterLocked] = useState<boolean>(() =>
    isCheaterLockedInStorage(),
  );

  // Sync `.dark` class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(DARK_MODE_KEY, String(darkMode));
    } catch {
      // Ignore storage error
    }
  }, [darkMode]);

  // Restore active student session on reload if token exists
  useEffect(() => {
    let mounted = true;
    async function restore() {
      try {
        const profile = await fetchOwnStudentProfile();
        if (mounted && profile) {
          setStudent(profile);
          setView('units');
        }
      } finally {
        if (mounted) setBootstrapping(false);
      }
    }
    void restore();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleStudentEnter(fullName: string, className: string) {
    const res = await enterStudentAccount(fullName, className);
    setStudent(res.profile);
    setView('units');
  }

  function handleStudentLogout() {
    setSavedStudentToken(null);
    setStudent(null);
    setActiveUnit(null);
    setActiveAttempt(null);
    setView('login');
  }

  function handleStartUnit(unit: UnitData) {
    if (cheaterLocked || isCheaterLockedInStorage()) return;
    void requestAppFullscreen();
    setActiveUnit(unit);
    setView('testing');
  }

  function handleTriggerCheaterLock() {
    setCheaterLockedInStorage(true);
    setCheaterLocked(true);
  }

  function handleUnlockCheater() {
    setCheaterLockedInStorage(false);
    setCheaterLocked(false);
    setActiveUnit(null);
    void exitAppFullscreen();
    setView(student ? 'units' : 'login');
  }

  async function handleFinishTest(result: GradeQuizResult, elapsedSeconds: number) {
    if (!activeUnit) return;
    const saved = await submitTestAttempt({
      unitNumber: activeUnit.unitNumber,
      unitTitle: activeUnit.title,
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      unansweredCount: result.unansweredCount,
      percentage: result.percentage,
      pointsEarned: result.pointsEarned,
      durationSeconds: elapsedSeconds,
      mistakes: result.mistakes,
    });
    setStudent(saved.profile);
    setActiveAttempt(saved.attempt);
    setActiveUnit(null);
    setView('results');
    void exitAppFullscreen();
  }

  function handleNavigate(target: AppView) {
    if (target === 'teacher') {
      setView('teacher');
      return;
    }
    if (!student) {
      setView('login');
      return;
    }
    setView(target);
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Yuklanmoqda...
      </div>
    );
  }

  if (cheaterLocked) {
    return <CheaterLockScreen onUnlock={handleUnlockCheater} />;
  }

  // Distraction-free test mode replaces standard Header with slim TestRunner bar
  if (view === 'testing' && activeUnit && student) {
    return (
      <TestRunner
        unit={activeUnit}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onFinishTest={handleFinishTest}
        onCancelTest={() => {
          void exitAppFullscreen();
          setActiveUnit(null);
          setView('units');
        }}
        onTriggerCheaterLock={handleTriggerCheaterLock}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        view={view}
        student={student}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onNavigate={handleNavigate}
        onStudentLogout={handleStudentLogout}
      />

      {view === 'login' && (
        <LoginScreen
          onSuccessEnter={handleStudentEnter}
          onOpenTeacher={() => setView('teacher')}
        />
      )}

      {view === 'units' && student && (
        <UnitsMenu
          student={student}
          onStartUnit={handleStartUnit}
          onOpenProfile={() => setView('profile')}
        />
      )}

      {view === 'results' && student && activeAttempt && (
        <ResultsView
          student={student}
          attempt={activeAttempt}
          onBackToUnits={() => setView('units')}
          onStartUnitNumber={(unitNumber) => {
            const unit = getUnitByNumber(unitNumber);
            if (unit) handleStartUnit(unit);
          }}
        />
      )}

      {view === 'profile' && student && (
        <StudentProfile
          student={student}
          onBackToUnits={() => setView('units')}
          onInspectAttempt={(attempt) => {
            setActiveAttempt(attempt);
            setView('results');
          }}
          onRetakeUnit={(unitNumber) => {
            const unit = getUnitByNumber(unitNumber);
            if (unit) handleStartUnit(unit);
          }}
        />
      )}

      {view === 'teacher' && (
        <TeacherPanel onBack={() => setView(student ? 'units' : 'login')} />
      )}
    </div>
  );
}
