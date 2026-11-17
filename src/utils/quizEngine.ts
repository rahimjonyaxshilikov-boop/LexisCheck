import type {
  MistakeRecord,
  Question,
  ShuffledQuestion,
  TestAttempt,
} from '../types/quiz';

export const TOTAL_UNITS = 101;
export const DEFAULT_TEST_DURATION_MINUTES = 15;
export const MIN_TEST_DURATION_MINUTES = 1;
export const MAX_TEST_DURATION_MINUTES = 120;
export const TEST_DURATION_SECONDS = DEFAULT_TEST_DURATION_MINUTES * 60; // 15 minutes default per unit test
export const POINTS_PER_CORRECT = 10;

export function validateTestDurationMinutes(
  value: unknown,
): { ok: true; minutes: number } | { ok: false; error: string } {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return {
      ok: false,
      error: "Taymer qiymati butun son (daqiqa) bo'lishi kerak.",
    };
  }
  if (num < MIN_TEST_DURATION_MINUTES || num > MAX_TEST_DURATION_MINUTES) {
    return {
      ok: false,
      error: `Taymer davomiyligi ${MIN_TEST_DURATION_MINUTES} dan ${MAX_TEST_DURATION_MINUTES} daqiqagacha bo'lishi kerak.`,
    };
  }
  return { ok: true, minutes: num };
}

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

export function normalizeComparableText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['’`ʻʼʽˈ]/g, '')
    .toLowerCase();
}

export function normalizeStudentName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ');
}

export function buildStudentKey(fullName: string, className: string): string {
  return `${normalizeComparableText(fullName)}::${className.trim()}`;
}

export function buildStudentTokenBagKey(fullName: string, className: string): string {
  const tokens = normalizeComparableText(fullName)
    .split(' ')
    .filter(Boolean)
    .sort();
  return `${tokens.join('|')}::${className.trim()}`;
}

const SURNAME_SUFFIX_RE =
  /^[a-z]{3,}(?:ov|ova|ev|eva|yev|yeva|ovich|ovna|evich|evna|skiy|skaya)$/;
const NON_SURNAME_GIVEN_NAMES = new Set(['yakov']);

export function looksLikeUzbekSurname(token: string): boolean {
  const cleaned = normalizeComparableText(token).replace(/[^a-z]/g, '');
  if (cleaned.length < 5 || NON_SURNAME_GIVEN_NAMES.has(cleaned)) return false;
  return SURNAME_SUFFIX_RE.test(cleaned);
}

export function validateStudentNameOrder(
  rawName: string,
):
  | { ok: true; fullName: string }
  | {
      ok: false;
      code: 'INVALID_INPUT' | 'SURNAME_FIRST';
      error: string;
      suggestedName?: string;
    } {
  const fullName = normalizeStudentName(rawName);
  const parts = fullName.split(' ').filter(Boolean);

  if (fullName.length < 3 || parts.length < 2) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: "Iltimos, to'liq ism va familiyangizni kiriting (masalan: Aziza Karimova).",
    };
  }

  if (looksLikeUzbekSurname(parts[0]) && !looksLikeUzbekSurname(parts[1])) {
    const suggestedParts =
      parts.length === 2 ? [parts[1], parts[0]] : [parts[1], parts[0], ...parts.slice(2)];
    const suggestedName = suggestedParts.join(' ');
    return {
      ok: false,
      code: 'SURNAME_FIRST',
      error: `Avval ismingizni, keyin familiyangizni yozing (masalan: ${suggestedName}).`,
      suggestedName,
    };
  }

  return { ok: true, fullName };
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

export interface MasteryRankInfo {
  title: string;
  level: number;
  nextTitle: string | null;
  nextThresholdPoints: number | null;
  progressPercent: number;
}

const MASTERY_TIERS: readonly { minPoints: number; title: string }[] = [
  { minPoints: 0, title: 'Boshlovchi' },
  { minPoints: 500, title: 'Faol oʻquvchi' },
  { minPoints: 2000, title: 'Bilimdon' },
  { minPoints: 6000, title: 'Ekspert' },
  { minPoints: 15000, title: 'Master Lexicon' },
];

export function getStudentMasteryRank(totalPoints: number): MasteryRankInfo {
  const safePoints = Math.max(0, totalPoints);
  let tierIdx = 0;
  for (let i = 0; i < MASTERY_TIERS.length; i++) {
    if (safePoints >= MASTERY_TIERS[i].minPoints) {
      tierIdx = i;
    }
  }
  const current = MASTERY_TIERS[tierIdx];
  const next = MASTERY_TIERS[tierIdx + 1] ?? null;

  if (!next) {
    return {
      title: current.title,
      level: tierIdx + 1,
      nextTitle: null,
      nextThresholdPoints: null,
      progressPercent: 100,
    };
  }

  const span = next.minPoints - current.minPoints;
  const gained = safePoints - current.minPoints;
  const progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));

  return {
    title: current.title,
    level: tierIdx + 1,
    nextTitle: next.title,
    nextThresholdPoints: next.minPoints,
    progressPercent,
  };
}
