import { LogOut, Moon, Sun } from 'lucide-react';
import type { AppView, StudentProfile } from '../types/quiz';

interface HeaderProps {
  view: AppView;
  student: StudentProfile | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (target: AppView) => void;
  onStudentLogout: () => void;
}

export function Header({
  view,
  student,
  darkMode,
  onToggleDarkMode,
  onNavigate,
  onStudentLogout,
}: HeaderProps) {
  return (
    <header className="gloss-header sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-8 sm:px-6 sm:py-3.5">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate(student ? 'units' : 'login')}
          className="font-display text-base font-bold tracking-tight text-slate-900 transition-colors hover:opacity-85 whitespace-nowrap shrink-0 sm:text-xl dark:text-slate-100"
        >
          Lexis<span className="text-indigo-600 dark:text-indigo-400">Check</span>
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Asosiy navigatsiya"
          className="flex items-center gap-3 text-xs font-medium sm:gap-7 sm:text-sm"
        >
          {student ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('units')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  view === 'units'
                    ? 'text-indigo-600 underline decoration-indigo-500/80 decoration-2 underline-offset-6 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Unitlar
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  view === 'profile'
                    ? 'text-indigo-600 underline decoration-indigo-500/80 decoration-2 underline-offset-6 dark:text-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Profilim
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                view === 'login'
                  ? 'text-indigo-600 underline decoration-indigo-500/80 decoration-2 underline-offset-6 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Kirish
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('teacher')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              view === 'teacher'
                ? 'text-indigo-600 underline decoration-indigo-500/80 decoration-2 underline-offset-6 dark:text-indigo-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Oʻqituvchi
          </button>
        </nav>

        {/* Zone 3: Theme toggle + primary exit action */}
        <div className="flex items-center gap-1.5 shrink-0 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? "Kunduzgi rejimga o'tish" : "Tun rejimiga o'tish"}
            className="gloss-btn-secondary inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 sm:h-10 sm:w-10 dark:text-slate-200"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4" />}
          </button>

          {student && (
            <button
              type="button"
              onClick={onStudentLogout}
              aria-label="Akkauntdan chiqish"
              className="gloss-btn-secondary inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 sm:h-10 sm:w-auto sm:px-3.5 dark:text-slate-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
