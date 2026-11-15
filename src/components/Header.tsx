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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate(student ? 'units' : 'login')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 transition-colors hover:text-sky-700 whitespace-nowrap shrink-0 dark:text-slate-100 dark:hover:text-sky-400"
        >
          LexisCheck
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Asosiy navigatsiya"
          className="flex items-center gap-4 text-sm font-medium sm:gap-6"
        >
          {student ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('units')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  view === 'units'
                    ? 'text-sky-700 underline decoration-2 underline-offset-4 dark:text-sky-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Unitlar
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  view === 'profile'
                    ? 'text-sky-700 underline decoration-2 underline-offset-4 dark:text-sky-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
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
                  ? 'text-sky-700 underline decoration-2 underline-offset-4 dark:text-sky-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
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
                ? 'text-sky-700 underline decoration-2 underline-offset-4 dark:text-sky-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Oʻqituvchi
          </button>
        </nav>

        {/* Zone 3: Theme toggle + primary exit action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? "Kunduzgi rejimga o'tish" : "Tun rejimiga o'tish"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {student && (
            <button
              type="button"
              onClick={onStudentLogout}
              aria-label="Akkauntdan chiqish"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
