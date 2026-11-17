import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDeleteStudent,
  localEnterStudent,
  localFetchTeacherDashboard,
  localGetStudentByToken,
  localGetTestDurationMinutes,
  localLoginTeacher,
  localLookupStudent,
  LocalStudentEntryError,
  localSubmitAttempt,
  localUpdateCheaterCode,
  localUpdateTeacherPassword,
  localUpdateTestDurationMinutes,
  localVerifyCheaterCode,
  type StorageLike,
} from './localFallbackStore';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}

test('localFallbackStore supports student entry, returning resume, attempt save, and teacher auth', async () => {
  const storage = createMemoryStorage();

  const entered = localEnterStudent('Aziza Karimova', '8-03', null, storage);
  assert.equal(entered.status, 'created');
  assert.equal(entered.profile.fullName, 'Aziza Karimova');

  const saved = localSubmitAttempt(
    entered.token,
    {
      unitNumber: 1,
      unitTitle: 'Learning vocabulary',
      totalQuestions: 30,
      correctCount: 25,
      wrongCount: 5,
      unansweredCount: 0,
      percentage: 83,
      pointsEarned: 250,
      durationSeconds: 120,
      mistakes: [],
    },
    storage,
  );
  assert.equal(saved.profile.totalPoints, 250);
  assert.equal(localGetStudentByToken(entered.token, storage)?.totalPoints, 250);

  const lookup = localLookupStudent('  aziza  karimova ', '8-03', storage);
  assert.equal(lookup.found, true);
  if (lookup.found) {
    assert.equal(lookup.totalPoints, 250);
  }

  // Re-entering without token resumes saved profile and preserves history
  const resumed = localEnterStudent('aziza karimova', '8-03', null, storage);
  assert.equal(resumed.status, 'resumed');
  assert.equal(resumed.token, entered.token);
  assert.equal(resumed.profile.totalPoints, 250);
  assert.equal(resumed.profile.attempts.length, 1);

  const teacherToken = await localLoginTeacher('Jalolova@2026', storage);
  const dashboard = localFetchTeacherDashboard(teacherToken, storage);
  assert.equal(dashboard.length, 1);
  assert.equal(dashboard[0].totalPoints, 250);

  await localUpdateTeacherPassword(
    teacherToken,
    'Jalolova@2026',
    'NewPass@2026',
    'NewPass@2026',
    storage,
  );
  const newToken = await localLoginTeacher('NewPass@2026', storage);
  assert.ok(newToken.length > 10);

  assert.equal(await localVerifyCheaterCode('2026Al1209.9', storage), true);
  assert.equal(await localVerifyCheaterCode('wrong', storage), false);
  await localUpdateCheaterCode(
    newToken,
    '2026Al1209.9',
    'LocalCheat2027',
    'LocalCheat2027',
    storage,
  );
  assert.equal(await localVerifyCheaterCode('2026Al1209.9', storage), false);
  assert.equal(await localVerifyCheaterCode('LocalCheat2027', storage), true);

  assert.equal(localGetTestDurationMinutes(storage), 15);
  assert.throws(() => localUpdateTestDurationMinutes('bad-token', 20, storage));
  assert.equal(localUpdateTestDurationMinutes(newToken, 25, storage), 25);
  assert.equal(localGetTestDurationMinutes(storage), 25);

  localDeleteStudent(newToken, entered.profile.id, storage);
  assert.equal(localFetchTeacherDashboard(newToken, storage).length, 0);
});

test('localFallbackStore rejects surname-first, deduplicates apostrophes, and blocks reversed names', async () => {
  const storage = createMemoryStorage();

  assert.throws(
    () => localEnterStudent('Karimova Aziza', '8-03', null, storage),
    (err: unknown) =>
      err instanceof LocalStudentEntryError &&
      err.code === 'SURNAME_FIRST' &&
      err.suggestedName === 'Aziza Karimova',
  );

  const first = localEnterStudent("O'tkir G'aniyev", '8-03', null, storage);
  const second = localEnterStudent('Oʻtkir Gʻaniyev', '8-03', null, storage);
  assert.equal(second.status, 'resumed');
  assert.equal(second.token, first.token);

  localEnterStudent('Dilshod Bek', '8-03', null, storage);
  const lookup = localLookupStudent('Bek Dilshod', '8-03', storage);
  assert.equal(lookup.found, true);
  if (lookup.found) {
    assert.equal(lookup.reversedOrder, true);
    assert.equal(lookup.fullName, 'Dilshod Bek');
  }

  assert.throws(
    () => localEnterStudent('Bek Dilshod', '8-03', null, storage),
    (err: unknown) =>
      err instanceof LocalStudentEntryError &&
      err.code === 'SURNAME_FIRST' &&
      err.suggestedName === 'Dilshod Bek',
  );

  const teacherToken = await localLoginTeacher('Jalolova@2026', storage);
  assert.equal(localFetchTeacherDashboard(teacherToken, storage).length, 2);
});
