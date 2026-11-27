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

test('store records per-unit fullscreen exits and AI suspicion and exposes them on teacher dashboard', () => {
  const { store, cleanup } = createTempStore();
  try {
    const created = store.enterStudent('Sardorbek Olimov', '9-01');
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const first = store.recordCheatEvent(created.token, {
      unitNumber: 4,
      unitTitle: 'Suffixes',
      eventType: 'fullscreen_exit',
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.profile.cheatOverview.totalExits, 1);
    assert.equal(first.profile.cheatOverview.aiSuspected, false);

    const second = store.recordCheatEvent(created.token, {
      unitNumber: 4,
      unitTitle: 'Suffixes',
      eventType: 'tab_switch',
      awaySeconds: 12,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.profile.cheatOverview.totalExits, 1);
    assert.equal(second.profile.cheatOverview.totalTabSwitches, 1);
    assert.equal(second.profile.cheatOverview.aiSuspected, true);

    const login = store.loginTeacher('Jalolova@2026');
    assert.equal(login.ok, true);
    if (!login.ok) return;

    const dashboard = store.getTeacherDashboard(login.token);
    assert.equal(dashboard.ok, true);
    if (!dashboard.ok) return;
    assert.equal(dashboard.students[0].cheatLogs.length, 1);
    assert.equal(dashboard.students[0].cheatLogs[0].unitNumber, 4);
    assert.equal(dashboard.students[0].cheatLogs[0].aiSuspected, true);

    const cleared = store.clearStudentCheatLogs(login.token, created.profile.id);
    assert.equal(cleared.ok, true);
    if (cleared.ok) {
      assert.equal(cleared.student.cheatLogs.length, 0);
      assert.equal(cleared.student.cheatOverview.totalExits, 0);
    }
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

test('store rejects surname-first entry, deduplicates apostrophes, and prevents duplicate swapped accounts', () => {
  const { store, cleanup } = createTempStore();
  try {
    // 1. Surname-first entry is rejected with suggestedName
    const surnameFirst = store.enterStudent('Karimova Aziza', '8-03');
    assert.equal(surnameFirst.ok, false);
    if (!surnameFirst.ok) {
      assert.equal(surnameFirst.code, 'SURNAME_FIRST');
      assert.equal(surnameFirst.suggestedName, 'Aziza Karimova');
    }

    // 2. Canonical registration succeeds
    const valid = store.enterStudent("O'tkir G'aniyev", '8-03');
    assert.equal(valid.ok, true);
    if (!valid.ok) return;
    assert.equal(valid.status, 'created');

    // 3. Re-entering with Uzbek curly apostrophes resumes the exact same student (1 student total)
    const apostropheVariant = store.enterStudent('Oʻtkir Gʻaniyev', '8-03');
    assert.equal(apostropheVariant.ok, true);
    if (!apostropheVariant.ok) return;
    assert.equal(apostropheVariant.status, 'resumed');
    assert.equal(apostropheVariant.token, valid.token);

    // 4. Non--ov surname student: first entry sets canonical order; reversed order is rejected
    const nonOvFirst = store.enterStudent('Dilshod Bek', '8-03');
    assert.equal(nonOvFirst.ok, true);
    if (!nonOvFirst.ok) return;

    const reversedLookup = store.lookupStudent('Bek Dilshod', '8-03');
    assert.equal(reversedLookup.found, true);
    if (reversedLookup.found) {
      assert.equal(reversedLookup.reversedOrder, true);
      assert.equal(reversedLookup.fullName, 'Dilshod Bek');
    }

    const reversedSubmit = store.enterStudent('Bek Dilshod', '8-03');
    assert.equal(reversedSubmit.ok, false);
    if (!reversedSubmit.ok) {
      assert.equal(reversedSubmit.code, 'SURNAME_FIRST');
      assert.equal(reversedSubmit.suggestedName, 'Dilshod Bek');
    }

    // Total student count in teacher dashboard remains 2 (no duplicates created)
    const teacherLogin = store.loginTeacher('Jalolova@2026');
    assert.equal(teacherLogin.ok, true);
    if (!teacherLogin.ok) return;
    const dashboard = store.getTeacherDashboard(teacherLogin.token);
    assert.equal(dashboard.ok, true);
    if (dashboard.ok) {
      assert.equal(dashboard.students.length, 2);
    }
  } finally {
    cleanup();
  }
});

test('store upgrades legacy surname-first student record when re-entered properly without duplicating', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-legacy-'));
  const file = path.join(dir, 'db.json');
  try {
    // Initialize valid DB structure first, then inject a legacy surname-first student record
    new AppStore(file);
    const existing = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    existing.students = [
      {
        id: 'legacy-1',
        fullName: 'Karimova Aziza',
        className: '8-03',
        normalizedKey: 'karimova aziza::8-03',
        secretToken: 'legacy-token-1',
        studiedUnits: [1],
        attempts: [],
        createdAt: '2026-11-10T10:00:00Z',
      },
    ];
    fs.writeFileSync(file, JSON.stringify(existing), 'utf8');

    const store = new AppStore(file);
    const lookup = store.lookupStudent('Aziza Karimova', '8-03');
    assert.equal(lookup.found, true);
    if (lookup.found) {
      assert.equal(lookup.reversedOrder, false);
    }

    const resumed = store.enterStudent('Aziza Karimova', '8-03');
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.status, 'resumed');
    assert.equal(resumed.token, 'legacy-token-1');
    assert.equal(resumed.profile.fullName, 'Aziza Karimova');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store saves AI review recommendations per student and exposes them to teacher dashboard', () => {
  const { store, cleanup } = createTempStore();
  try {
    const created = store.enterStudent('Madina Tursunova', '10-01');
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const saved = store.saveAiRecommendation({
      studentToken: created.token,
      cacheKey: 'attempt:att-1',
      recommendation: {
        summary: 'Collocation mavzusini takrorlash kerak.',
        strengthsNote: 'Register farqlarini yaxshi biladi.',
        recommendedTopics: [
          {
            topicTitle: 'Verb + noun collocations',
            unitNumber: 1,
            priority: 'high',
            reason: '"take sides" o\'rniga "hold sides" tanlangan.',
            keyWords: ['take sides', 'express an opinion'],
            practiceTip: 'Misollarni gap ichida yozing.',
          },
        ],
        studyPlan: ["Unit 1 lug'atini qayta ko'rish"],
        generatedAt: '2026-11-27T12:00:00.000Z',
        model: 'gemini-4-hydrogen',
      },
    });

    assert.ok(saved);
    assert.ok(saved.aiRecommendations?.['attempt:att-1']);

    const teacher = store.loginTeacher('Jalolova@2026');
    assert.equal(teacher.ok, true);
    if (!teacher.ok) return;

    const dashboard = store.getTeacherDashboard(teacher.token);
    assert.equal(dashboard.ok, true);
    if (!dashboard.ok) return;

    const target = dashboard.students.find((s) => s.id === created.profile.id);
    assert.ok(target?.aiRecommendations?.['attempt:att-1']);
    assert.equal(
      target.aiRecommendations['attempt:att-1'].recommendedTopics[0].topicTitle,
      'Verb + noun collocations',
    );
  } finally {
    cleanup();
  }
});
