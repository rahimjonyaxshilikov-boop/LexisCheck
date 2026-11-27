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

export type CheatEventType = 'fullscreen_exit' | 'tab_switch' | 'away_return';

export interface UnitCheatSummary {
  unitNumber: number;
  unitTitle: string;
  exitCount: number;
  tabSwitchCount: number;
  totalAwaySeconds: number;
  aiSuspected: boolean;
  lastEventAt: string;
}

export interface StudentCheatOverview {
  totalExits: number;
  totalTabSwitches: number;
  totalAwaySeconds: number;
  flaggedUnitsCount: number;
  aiSuspected: boolean;
}

export interface RecordCheatEventPayload {
  unitNumber: number;
  unitTitle: string;
  eventType: CheatEventType;
  awaySeconds?: number;
}

export type AiReviewPriority = 'high' | 'medium' | 'low';

export interface AiTopicRecommendation {
  topicTitle: string;
  unitNumber: number;
  priority: AiReviewPriority;
  reason: string;
  keyWords: string[];
  practiceTip: string;
}

export interface AiReviewRecommendation {
  summary: string;
  strengthsNote: string;
  recommendedTopics: AiTopicRecommendation[];
  studyPlan: string[];
  generatedAt: string;
  model: string;
}

export interface AiMistakeInput {
  questionId: string;
  unitNumber: number;
  unitTitle: string;
  prompt: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
  missCount?: number;
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
  cheatLogs: UnitCheatSummary[];
  cheatOverview: StudentCheatOverview;
  aiRecommendations?: Record<string, AiReviewRecommendation>;
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
