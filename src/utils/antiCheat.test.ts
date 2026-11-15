import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCheaterLockedInStorage,
  isFullscreenActive,
  setCheaterLockedInStorage,
  verifyCheaterUnlockCode,
  type StorageLike,
} from './antiCheat';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('verifyCheaterUnlockCode accepts only exact unlock code 2026Al1209.9', () => {
  assert.equal(verifyCheaterUnlockCode('2026Al1209.9'), true);
  assert.equal(verifyCheaterUnlockCode('  2026Al1209.9  '), true);
  assert.equal(verifyCheaterUnlockCode('2026al1209.9'), false);
  assert.equal(verifyCheaterUnlockCode('2026Al1209'), false);
  assert.equal(verifyCheaterUnlockCode(''), false);
});

test('cheater lock state persists in storage until unlocked', () => {
  const storage = createMemoryStorage();
  assert.equal(isCheaterLockedInStorage(storage), false);

  setCheaterLockedInStorage(true, storage);
  assert.equal(isCheaterLockedInStorage(storage), true);

  setCheaterLockedInStorage(false, storage);
  assert.equal(isCheaterLockedInStorage(storage), false);
});

test('isFullscreenActive checks standard and webkit fullscreenElement', () => {
  assert.equal(isFullscreenActive({ fullscreenElement: null } as Document), false);
  assert.equal(
    isFullscreenActive({ fullscreenElement: {} as Element } as Document),
    true,
  );
  assert.equal(
    isFullscreenActive({
      fullscreenElement: null,
      webkitFullscreenElement: {} as Element,
    } as unknown as Document),
    true,
  );
});
