import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentKey,
  calculateStudentAggregates,
  formatCountdown,
  getAllSchoolClasses,
  gradeQuiz,
  isValidSchoolClass,
  normalizeStudentName,
  prepareShuffledQuiz,
} from './quizEngine';
import type { Question, TestAttempt } from '../types/quiz';

test('getAllSchoolClasses generates 18 classes from 5-01 to 10-03', () => {
  const classes = getAllSchoolClasses();
  assert.equal(classes.length, 18);
  assert.equal(classes[0], '5-01');
  assert.equal(classes[classes.length - 1], '10-03');
  assert.ok(classes.includes('8-02'));
  assert.ok(classes.includes('8-03'));
});

test('isValidSchoolClass validates 5-10 with 01-03 sections only', () => {
  assert.equal(isValidSchoolClass('8-03'), true);
  assert.equal(isValidSchoolClass('10-01'), true);
  assert.equal(isValidSchoolClass('5-02'), true);
  assert.equal(isValidSchoolClass('4-01'), false);
  assert.equal(isValidSchoolClass('11-01'), false);
  assert.equal(isValidSchoolClass('8-04'), false);
  assert.equal(isValidSchoolClass('8A'), false);
});

test('student key normalization treats extra spaces and casing uniformly', () => {
  assert.equal(normalizeStudentName('  Aziza   Karimova '), 'Aziza Karimova');
  assert.equal(
    buildStudentKey('Aziza  Karimova', '8-03'),
    buildStudentKey('aziza karimova', '8-03'),
  );
  assert.notEqual(
    buildStudentKey('Aziza Karimova', '8-03'),
    buildStudentKey('Aziza Karimova', '8-02'),
  );
});

test('formatCountdown formats MM:SS cleanly and clamps below zero', () => {
  assert.equal(formatCountdown(600), '10:00');
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-5), '00:00');
});

test('prepareShuffledQuiz preserves correct answer text after shuffling options and questions', () => {
  const sampleQuestions: Question[] = [
    {
      id: 'q1',
      prompt: 'Meaning of thaw',
      options: ['freeze', 'change from frozen to softer', 'boil', 'evaporate'],
      correctIndex: 1,
      explanation: 'Thaw means ice/ground turns softer.',
    },
    {
      id: 'q2',
      prompt: 'Meaning of drought',
      options: ['heavy rain', 'strong wind', 'long period without rain', 'snowstorm'],
      correctIndex: 2,
      explanation: 'Drought means no rain for a long time.',
    },
  ];

  // Seeded deterministic PRNG
  let seed = 42;
  const deterministicRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const shuffled = prepareShuffledQuiz(sampleQuestions, deterministicRng);
  assert.equal(shuffled.length, 2);

  const q1 = shuffled.find((q) => q.id === 'q1');
  const q2 = shuffled.find((q) => q.id === 'q2');
  assert.ok(q1);
  assert.ok(q2);
  assert.equal(q1.options[q1.correctIndex], 'change from frozen to softer');
  assert.equal(q2.options[q2.correctIndex], 'long period without rain');
});

test('gradeQuiz computes correct, wrong, unanswered, points, and mistakes', () => {
  const questions = [
    {
      id: 'u1-1',
      prompt: 'Q1',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Exp 1',
    },
    {
      id: 'u1-2',
      prompt: 'Q2',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      explanation: 'Exp 2',
    },
    {
      id: 'u1-3',
      prompt: 'Q3',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 3,
      explanation: 'Exp 3',
    },
  ];

  const result = gradeQuiz(questions, {
    'u1-1': 0, // correct
    'u1-2': 1, // wrong
    // u1-3 unanswered
  });

  assert.equal(result.totalQuestions, 3);
  assert.equal(result.correctCount, 1);
  assert.equal(result.wrongCount, 2);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.percentage, 33);
  assert.equal(result.pointsEarned, 10);
  assert.equal(result.mistakes.length, 2);
  assert.equal(result.mistakes[0].selectedAnswer, 'B');
  assert.equal(result.mistakes[0].correctAnswer, 'C');
  assert.equal(result.mistakes[1].selectedIndex, null);
  assert.equal(result.mistakes[1].selectedAnswer, 'Javob belgilanmagan');
});

test('calculateStudentAggregates sums best score per unit and averages percentages', () => {
  const attempts: TestAttempt[] = [
    {
      id: 'a1',
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      totalQuestions: 30,
      correctCount: 20,
      wrongCount: 10,
      unansweredCount: 0,
      percentage: 67,
      pointsEarned: 200,
      durationSeconds: 300,
      completedAt: '2026-11-14T10:00:00Z',
      mistakes: [],
    },
    {
      id: 'a2',
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      totalQuestions: 30,
      correctCount: 25,
      wrongCount: 5,
      unansweredCount: 0,
      percentage: 83,
      pointsEarned: 250,
      durationSeconds: 280,
      completedAt: '2026-11-14T10:10:00Z',
      mistakes: [],
    },
    {
      id: 'a3',
      unitNumber: 2,
      unitTitle: 'Organising a vocabulary notebook',
      totalQuestions: 30,
      correctCount: 30,
      wrongCount: 0,
      unansweredCount: 0,
      percentage: 100,
      pointsEarned: 300,
      durationSeconds: 240,
      completedAt: '2026-11-14T10:20:00Z',
      mistakes: [],
    },
  ];

  const agg = calculateStudentAggregates(attempts);
  assert.equal(agg.totalPoints, 550); // best(Unit 1 = 250) + best(Unit 2 = 300)
  assert.deepEqual(agg.completedUnits, [1, 2]);
  assert.equal(agg.averagePercentage, 83);
});
