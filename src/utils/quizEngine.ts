import type {
  MistakeRecord,
  Question,
  ShuffledQuestion,
  TestAttempt,
} from '../types/quiz';

export const TOTAL_UNITS = 101;
export const TEST_DURATION_SECONDS = 10 * 60; // 10 minutes per unit test
export const POINTS_PER_CORRECT = 10;

export const SCHOOL_GRADES = [5, 6, 7, 8, 9, 10] as const;
export const SCHOOL_SECTIONS = ['01', '02', '03'] as const;

export function getAllSchoolClasses(): string[] {
  const classes: string[] = [];
  for (const grade of SCHOOL_GRADES) {
    for (const section of SCHOOL_SECTIONS) {
      classes.push(`${grade}-${section}`);
    }
  }
  return classes;
}

export function isValidSchoolClass(className: string): boolean {
  return /^(5|6|7|8|9|10)-0[1-3]$/.test(className.trim());
}

export function normalizeStudentName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ');
}

export function buildStudentKey(fullName: string, className: string): string {
  return `${normalizeStudentName(fullName).toLowerCase()}::${className.trim()}`;
}

export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Shuffles both the order of questions and the order of options within each question,
 * preserving the exact correct answer mapping.
 */
export function prepareShuffledQuiz(
  questions: readonly Question[],
  rng: () => number = Math.random,
): ShuffledQuestion[] {
  const shuffledQuestions = shuffleArray(questions, rng);
  return shuffledQuestions.map((q) => {
    const indexedOptions = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
    }));
    const shuffledOptions = shuffleArray(indexedOptions, rng);
    const newCorrectIndex = shuffledOptions.findIndex((o) => o.isCorrect);
    return {
      id: q.id,
      prompt: q.prompt,
      options: shuffledOptions.map((o) => o.text),
      correctIndex: newCorrectIndex,
      explanation: q.explanation,
    };
  });
}

export interface GradeQuizResult {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentage: number;
  pointsEarned: number;
  mistakes: MistakeRecord[];
}

export function gradeQuiz(
  questions: readonly ShuffledQuestion[],
  answers: Record<string, number | undefined>,
): GradeQuizResult {
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  const mistakes: MistakeRecord[] = [];

  for (const q of questions) {
    const selected = answers[q.id];
    if (selected === undefined || selected === null) {
      unansweredCount++;
      wrongCount++;
      mistakes.push({
        questionId: q.id,
        prompt: q.prompt,
        options: [...q.options],
        selectedIndex: null,
        correctIndex: q.correctIndex,
        selectedAnswer: 'Javob belgilanmagan',
        correctAnswer: q.options[q.correctIndex] ?? '',
        explanation: q.explanation,
      });
    } else if (selected === q.correctIndex) {
      correctCount++;
    } else {
      wrongCount++;
      mistakes.push({
        questionId: q.id,
        prompt: q.prompt,
        options: [...q.options],
        selectedIndex: selected,
        correctIndex: q.correctIndex,
        selectedAnswer: q.options[selected] ?? 'Nomaʼlum javob',
        correctAnswer: q.options[q.correctIndex] ?? '',
        explanation: q.explanation,
      });
    }
  }

  const totalQuestions = questions.length;
  const percentage =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const pointsEarned = correctCount * POINTS_PER_CORRECT;

  return {
    totalQuestions,
    correctCount,
    wrongCount,
    unansweredCount,
    percentage,
    pointsEarned,
    mistakes,
  };
}

/**
 * Computes cumulative total points by taking the highest pointsEarned per unit
 * so students build mastery across all 101 units rather than farming one unit.
 */
export function calculateStudentAggregates(attempts: readonly TestAttempt[]): {
  totalPoints: number;
  completedUnits: number[];
  averagePercentage: number;
} {
  if (attempts.length === 0) {
    return { totalPoints: 0, completedUnits: [], averagePercentage: 0 };
  }

  const bestPointsByUnit = new Map<number, number>();
  let percentageSum = 0;

  for (const attempt of attempts) {
    const prevBest = bestPointsByUnit.get(attempt.unitNumber) ?? 0;
    if (attempt.pointsEarned > prevBest) {
      bestPointsByUnit.set(attempt.unitNumber, attempt.pointsEarned);
    }
    percentageSum += attempt.percentage;
  }

  let totalPoints = 0;
  for (const pts of bestPointsByUnit.values()) {
    totalPoints += pts;
  }

  const completedUnits = Array.from(bestPointsByUnit.keys()).sort((a, b) => a - b);
  const averagePercentage = Math.round(percentageSum / attempts.length);

  return { totalPoints, completedUnits, averagePercentage };
}
