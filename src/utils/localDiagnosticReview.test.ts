import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLocalDiagnosticReview,
  LOCAL_DIAGNOSTIC_MODEL,
} from './localDiagnosticReview';

test('buildLocalDiagnosticReview returns null when mistakes array is empty', () => {
  const res = buildLocalDiagnosticReview({
    studentName: 'Aziza Karimova',
    scopeLabel: 'Unit 9: The body and movement',
    audience: 'student',
    mistakes: [],
  });
  assert.equal(res, null);
});

test('buildLocalDiagnosticReview groups mistakes by unit section, extracts keywords, and distinguishes student vs teacher tone', () => {
  const mistakes = [
    {
      questionId: 'u9-q1',
      unitNumber: 9,
      unitTitle: 'The body and movement',
      prompt: 'Which part of the body supports the head?',
      selectedAnswer: 'Knee',
      correctAnswer: 'Neck',
      explanation: 'Unit 9A covers external body parts such as neck, shoulder, and wrist.',
      missCount: 2,
    },
    {
      questionId: 'u9-q2',
      unitNumber: 9,
      unitTitle: 'The body and movement',
      prompt: 'Which internal organ pumps blood?',
      selectedAnswer: 'Javob belgilanmagan',
      correctAnswer: 'Heart',
      explanation: 'Unit 9B explains internal organs including heart, lungs, and liver.',
      missCount: 1,
    },
    {
      questionId: 'u9-q3',
      unitNumber: 9,
      unitTitle: 'The body and movement',
      prompt: 'What does "keep an eye on" mean?',
      selectedAnswer: 'Javob belgilanmagan',
      correctAnswer: 'Watch carefully',
      explanation: 'Unit 9C focuses on idioms and fixed expressions with body words.',
      missCount: 3,
    },
  ];

  const studentResult = buildLocalDiagnosticReview({
    studentName: 'Aziza Karimova',
    scopeLabel: 'Unit 9: The body and movement',
    audience: 'student',
    mistakes,
  });

  assert.ok(studentResult);
  assert.equal(studentResult.model, LOCAL_DIAGNOSTIC_MODEL);
  assert.equal(studentResult.recommendedTopics.length, 3);
  assert.equal(studentResult.recommendedTopics[0].unitNumber, 9);
  assert.ok(studentResult.recommendedTopics[0].topicTitle.includes('Unit 9C'));
  assert.equal(studentResult.recommendedTopics[0].priority, 'medium');
  assert.ok(studentResult.recommendedTopics[0].keyWords.includes('Watch carefully'));
  assert.ok(studentResult.studyPlan.length >= 2);
  assert.ok(studentResult.summary.includes('3 ta savol'));

  const teacherResult = buildLocalDiagnosticReview({
    studentName: 'Aziza Karimova',
    scopeLabel: 'Aziza Karimova — barcha xatolar',
    audience: 'teacher',
    mistakes,
  });

  assert.ok(teacherResult);
  assert.ok(teacherResult.summary.includes('Aziza Karimova'));
  assert.ok(teacherResult.strengthsNote.includes('oʻquvchiga'));
});
