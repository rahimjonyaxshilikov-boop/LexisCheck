import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDeleteStudent,
  localEnterStudent,
  localFetchTeacherDashboard,
  localGetStudentByToken,
  localLoginTeacher,
  localSubmitAttempt,
  localUpdateCheaterCode,
  localUpdateTeacherPassword,
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

test('localFallbackStore supports student entry, lock, attempt save, and teacher auth', async () => {
  const storage = createMemoryStorage();

  const entered = localEnterStudent('Aziza Karimova', '8-03', null, storage);
  assert.equal(entered.status, 'created');
  assert.equal(entered.profile.fullName, 'Aziza Karimova');

  assert.throws(() => {
    localEnterStudent('Aziza Karimova', '8-03', null, storage);
  }, /allaqachon ro'yxatdan o'tgan/);

  const resumed = localEnterStudent('Aziza Karimova', '8-03', entered.token, storage);
  assert.equal(resumed.status, 'resumed');

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

  localDeleteStudent(newToken, entered.profile.id, storage);
  assert.equal(localFetchTeacherDashboard(newToken, storage).length, 0);
});
