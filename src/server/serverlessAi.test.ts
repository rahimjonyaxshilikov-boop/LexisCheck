import test from 'node:test';
import assert from 'node:assert/strict';
import netlifyHandler, { config as netlifyConfig } from '../../netlify/functions/ai-review-recommendations';

test('netlify ai-review-recommendations enforces method, auth header, payload, and honest 503 when key missing', async () => {
  assert.equal(netlifyConfig.path, '/api/ai/review-recommendations');
  const wrongMethod = await netlifyHandler(
    new Request('https://example.com/api/ai/review-recommendations', { method: 'GET' }),
  );
  assert.equal(wrongMethod.status, 405);

  const noAuth = await netlifyHandler(
    new Request('https://example.com/api/ai/review-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: 'Aziza Karimova', scopeLabel: 'Unit 2', mistakes: [{}] }),
    }),
  );
  assert.equal(noAuth.status, 401);

  const emptyMistakes = await netlifyHandler(
    new Request('https://example.com/api/ai/review-recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-student-token': 'token_1234567890',
      },
      body: JSON.stringify({ studentName: 'Aziza Karimova', scopeLabel: 'Unit 2', mistakes: [] }),
    }),
  );
  assert.equal(emptyMistakes.status, 400);

  const prevKey = process.env.GEMINI_API_KEY;
  const prevGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  try {
    const missingKeyRes = await netlifyHandler(
      new Request('https://example.com/api/ai/review-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-student-token': 'token_1234567890',
        },
        body: JSON.stringify({
          studentName: 'Aziza Karimova',
          scopeLabel: 'Unit 2',
          mistakes: [
            {
              questionId: 'u2-q01',
              unitNumber: 2,
              unitTitle: 'Organising a vocabulary notebook',
              prompt: 'She ___ a high salary as a lawyer.',
              selectedAnswer: 'Javob belgilanmagan',
              correctAnswer: 'earns',
              explanation: 'Use earn + salary.',
            },
          ],
        }),
      }),
    );
    assert.equal(missingKeyRes.status, 503);
    const body = (await missingKeyRes.json()) as { code?: string; error?: string };
    assert.equal(body.code, 'GEMINI_API_KEY_MISSING');
    assert.ok(body.error?.includes('GEMINI_API_KEY'));
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    if (prevGoogleKey !== undefined) process.env.GOOGLE_API_KEY = prevGoogleKey;
  }
});
