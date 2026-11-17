import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AppStore } from './store';

function createTempStore(): { store: AppStore; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-store-'));
  const file = path.join(dir, 'db.json');
  const store = new AppStore(file);
  return {
    store,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('student registration saves new student and resumes existing profile with lookup', () => {
  const { store, cleanup } = createTempStore();
  try {
    const first = store.enterStudent('Aziza Karimova', '8-03');
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.status, 'created');
    assert.equal(first.profile.fullName, 'Aziza Karimova');
    assert.equal(first.profile.className, '8-03');

    // Record an attempt on Aziza's profile
    const saved = store.recordAttempt(first.token, {
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      totalQuestions: 30,
      correctCount: 25,
      wrongCount: 5,
      unansweredCount: 0,
      percentage: 83,
      pointsEarned: 250,
      durationSeconds: 180,
      mistakes: [],
    });
    assert.equal(saved.ok, true);

    // Lookup detects Aziza cleanly by normalized name
    const lookupExact = store.lookupStudent('  aziza   karimova ', '8-03');
    assert.equal(lookupExact.found, true);
    if (lookupExact.found) {
      assert.equal(lookupExact.exactClassMatch, true);
      assert.equal(lookupExact.totalPoints, 250);
      assert.equal(lookupExact.completedUnitsCount, 1);
    }

    // Re-entering without passing token resumes her saved profile & history
    const resumed = store.enterStudent('aziza karimova', '8-03');
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.status, 'resumed');
    assert.equal(resumed.token, first.token);
    assert.equal(resumed.profile.totalPoints, 250);
    assert.equal(resumed.profile.attempts.length, 1);

    // Same name in a different class creates a distinct student account
    const otherClass = store.enterStudent('Aziza Karimova', '8-02');
    assert.equal(otherClass.ok, true);
    if (otherClass.ok) {
      assert.equal(otherClass.status, 'created');
      assert.notEqual(otherClass.token, first.token);
    }
  } finally {
    cleanup();
  }
});

test('student attempts persist in profile and calculate total points', () => {
  const { store, cleanup } = createTempStore();
  try {
    const created = store.enterStudent('Jasur Aliyev', '9-02');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(created.profile.studiedUnits, []);

    const studied = store.markUnitStudied(created.token, 6);
    assert.equal(studied.ok, true);
    if (!studied.ok) return;
    assert.deepEqual(studied.profile.studiedUnits, [6]);

    const saved = store.recordAttempt(created.token, {
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      totalQuestions: 30,
      correctCount: 24,
      wrongCount: 6,
      unansweredCount: 0,
      percentage: 80,
      pointsEarned: 240,
      durationSeconds: 320,
      mistakes: [],
    });

    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.profile.totalPoints, 240);
    assert.deepEqual(saved.profile.completedUnits, [1]);
    assert.deepEqual(saved.profile.studiedUnits, [1, 6]);
    assert.equal(saved.profile.attempts.length, 1);

    const fetched = store.getStudentByToken(created.token);
    assert.ok(fetched);
    assert.equal(fetched.totalPoints, 240);
    assert.deepEqual(fetched.studiedUnits, [1, 6]);
  } finally {
    cleanup();
  }
});

test('teacher authenticates with Jalolova@2026 and can update password with verification', () => {
  const { store, cleanup } = createTempStore();
  try {
    const badLogin = store.loginTeacher('wrongpass');
    assert.equal(badLogin.ok, false);

    const goodLogin = store.loginTeacher('Jalolova@2026');
    assert.equal(goodLogin.ok, true);
    if (!goodLogin.ok) return;

    // Mismatched confirm password fails
    const mismatch = store.changeTeacherPassword(
      goodLogin.token,
      'Jalolova@2026',
      'NewPass2027',
      'Different2027',
    );
    assert.equal(mismatch.ok, false);

    // Wrong old password fails
    const wrongOld = store.changeTeacherPassword(
      goodLogin.token,
      'WrongOld',
      'NewPass2027',
      'NewPass2027',
    );
    assert.equal(wrongOld.ok, false);

    // Valid password update succeeds
    const changed = store.changeTeacherPassword(
      goodLogin.token,
      'Jalolova@2026',
      'NewPass2027',
      'NewPass2027',
    );
    assert.equal(changed.ok, true);

    // Old password no longer works; new password works
    assert.equal(store.loginTeacher('Jalolova@2026').ok, false);
    assert.equal(store.loginTeacher('NewPass2027').ok, true);
  } finally {
    cleanup();
  }
});

test('teacher can verify and update cheater unlock code independently', () => {
  const { store, cleanup } = createTempStore();
  try {
    assert.equal(store.verifyCheaterCode('2026Al1209.9'), true);
    assert.equal(store.verifyCheaterCode('wrong-code'), false);

    const login = store.loginTeacher('Jalolova@2026');
    assert.equal(login.ok, true);
    if (!login.ok) return;

    // Unauthenticated token fails
    const unauth = store.changeCheaterCode('bad-token', '2026Al1209.9', 'NewCheat99', 'NewCheat99');
    assert.equal(unauth.ok, false);

    // Wrong old code fails
    const wrongOld = store.changeCheaterCode(login.token, 'WrongOld', 'NewCheat99', 'NewCheat99');
    assert.equal(wrongOld.ok, false);

    // Mismatched confirm fails
    const mismatch = store.changeCheaterCode(login.token, '2026Al1209.9', 'NewCheat99', 'Other99');
    assert.equal(mismatch.ok, false);

    // Valid update works and invalidates previous code
    const updated = store.changeCheaterCode(
      login.token,
      '2026Al1209.9',
      'NewCheat99',
      'NewCheat99',
    );
    assert.equal(updated.ok, true);
    assert.equal(store.verifyCheaterCode('2026Al1209.9'), false);
    assert.equal(store.verifyCheaterCode('NewCheat99'), true);
  } finally {
    cleanup();
  }
});

test('teacher can inspect and update test timer duration (default 15 minutes)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-timer-'));
  const file = path.join(dir, 'db.json');
  try {
    const store = new AppStore(file);
    assert.equal(store.getTestDurationMinutes(), 15);

    const unauth = store.setTestDurationMinutes('invalid-token', 20);
    assert.equal(unauth.ok, false);

    const login = store.loginTeacher('Jalolova@2026');
    assert.equal(login.ok, true);
    if (!login.ok) return;

    assert.equal(store.setTestDurationMinutes(login.token, 0).ok, false);
    assert.equal(store.setTestDurationMinutes(login.token, 150).ok, false);

    const updated = store.setTestDurationMinutes(login.token, 20);
    assert.deepEqual(updated, { ok: true, testDurationMinutes: 20 });
    assert.equal(store.getTestDurationMinutes(), 20);

    // Persisted across reload
    const reloaded = new AppStore(file);
    assert.equal(reloaded.getTestDurationMinutes(), 20);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
