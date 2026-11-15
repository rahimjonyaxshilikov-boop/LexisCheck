import { useMemo, useState } from 'react';
import { CheckCircle2, Play, Search } from 'lucide-react';
import type { StudentProfile, UnitData } from '../types/quiz';
import { ALL_UNITS } from '../data/units';

interface UnitsMenuProps {
  student: StudentProfile;
  onStartUnit: (unit: UnitData) => void;
  onOpenProfile: () => void;
}

type UnitFilter = 'all' | 'pending' | 'completed';
type UnitSort = 'number' | 'pending-first' | 'lowest-score';

export function UnitsMenu({
  student,
  onStartUnit,
  onOpenProfile,
}: UnitsMenuProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UnitFilter>('all');
  const [sortBy, setSortBy] = useState<UnitSort>('number');

  const bestAttemptByUnit = useMemo(() => {
    const map = new Map<
      number,
      { bestScore: number; bestPercentage: number; attemptsCount: number }
    >();
    for (const attempt of student.attempts) {
      const prev = map.get(attempt.unitNumber);
      if (!prev) {
        map.set(attempt.unitNumber, {
          bestScore: attempt.pointsEarned,
          bestPercentage: attempt.percentage,
          attemptsCount: 1,
        });
      } else {
        map.set(attempt.unitNumber, {
          bestScore: Math.max(prev.bestScore, attempt.pointsEarned),
          bestPercentage: Math.max(prev.bestPercentage, attempt.percentage),
          attemptsCount: prev.attemptsCount + 1,
        });
      }
    }
    return map;
  }, [student.attempts]);

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = ALL_UNITS.filter((unit) => {
      const isDone = bestAttemptByUnit.has(unit.unitNumber);
      if (filter === 'completed' && !isDone) return false;
      if (filter === 'pending' && isDone) return false;
      if (!query) return true;
      return (
        unit.title.toLowerCase().includes(query) ||
        unit.subtitle.toLowerCase().includes(query) ||
        `unit ${unit.unitNumber}`.includes(query) ||
        String(unit.unitNumber) === query
      );
    });

    if (sortBy === 'pending-first') {
      return [...list].sort((a, b) => {
        const aDone = bestAttemptByUnit.has(a.unitNumber) ? 1 : 0;
        const bDone = bestAttemptByUnit.has(b.unitNumber) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.unitNumber - b.unitNumber;
      });
    }

    if (sortBy === 'lowest-score') {
      return [...list].sort((a, b) => {
        const aPct = bestAttemptByUnit.get(a.unitNumber)?.bestPercentage ?? -1;
        const bPct = bestAttemptByUnit.get(b.unitNumber)?.bestPercentage ?? -1;
        if (aPct !== bPct) return aPct - bPct;
        return a.unitNumber - b.unitNumber;
      });
    }

    return list;
  }, [search, filter, sortBy, bestAttemptByUnit]);

  const completionPct = Math.round((student.completedUnits.length / ALL_UNITS.length) * 100);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Student header summary strip */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Oʻquvchi profili</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-300">
                {student.className} sinf
              </span>
            </div>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
              {student.fullName}
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4 sm:border-t-0 sm:pt-0 sm:text-right dark:border-slate-800">
            <div>
              <div className="font-mono-tabular text-xl font-bold text-sky-700 sm:text-2xl dark:text-sky-400">
                {student.totalPoints}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Umumiy ball</div>
            </div>
            <div>
              <div className="font-mono-tabular text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">
                {student.completedUnits.length}/20
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Unit bajarildi</div>
            </div>
            <div>
              <div className="font-mono-tabular text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">
                {student.averagePercentage}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Oʻrtacha</div>
            </div>
          </div>
        </div>

        {/* Course Completion Progress Bar */}
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Umumiy oʻzlashtirish</span>
            <span className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-200">
              {student.completedUnits.length} / 20 unit ({completionPct}%)
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-600 transition-[width] duration-300 dark:bg-sky-400"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Toolbar: Search + Filter Tabs + Sort */}
      <section className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Unit nomi yoki raqami boʻyicha qidirish..."
            aria-label="Unit qidirish"
            className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900"
            role="tablist"
            aria-label="Unitlar filtri"
          >
            {(
              [
                { id: 'all', label: 'Barchasi (20)' },
                { id: 'pending', label: 'Ishlanmagan' },
                { id: 'completed', label: 'Bajarilgan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as UnitSort)}
            aria-label="Unitlarni saralash"
            className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-sky-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="number">Tartib: Unit raqami</option>
            <option value="pending-first">Avval ishlanmaganlar</option>
            <option value="lowest-score">Eng past natijadan</option>
          </select>

          <button
            type="button"
            onClick={onOpenProfile}
            className="hidden min-h-[42px] items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 md:inline-flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Natijalar tarixi ({student.attempts.length})
          </button>
        </div>
      </section>

      {/* Units Grid */}
      {filteredUnits.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Mos unit topilmadi. Qidiruv yoki filtrni oʻzgartirib koʻring.
          </p>
        </div>
      ) : (
        <section
          aria-label="Unitlar ro'yxati"
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredUnits.map((unit) => {
            const stats = bestAttemptByUnit.get(unit.unitNumber);
            return (
              <article
                key={unit.unitNumber}
                data-testid={`unit-card-${unit.unitNumber}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-tabular font-semibold text-sky-700 dark:text-sky-400">
                      Unit {String(unit.unitNumber).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <span>{unit.questions.length} savol</span>
                      <span aria-hidden="true">·</span>
                      <span>10 daq</span>
                    </div>
                  </div>

                  <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {unit.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {unit.subtitle}
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {stats ? (
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Bajarilgan ({stats.attemptsCount}x)
                      </span>
                      <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-300">
                        Eng yaxshi: {stats.bestPercentage}% ({stats.bestScore} ball)
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Hali ishlanmagan</span>
                      <span className="font-mono-tabular">Maks: {unit.questions.length * 10} ball</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onStartUnit(unit)}
                    className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{stats ? 'Qayta ishlash' : 'Testni boshlash'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
