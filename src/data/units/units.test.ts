import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_UNITS, getUnitByNumber } from './index';
import { TOTAL_UNITS } from '../../utils/quizEngine';

test('ALL_UNITS contains exactly Units 1 through 101 in order', () => {
  assert.equal(ALL_UNITS.length, 101);
  assert.equal(TOTAL_UNITS, 101);
  ALL_UNITS.forEach((unit, idx) => {
    assert.equal(unit.unitNumber, idx + 1);
    assert.ok(unit.title.trim().length > 0);
    assert.ok(unit.vocab.length >= 10, `Unit ${unit.unitNumber} should have study vocab items`);
  });
});

test('Every unit has at least 30 unique, well-formed questions with no duplicates', () => {
  const globalIds = new Set<string>();

  for (const unit of ALL_UNITS) {
    assert.ok(
      unit.questions.length >= 30,
      `Unit ${unit.unitNumber} has only ${unit.questions.length} questions`,
    );

    const promptsInUnit = new Set<string>();
    for (const q of unit.questions) {
      assert.ok(!globalIds.has(q.id), `Duplicate question ID: ${q.id}`);
      globalIds.add(q.id);

      const normalizedPrompt = q.prompt.trim().toLowerCase();
      assert.ok(
        !promptsInUnit.has(normalizedPrompt),
        `Duplicate prompt in Unit ${unit.unitNumber}: ${q.prompt}`,
      );
      promptsInUnit.add(normalizedPrompt);

      assert.equal(q.options.length, 4, `Question ${q.id} must have 4 options`);
      const uniqueOptions = new Set(q.options.map((o) => o.trim().toLowerCase()));
      assert.equal(
        uniqueOptions.size,
        4,
        `Question ${q.id} has duplicate options`,
      );
      assert.ok(
        q.correctIndex >= 0 && q.correctIndex <= 3,
        `Question ${q.id} has invalid correctIndex`,
      );
      assert.ok(q.explanation.trim().length > 0, `Question ${q.id} missing explanation`);
      assert.ok(
        !/\bxercise|\bexercise\s*\d|\bunit\s*\d|\bfootnote\s*\d|from the box/i.test(q.prompt),
        `Question ${q.id} should not reference textbook exercise/unit numbers in prompt: ${q.prompt}`,
      );
    }
  }
});

test('getUnitByNumber finds valid units and returns undefined for missing ones', () => {
  assert.equal(getUnitByNumber(1)?.title, 'Learning vocabulary');
  assert.equal(getUnitByNumber(20)?.title, 'Theatre and cinema');
  assert.equal(getUnitByNumber(21)?.title, 'Music');
  assert.equal(getUnitByNumber(51)?.title, 'Number, quantity, degree and intensity');
  assert.equal(getUnitByNumber(91)?.title, 'Expressions with get');
  assert.equal(getUnitByNumber(101)?.title, 'US English');
  assert.equal(getUnitByNumber(102), undefined);
});
