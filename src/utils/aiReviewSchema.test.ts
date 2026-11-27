import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptMistakesToAiInputs,
  buildAiReviewPrompt,
  buildMistakeAnalysisItems,
  parseAiReviewJson,
  stripMarkdownCodeFences,
} from './aiReviewSchema';

test('attemptMistakesToAiInputs converts attempt mistakes cleanly', () => {
  const converted = attemptMistakesToAiInputs(1, 'Learning vocabulary', [
    {
      questionId: 'u1-q01',
      prompt: 'What are words that go together?',
      options: ['Collocations', 'Suffixes', 'Idioms', 'Roots'],
      selectedIndex: 1,
      correctIndex: 0,
      selectedAnswer: 'Suffixes',
      correctAnswer: 'Collocations',
      explanation: 'Collocations are words that naturally go together.',
    },
  ]);

  assert.equal(converted.length, 1);
  assert.equal(converted[0].unitNumber, 1);
  assert.equal(converted[0].unitTitle, 'Learning vocabulary');
  assert.equal(converted[0].correctAnswer, 'Collocations');
  assert.equal(converted[0].missCount, 1);
});

test('buildMistakeAnalysisItems deduplicates repeated mistakes and enriches unit subtitles', () => {
  const enriched = buildMistakeAnalysisItems([
    {
      questionId: 'u1-q02',
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      prompt: 'to ___ an opinion',
      selectedAnswer: 'make',
      correctAnswer: 'express',
      explanation: 'Verb + noun collocation.',
      missCount: 1,
    },
    {
      questionId: 'u1-q02',
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      prompt: 'to ___ an opinion',
      selectedAnswer: 'say',
      correctAnswer: 'express',
      explanation: 'Verb + noun collocation.',
      missCount: 2,
    },
  ]);

  assert.equal(enriched.length, 1);
  assert.equal(enriched[0].missCount, 3);
  assert.ok(enriched[0].unitSubtitle.includes('Collocations'));
});

test('buildAiReviewPrompt includes student, unit metadata, and mistake lines', () => {
  const enriched = buildMistakeAnalysisItems([
    {
      questionId: 'u1-q02',
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      prompt: 'to ___ an opinion',
      selectedAnswer: 'make',
      correctAnswer: 'express',
      explanation: 'Verb + noun collocation.',
    },
  ]);

  const prompt = buildAiReviewPrompt({
    studentName: 'Aziza Karimova',
    scopeLabel: 'Unit 1: Learning vocabulary',
    audience: 'teacher',
    mistakes: enriched,
  });

  assert.ok(prompt.includes('Aziza Karimova'));
  assert.ok(prompt.includes('Unit 1: Learning vocabulary'));
  assert.ok(prompt.includes("o'qituvchiga mo'ljallangan"));
  assert.ok(prompt.includes('to ___ an opinion'));
});

test('parseAiReviewJson parses valid JSON and strips markdown fences', () => {
  const fenced = [
    '```json',
    JSON.stringify({
      summary: "O'quvchi fe'l + ot birikmalarida adashgan.",
      strengthsNote: "Asosiy ma'nolarni tushunadi.",
      recommendedTopics: [
        {
          topicTitle: 'Verb + noun collocations',
          unitNumber: 1,
          priority: 'high',
          reason: '"express an opinion" birikmasi o\'rniga "make" tanlangan.',
          keyWords: ['express an opinion', 'take sides'],
          practiceTip: 'Har bir yangi fe\'l uchun 3 ta mos ot yozib chiqing.',
        },
      ],
      studyPlan: ["Unit 1B bo'limini qayta o'qish"],
    }),
    '```',
  ].join('\n');

  assert.equal(stripMarkdownCodeFences(fenced).startsWith('{'), true);
  const parsed = parseAiReviewJson(fenced, 1);
  assert.equal(parsed.recommendedTopics.length, 1);
  assert.equal(parsed.recommendedTopics[0].priority, 'high');
  assert.equal(parsed.recommendedTopics[0].unitNumber, 1);
  assert.deepEqual(parsed.recommendedTopics[0].keyWords, [
    'express an opinion',
    'take sides',
  ]);
  assert.equal(parsed.studyPlan.length, 1);
});

test('parseAiReviewJson throws when summary or recommendedTopics are missing', () => {
  assert.throws(() => parseAiReviewJson('{"summary":"","recommendedTopics":[]}', 1));
});
