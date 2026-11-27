import test from 'node:test';
import assert from 'node:assert/strict';
import type { StudentProfile, TestAttempt } from '../types/quiz';
import {
  buildResultImageFilename,
  buildResultShareText,
  buildTelegramShareUrl,
} from './resultShare';

const mockStudent: StudentProfile = {
  id: 's1',
  fullName: 'Jasur Aliyev',
  className: '9-02',
  totalPoints: 240,
  completedUnits: [6],
  studiedUnits: [6],
  averagePercentage: 80,
  attempts: [],
  cheatLogs: [],
  cheatOverview: {
    totalExits: 0,
    totalTabSwitches: 0,
    totalAwaySeconds: 0,
    flaggedUnitsCount: 0,
    aiSuspected: false,
  },
  createdAt: '2026-11-14T10:00:00.000Z',
};

const mockAttempt: TestAttempt = {
  id: 'a1',
  unitNumber: 6,
  unitTitle: 'The weather',
  totalQuestions: 30,
  correctCount: 24,
  wrongCount: 6,
  unansweredCount: 0,
  percentage: 80,
  pointsEarned: 240,
  durationSeconds: 185,
  completedAt: '2026-11-14T10:05:00.000Z',
  mistakes: [],
};

test('buildResultShareText formats student info, score, points and unit', () => {
  const text = buildResultShareText(mockStudent, mockAttempt);
  assert.ok(text.includes('Jasur Aliyev (9-02 sinf)'));
  assert.ok(text.includes('Unit 6: The weather'));
  assert.ok(text.includes('80% (24/30)'));
  assert.ok(text.includes('+240 ball'));
  assert.ok(text.includes('240 ball'));
});

test('buildTelegramShareUrl produces valid t.me/share/url link', () => {
  const url = buildTelegramShareUrl('Test result text', 'https://example.com');
  assert.ok(url.startsWith('https://t.me/share/url?'));
  assert.ok(url.includes('text=Test+result+text'));
  assert.ok(url.includes('url=https%3A%2F%2Fexample.com'));
});

test('buildResultImageFilename creates clean PNG filename', () => {
  assert.equal(
    buildResultImageFilename(mockStudent, mockAttempt),
    'LexisCheck-Unit-6-jasur-aliyev.png',
  );
});
