import test from 'node:test';
import assert from 'node:assert/strict';
import type { StudentProfile, TestAttempt } from '../types/quiz';
import {
  analyzeClassAndMistakes,
  analyzeStudentProgress,
  collectStudentMistakeBank,
} from './studentAnalytics';

function makeAttempt(
  id: string,
  unitNumber: number,
  percentage: number,
  completedAt: string,
  mistakes: TestAttempt['mistakes'] = [],
): TestAttempt {
  const correctCount = Math.round((percentage / 100) * 30);
  return {
    id,
    unitNumber,
    unitTitle: `Unit ${unitNumber}`,
    totalQuestions: 30,
    correctCount,
    wrongCount: 30 - correctCount,
    unansweredCount: 0,
    percentage,
    pointsEarned: correctCount * 10,
    durationSeconds: 180,
    completedAt,
    mistakes,
  };
}

test('analyzeStudentProgress returns empty summary when student has no attempts', () => {
  const analytics = analyzeStudentProgress([]);
  assert.equal(analytics.totalAttempts, 0);
  assert.equal(analytics.bestAttempt, null);
  assert.equal(analytics.overallGrowthPct, null);
});

test('analyzeStudentProgress computes chronological deltas, unit growth, and rises/drops', () => {
  const attempts = [
    makeAttempt('a3', 1, 90, '2026-11-14T12:00:00.000Z'),
    makeAttempt('a1', 1, 60, '2026-11-14T10:00:00.000Z'),
    makeAttempt('a2', 2, 50, '2026-11-14T11:00:00.000Z'),
  ];

  const analytics = analyzeStudentProgress(attempts);

  assert.equal(analytics.totalAttempts, 3);
  assert.equal(analytics.bestAttempt?.id, 'a3');
  assert.equal(analytics.worstAttempt?.id, 'a2');
  assert.equal(analytics.overallGrowthPct, 30);
  assert.equal(analytics.overallTrend, 'up');

  assert.equal(analytics.chronological[0].attempt.id, 'a1');
  assert.equal(analytics.chronological[0].overallDeltaPct, null);
  assert.equal(analytics.chronological[0].overallTrend, 'initial');

  assert.equal(analytics.chronological[1].attempt.id, 'a2');
  assert.equal(analytics.chronological[1].overallDeltaPct, -10);
  assert.equal(analytics.chronological[1].overallTrend, 'down');

  assert.equal(analytics.chronological[2].attempt.id, 'a3');
  assert.equal(analytics.chronological[2].overallDeltaPct, 40);
  assert.equal(analytics.chronological[2].overallTrend, 'up');
  assert.equal(analytics.chronological[2].unitDeltaPct, 30);
  assert.equal(analytics.chronological[2].unitTrend, 'up');
});

test('collectStudentMistakeBank deduplicates repeated mistakes and counts occurrences', () => {
  const mistake1 = {
    questionId: 'u1-q01',
    prompt: 'What is a synonym of brisk?',
    options: ['quick', 'slow', 'late', 'cold'],
    selectedIndex: 1,
    correctIndex: 0,
    selectedAnswer: 'slow',
    correctAnswer: 'quick',
    explanation: 'Brisk means quick and energetic.',
  };
  const mistake2 = {
    questionId: 'u2-q04',
    prompt: 'What does overcast mean?',
    options: ['very cloudy', 'sunny', 'windy', 'frosty'],
    selectedIndex: 1,
    correctIndex: 0,
    selectedAnswer: 'sunny',
    correctAnswer: 'very cloudy',
    explanation: 'Overcast sky is cloudy.',
  };

  const bank = collectStudentMistakeBank([
    makeAttempt('a1', 1, 80, '2026-11-14T10:00:00.000Z', [mistake1]),
    makeAttempt('a2', 1, 90, '2026-11-14T11:00:00.000Z', [mistake1]),
    makeAttempt('a3', 2, 70, '2026-11-14T12:00:00.000Z', [mistake2]),
  ]);

  assert.equal(bank.length, 2);
  assert.equal(bank[0].questionId, 'u1-q01');
  assert.equal(bank[0].missCount, 2);
  assert.equal(bank[1].questionId, 'u2-q04');
  assert.equal(bank[1].missCount, 1);
});

test('analyzeClassAndMistakes aggregates class averages and hardest questions', () => {
  const sharedMistake = {
    questionId: 'u6-q05',
    prompt: 'What is a drought?',
    options: ['a long period with no rain', 'heavy rain', 'strong wind', 'frost'],
    selectedIndex: 1,
    correctIndex: 0,
    selectedAnswer: 'heavy rain',
    correctAnswer: 'a long period with no rain',
    explanation: 'Drought means no rain.',
  };

  const emptyCheat = {
    cheatLogs: [],
    cheatOverview: {
      totalExits: 0,
      totalTabSwitches: 0,
      totalAwaySeconds: 0,
      flaggedUnitsCount: 0,
      aiSuspected: false,
    },
  };

  const students: StudentProfile[] = [
    {
      id: 's1',
      fullName: 'Ali Valiyev',
      className: '8-03',
      totalPoints: 240,
      completedUnits: [6],
      studiedUnits: [],
      averagePercentage: 80,
      attempts: [makeAttempt('a1', 6, 80, '2026-11-14T10:00:00.000Z', [sharedMistake])],
      ...emptyCheat,
      createdAt: '2026-11-14T09:00:00.000Z',
    },
    {
      id: 's2',
      fullName: 'Malika Karimova',
      className: '8-02',
      totalPoints: 180,
      completedUnits: [6],
      studiedUnits: [],
      averagePercentage: 60,
      attempts: [makeAttempt('a2', 6, 60, '2026-11-14T11:00:00.000Z', [sharedMistake])],
      ...emptyCheat,
      createdAt: '2026-11-14T09:00:00.000Z',
    },
  ];

  const summary = analyzeClassAndMistakes(students);
  assert.equal(summary.classes.length, 2);
  assert.equal(summary.classes[0].className, '8-03');
  assert.equal(summary.classes[0].averagePercentage, 80);
  assert.equal(summary.hardestQuestions.length, 1);
  assert.equal(summary.hardestQuestions[0].questionId, 'u6-q05');
  assert.equal(summary.hardestQuestions[0].missCount, 2);
});
