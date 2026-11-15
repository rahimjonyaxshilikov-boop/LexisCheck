import type { MistakeRecord, StudentProfile, TestAttempt } from '../types/quiz';

export type TrendDirection = 'up' | 'down' | 'same' | 'initial';

export interface AnalyzedAttempt {
  attempt: TestAttempt;
  sequenceNumber: number;
  overallDeltaPct: number | null;
  overallTrend: TrendDirection;
  unitDeltaPct: number | null;
  unitTrend: TrendDirection;
}

export interface UnitProgressSummary {
  unitNumber: number;
  unitTitle: string;
  attemptsCount: number;
  bestPercentage: number;
  bestPoints: number;
  latestPercentage: number;
  growthPct: number | null;
}

export interface StudentAnalytics {
  totalAttempts: number;
  bestAttempt: TestAttempt | null;
  worstAttempt: TestAttempt | null;
  latestAttempt: TestAttempt | null;
  firstAttempt: TestAttempt | null;
  overallGrowthPct: number | null;
  overallTrend: TrendDirection;
  totalCorrect: number;
  totalWrong: number;
  totalDurationSeconds: number;
  chronological: AnalyzedAttempt[];
  newestFirst: AnalyzedAttempt[];
  unitBreakdown: UnitProgressSummary[];
}

export interface MistakeBankItem {
  questionId: string;
  unitNumber: number;
  unitTitle: string;
  prompt: string;
  correctAnswer: string;
  lastSelectedAnswer: string;
  explanation: string;
  missCount: number;
  lastMissedAt: string;
}

export interface ClassPerformanceSummary {
  className: string;
  studentCount: number;
  attemptsCount: number;
  averagePercentage: number;
  totalPoints: number;
}

export interface HardestQuestionSummary {
  questionId: string;
  unitNumber: number;
  unitTitle: string;
  prompt: string;
  correctAnswer: string;
  missCount: number;
}

function resolveTrend(delta: number | null): TrendDirection {
  if (delta === null) return 'initial';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'same';
}

/**
 * Computes chronological statistics, per-test points, and growth/drop trends
 * across all test attempts for a student.
 */
export function analyzeStudentProgress(
  attempts: readonly TestAttempt[],
): StudentAnalytics {
  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      bestAttempt: null,
      worstAttempt: null,
      latestAttempt: null,
      firstAttempt: null,
      overallGrowthPct: null,
      overallTrend: 'initial',
      totalCorrect: 0,
      totalWrong: 0,
      totalDurationSeconds: 0,
      chronological: [],
      newestFirst: [],
      unitBreakdown: [],
    };
  }

  const chronoRaw = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );

  const lastPctByUnit = new Map<number, number>();
  const unitMap = new Map<
    number,
    {
      unitTitle: string;
      firstPct: number;
      latestPct: number;
      bestPct: number;
      bestPoints: number;
      count: number;
    }
  >();

  let bestAttempt = chronoRaw[0];
  let worstAttempt = chronoRaw[0];
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalDurationSeconds = 0;

  const chronological: AnalyzedAttempt[] = chronoRaw.map((attempt, idx) => {
    totalCorrect += attempt.correctCount;
    totalWrong += attempt.wrongCount;
    totalDurationSeconds += attempt.durationSeconds;

    if (
      attempt.percentage > bestAttempt.percentage ||
      (attempt.percentage === bestAttempt.percentage &&
        attempt.pointsEarned > bestAttempt.pointsEarned)
    ) {
      bestAttempt = attempt;
    }
    if (
      attempt.percentage < worstAttempt.percentage ||
      (attempt.percentage === worstAttempt.percentage &&
        attempt.pointsEarned < worstAttempt.pointsEarned)
    ) {
      worstAttempt = attempt;
    }

    const prevOverall = idx > 0 ? chronoRaw[idx - 1] : null;
    const overallDeltaPct = prevOverall
      ? attempt.percentage - prevOverall.percentage
      : null;

    const prevUnitPct = lastPctByUnit.get(attempt.unitNumber);
    const unitDeltaPct =
      prevUnitPct !== undefined ? attempt.percentage - prevUnitPct : null;
    lastPctByUnit.set(attempt.unitNumber, attempt.percentage);

    const existingUnit = unitMap.get(attempt.unitNumber);
    if (!existingUnit) {
      unitMap.set(attempt.unitNumber, {
        unitTitle: attempt.unitTitle,
        firstPct: attempt.percentage,
        latestPct: attempt.percentage,
        bestPct: attempt.percentage,
        bestPoints: attempt.pointsEarned,
        count: 1,
      });
    } else {
      existingUnit.latestPct = attempt.percentage;
      existingUnit.bestPct = Math.max(existingUnit.bestPct, attempt.percentage);
      existingUnit.bestPoints = Math.max(
        existingUnit.bestPoints,
        attempt.pointsEarned,
      );
      existingUnit.count += 1;
    }

    return {
      attempt,
      sequenceNumber: idx + 1,
      overallDeltaPct,
      overallTrend: resolveTrend(overallDeltaPct),
      unitDeltaPct,
      unitTrend: resolveTrend(unitDeltaPct),
    };
  });

  const firstAttempt = chronoRaw[0];
  const latestAttempt = chronoRaw[chronoRaw.length - 1];
  const overallGrowthPct =
    chronoRaw.length >= 2
      ? latestAttempt.percentage - firstAttempt.percentage
      : null;

  const unitBreakdown: UnitProgressSummary[] = Array.from(unitMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([unitNumber, info]) => ({
      unitNumber,
      unitTitle: info.unitTitle,
      attemptsCount: info.count,
      bestPercentage: info.bestPct,
      bestPoints: info.bestPoints,
      latestPercentage: info.latestPct,
      growthPct: info.count >= 2 ? info.latestPct - info.firstPct : null,
    }));

  return {
    totalAttempts: chronoRaw.length,
    bestAttempt,
    worstAttempt,
    latestAttempt,
    firstAttempt,
    overallGrowthPct,
    overallTrend: resolveTrend(overallGrowthPct),
    totalCorrect,
    totalWrong,
    totalDurationSeconds,
    chronological,
    newestFirst: [...chronological].reverse(),
    unitBreakdown,
  };
}

/**
 * Collects unique missed questions across a student's attempts for self-review.
 */
export function collectStudentMistakeBank(
  attempts: readonly TestAttempt[],
): MistakeBankItem[] {
  const sortedDesc = [...attempts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  const byQuestion = new Map<string, MistakeBankItem>();

  for (const attempt of sortedDesc) {
    for (const m of attempt.mistakes) {
      const existing = byQuestion.get(m.questionId);
      if (!existing) {
        byQuestion.set(m.questionId, {
          questionId: m.questionId,
          unitNumber: attempt.unitNumber,
          unitTitle: attempt.unitTitle,
          prompt: m.prompt,
          correctAnswer: m.correctAnswer,
          lastSelectedAnswer: m.selectedAnswer,
          explanation: m.explanation,
          missCount: 1,
          lastMissedAt: attempt.completedAt,
        });
      } else {
        existing.missCount += 1;
      }
    }
  }

  return Array.from(byQuestion.values()).sort((a, b) => {
    if (b.missCount !== a.missCount) return b.missCount - a.missCount;
    return new Date(b.lastMissedAt).getTime() - new Date(a.lastMissedAt).getTime();
  });
}

/**
 * Computes class-level performance summaries and top missed questions for the teacher panel.
 */
export function analyzeClassAndMistakes(
  students: readonly StudentProfile[],
  unitFilter: number | 'all' = 'all',
): {
  classes: ClassPerformanceSummary[];
  hardestQuestions: HardestQuestionSummary[];
} {
  const classMap = new Map<
    string,
    {
      studentCount: number;
      attemptsCount: number;
      pctSum: number;
      totalPoints: number;
    }
  >();

  const questionMissMap = new Map<
    string,
    HardestQuestionSummary
  >();

  for (const student of students) {
    const relevantAttempts =
      unitFilter === 'all'
        ? student.attempts
        : student.attempts.filter((a) => a.unitNumber === unitFilter);

    if (unitFilter !== 'all' && relevantAttempts.length === 0) {
      continue;
    }

    const cls = classMap.get(student.className) ?? {
      studentCount: 0,
      attemptsCount: 0,
      pctSum: 0,
      totalPoints: 0,
    };
    cls.studentCount += 1;
    cls.attemptsCount += relevantAttempts.length;
    cls.totalPoints +=
      unitFilter === 'all'
        ? student.totalPoints
        : relevantAttempts.reduce((max, a) => Math.max(max, a.pointsEarned), 0);
    for (const a of relevantAttempts) {
      cls.pctSum += a.percentage;
      for (const m of a.mistakes as readonly MistakeRecord[]) {
        const entry = questionMissMap.get(m.questionId);
        if (!entry) {
          questionMissMap.set(m.questionId, {
            questionId: m.questionId,
            unitNumber: a.unitNumber,
            unitTitle: a.unitTitle,
            prompt: m.prompt,
            correctAnswer: m.correctAnswer,
            missCount: 1,
          });
        } else {
          entry.missCount += 1;
        }
      }
    }
    classMap.set(student.className, cls);
  }

  const classes: ClassPerformanceSummary[] = Array.from(classMap.entries())
    .map(([className, data]) => ({
      className,
      studentCount: data.studentCount,
      attemptsCount: data.attemptsCount,
      averagePercentage:
        data.attemptsCount > 0 ? Math.round(data.pctSum / data.attemptsCount) : 0,
      totalPoints: data.totalPoints,
    }))
    .sort((a, b) => {
      if (b.averagePercentage !== a.averagePercentage) {
        return b.averagePercentage - a.averagePercentage;
      }
      return b.totalPoints - a.totalPoints;
    });

  const hardestQuestions = Array.from(questionMissMap.values())
    .sort((a, b) => b.missCount - a.missCount)
    .slice(0, 5);

  return { classes, hardestQuestions };
}
