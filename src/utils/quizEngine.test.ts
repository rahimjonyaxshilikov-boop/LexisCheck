import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentKey,
  buildStudentTokenBagKey,
  calculateStudentAggregates,
  DEFAULT_TEST_DURATION_MINUTES,
  formatCountdown,
  getAllSchoolClasses,
  getStudentMasteryRank,
  gradeQuiz,
  isValidSchoolClass,
  looksLikeUzbekSurname,
  normalizeComparableText,
  normalizeStudentName,
  prepareShuffledQuiz,
  TEST_DURATION_SECONDS,
  validateStudentNameOrder,
  validateTestDurationMinutes,
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

test('student key normalization treats extra spaces, apostrophes, token order, and casing uniformly', () => {
  assert.equal(normalizeStudentName('  Aziza   Karimova '), 'Aziza Karimova');
  assert.equal(
    normalizeComparableText("O'tkir  Gʻaniyev"),
    normalizeComparableText("O`tkir G'aniyev"),
  );
  assert.equal(
    buildStudentKey('Aziza  Karimova', '8-03'),
    buildStudentKey('aziza karimova', '8-03'),
  );
  assert.equal(
    buildStudentKey("O'tkir G'aniyev", '8-03'),
    buildStudentKey('Oʻtkir Gʻaniyev', '8-03'),
  );
  assert.equal(
    buildStudentTokenBagKey('Karimova Aziza', '8-03'),
    buildStudentTokenBagKey('Aziza Karimova', '8-03'),
  );
  assert.notEqual(
    buildStudentKey('Aziza Karimova', '8-03'),
    buildStudentKey('Aziza Karimova', '8-02'),
  );
});

test('looksLikeUzbekSurname and validateStudentNameOrder detect surname-first entries accurately', () => {
  assert.equal(looksLikeUzbekSurname('Karimova'), true);
  assert.equal(looksLikeUzbekSurname('Aliyev'), true);
  assert.equal(looksLikeUzbekSurname("Jo'rayev"), true);
  assert.equal(looksLikeUzbekSurname('Aziza'), false);
  assert.equal(looksLikeUzbekSurname('Eva'), false);
  assert.equal(looksLikeUzbekSurname('Yakov'), false);
  assert.equal(looksLikeUzbekSurname('Shohzoda'), false);

  const rejectedTwo = validateStudentNameOrder('Karimova Aziza');
  assert.equal(rejectedTwo.ok, false);
  if (!rejectedTwo.ok) {
    assert.equal(rejectedTwo.code, 'SURNAME_FIRST');
    assert.equal(rejectedTwo.suggestedName, 'Aziza Karimova');
  }

  const rejectedThree = validateStudentNameOrder('Karimov Jasur Alisherovich');
  assert.equal(rejectedThree.ok, false);
  if (!rejectedThree.ok) {
    assert.equal(rejectedThree.code, 'SURNAME_FIRST');
    assert.equal(rejectedThree.suggestedName, 'Jasur Karimov Alisherovich');
  }

  assert.deepEqual(validateStudentNameOrder('  Aziza   Karimova '), {
    ok: true,
    fullName: 'Aziza Karimova',
  });
});

test('formatCountdown formats MM:SS cleanly and clamps below zero', () => {
  assert.equal(DEFAULT_TEST_DURATION_MINUTES, 15);
  assert.equal(TEST_DURATION_SECONDS, 900);
  assert.equal(formatCountdown(TEST_DURATION_SECONDS), '15:00');
  assert.equal(formatCountdown(600), '10:00');
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-5), '00:00');
});

test('validateTestDurationMinutes enforces integer bounds 1..120', () => {
  assert.deepEqual(validateTestDurationMinutes(15), { ok: true, minutes: 15 });
  assert.deepEqual(validateTestDurationMinutes('25'), { ok: true, minutes: 25 });
  assert.equal(validateTestDurationMinutes(0).ok, false);
  assert.equal(validateTestDurationMinutes(-10).ok, false);
  assert.equal(validateTestDurationMinutes(121).ok, false);
  assert.equal(validateTestDurationMinutes(12.5).ok, false);
  assert.equal(validateTestDurationMinutes('abc').ok, false);
});

test('getStudentMasteryRank computes tier title and progress accurately', () => {
  const tier1 = getStudentMasteryRank(250);
  assert.equal(tier1.title, 'Boshlovchi');
  assert.equal(tier1.level, 1);
  assert.equal(tier1.progressPercent, 50);

  const tier5 = getStudentMasteryRank(16000);
  assert.equal(tier5.title, 'Master Lexicon');
  assert.equal(tier5.nextTitle, null);
  assert.equal(tier5.progressPercent, 100);
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
