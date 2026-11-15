export interface VocabItem {
  term: string;
  meaning: string;
  example: string;
  partOfSpeech?: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface ShuffledQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface UnitData {
  unitNumber: number;
  title: string;
  subtitle: string;
  vocab: VocabItem[];
  questions: Question[];
}

export interface MistakeRecord {
  questionId: string;
  prompt: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export interface TestAttempt {
  id: string;
  unitNumber: number;
  unitTitle: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  percentage: number;
  pointsEarned: number;
  durationSeconds: number;
  completedAt: string;
  mistakes: MistakeRecord[];
}

export interface StudentProfile {
  id: string;
  fullName: string;
  className: string;
  totalPoints: number;
  completedUnits: number[];
  studiedUnits: number[];
  averagePercentage: number;
  attempts: TestAttempt[];
  createdAt: string;
}

export interface StudentSummaryForTeacher extends StudentProfile {
  lastActiveAt: string | null;
}

export type AppView =
  | 'login'
  | 'units'
  | 'testing'
  | 'results'
  | 'profile'
  | 'teacher';
